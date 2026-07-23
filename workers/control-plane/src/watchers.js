import { HttpError } from "./http.js";
import { log, logError } from "./log.js";
import { insertRow, selectRows, supabaseRequest, upsertRows } from "./supabase.js";

const MAX_WATCHERS_PER_HOUSEHOLD = 12;
const MAX_BODY_BYTES = 200 * 1024;
const CHECK_INTERVAL_HOURS = 6;
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "TwinPathWatcher/1.0 (personal finance deadline monitor; contact: srodriguez46@gaels.iona.edu)";

export function validateWatcherInput(body) {
  if (typeof body.label !== "string" || body.label.trim().length < 3 || body.label.trim().length > 80) {
    throw new HttpError(400, "invalid_label", "label must be 3-80 characters");
  }
  let url;
  try {
    url = new URL(String(body.url));
  } catch {
    throw new HttpError(400, "invalid_url", "url must be a valid https URL");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new HttpError(400, "invalid_url", "url must be plain https with no credentials");
  }
  if (String(body.url).length > 500) {
    throw new HttpError(400, "invalid_url", "url must be at most 500 characters");
  }
  return { label: body.label.trim(), url: url.toString() };
}

export function contentFingerprint(text) {
  // Normalize volatile noise so cosmetic changes don't trigger alerts.
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function listWatchers(env, auth) {
  return selectRows(
    env,
    "watched_sources",
    new URLSearchParams({
      select: "id,label,url,active,last_status,last_checked_at,last_changed_at,created_at",
      household_id: `eq.${auth.household.id}`,
      order: "created_at.desc",
      limit: "50",
    }).toString(),
  );
}

export async function addWatcher(env, auth, body) {
  const { label, url } = validateWatcherInput(body);
  const existing = await selectRows(
    env,
    "watched_sources",
    new URLSearchParams({
      select: "id",
      household_id: `eq.${auth.household.id}`,
      active: "eq.true",
      limit: "50",
    }).toString(),
  );
  if (existing.length >= MAX_WATCHERS_PER_HOUSEHOLD) {
    throw new HttpError(400, "watcher_limit", `At most ${MAX_WATCHERS_PER_HOUSEHOLD} active watchers per household`);
  }
  return insertRow(env, "watched_sources", {
    household_id: auth.household.id,
    created_by: auth.user.id,
    label,
    url,
  });
}

export async function deactivateWatcher(env, auth, watcherId) {
  const rows = await supabaseRequest(
    env,
    `/rest/v1/watched_sources?id=eq.${encodeURIComponent(watcherId)}&household_id=eq.${auth.household.id}`,
    {
      method: "PATCH",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({ active: false }),
    },
  );
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new HttpError(404, "watcher_not_found", "Watcher was not found");
  }
  return rows[0];
}

export async function checkWatchedSources(event, env) {
  try {
    const cutoff = new Date(
      new Date(event.scheduledTime).getTime() - CHECK_INTERVAL_HOURS * 60 * 60 * 1000,
    ).toISOString();
    const due = await selectRows(
      env,
      "watched_sources",
      new URLSearchParams({
        select: "id,household_id,label,url,last_hash",
        active: "eq.true",
        or: `(last_checked_at.is.null,last_checked_at.lt.${cutoff})`,
        order: "last_checked_at.asc.nullsfirst",
        limit: "5",
      }).toString(),
    );
    if (due.length === 0) return { checked: 0, changed: 0 };

    let changed = 0;
    for (const source of due) {
      const update = {
        last_checked_at: new Date(event.scheduledTime).toISOString(),
      };
      try {
        const response = await fetch(source.url, {
          headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml,application/xml,text/plain" },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          redirect: "follow",
        });
        update.last_status = response.status;
        if (response.ok) {
          const raw = (await response.text()).slice(0, MAX_BODY_BYTES);
          const hash = await sha256Hex(contentFingerprint(raw));
          if (source.last_hash && source.last_hash !== hash) {
            changed += 1;
            update.last_changed_at = update.last_checked_at;
            await insertRow(env, "agent_proposals", {
              household_id: source.household_id,
              origin: "agent",
              kind: "config",
              title: `Watched page changed: ${source.label}`.slice(0, 160),
              rationale: `The page you watch ("${source.label}") changed since the last check. Open it and see whether a deadline, amount, or eligibility rule moved: ${source.url}`.slice(0, 2000),
              payload: { source: "site_watch", watcher_id: source.id, url: source.url },
              flag_key: null,
              status: "pending",
            });
          }
          update.last_hash = hash;
        }
      } catch (error) {
        update.last_status = 0;
        logError("watcher_fetch_failed", error, { watcher_id: source.id });
      }
      await upsertRows(
        env,
        "watched_sources",
        [{ id: source.id, household_id: source.household_id, label: source.label, url: source.url, ...update }],
        "id",
      );
    }
    log("info", "site_watch_processed", { checked: due.length, changed, cron: event.cron });
    return { checked: due.length, changed };
  } catch (error) {
    logError("site_watch_failed", error, { cron: event.cron });
    return { checked: 0, changed: 0, error: true };
  }
}
