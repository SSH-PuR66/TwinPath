// Calendar feeds: Outlook and Blackboard both publish a private ICS URL per user.
// TwinPath ingests those feeds on the cron and writes the next 60 days into
// appointments, so the family calendar shows classes, deadlines and meetings
// without anyone handing over a password. Rows are keyed by feed + event
// instance, so a re-sync updates in place and removes what the feed dropped.

import { HttpError } from "./http.js";
import { log, logError } from "./log.js";
import { deleteRows, selectRows, supabaseRequest, updateRows, upsertRows } from "./supabase.js";

export const PROVIDER = "calendar_ics";
const MAX_FEEDS_PER_HOUSEHOLD = 6;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const SYNC_INTERVAL_MINUTES = 30;
const HORIZON_PAST_DAYS = 1;
const HORIZON_FUTURE_DAYS = 60;
const MAX_EVENTS_PER_FEED = 600;
const USER_AGENT = "TwinPathCalendar/1.0 (personal calendar bridge; contact: srodriguez46@gaels.iona.edu)";
const DEFAULT_TZ = "America/New_York";

// Outlook publishes with Windows time zone names. The ones a US student will meet.
const WINDOWS_TZ = {
  "Eastern Standard Time": "America/New_York",
  "Central Standard Time": "America/Chicago",
  "Mountain Standard Time": "America/Denver",
  "Pacific Standard Time": "America/Los_Angeles",
  "US Eastern Standard Time": "America/Indiana/Indianapolis",
  "Atlantic Standard Time": "America/Halifax",
  "Alaskan Standard Time": "America/Anchorage",
  "Hawaiian Standard Time": "Pacific/Honolulu",
  "UTC": "UTC",
  "GMT Standard Time": "Europe/London",
  "W. Europe Standard Time": "Europe/Berlin",
  "Romance Standard Time": "Europe/Paris",
};

// ---------- input ----------

export function classifyFeedHost(hostname) {
  const h = hostname.toLowerCase();
  if (h === "outlook.office365.com" || h === "outlook.live.com" || h === "outlook.office.com") return "outlook";
  if (h.endsWith(".blackboard.com") || h.includes("blackboard")) return "blackboard";
  if (h === "calendar.google.com") return "google";
  return "other";
}

export function validateFeedInput(body) {
  if (typeof body.label !== "string" || body.label.trim().length < 2 || body.label.trim().length > 60) {
    throw new HttpError(400, "invalid_label", "label must be 2-60 characters");
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
  if (String(body.url).length > 800) {
    throw new HttpError(400, "invalid_url", "url must be at most 800 characters");
  }
  const path = url.pathname.toLowerCase();
  if (!path.endsWith(".ics") && !url.search.toLowerCase().includes("ics") && !path.includes("/calendar")) {
    throw new HttpError(400, "invalid_url", "That is not a calendar feed link. It should end in .ics");
  }
  const visibility = body.visibility === "shared" ? "shared" : "private";
  return { label: body.label.trim(), url: url.toString(), source: classifyFeedHost(url.hostname), visibility };
}

// ---------- ICS parsing ----------

function unfold(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
}

function unescapeText(value) {
  return value.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

function parseProperty(line) {
  const idx = line.indexOf(":");
  if (idx < 0) return null;
  const head = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const [name, ...paramParts] = head.split(";");
  const params = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

// Offset (minutes) of an IANA zone at a given UTC instant.
function zoneOffsetMinutes(zone, utcMs) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return (asUtc - utcMs) / 60000;
}

function resolveZone(tzid) {
  if (!tzid) return null;
  if (WINDOWS_TZ[tzid]) return WINDOWS_TZ[tzid];
  try { new Intl.DateTimeFormat("en-US", { timeZone: tzid }); return tzid; } catch { return null; }
}

// "20260903T140000" in zone -> UTC ms. Two passes handle the DST edge.
function localToUtc(y, mo, d, h, mi, s, zone) {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  const off1 = zoneOffsetMinutes(zone, guess);
  const t1 = guess - off1 * 60000;
  const off2 = zoneOffsetMinutes(zone, t1);
  return off2 === off1 ? t1 : guess - off2 * 60000;
}

export function parseIcsDate(value, params = {}, defaultZone = DEFAULT_TZ) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  const isDate = params.VALUE === "DATE" || h === undefined;
  if (isDate) {
    return { ms: localToUtc(Number(y), Number(mo), Number(d), 0, 0, 0, resolveZone(params.TZID) || defaultZone), allDay: true };
  }
  if (z) return { ms: Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || 0)), allDay: false };
  const zone = resolveZone(params.TZID) || defaultZone;
  return { ms: localToUtc(Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s || 0), zone), allDay: false };
}

const DAY_MS = 86_400_000;
const BYDAY = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function parseRrule(value) {
  const out = {};
  for (const part of value.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) out[k.toUpperCase()] = v;
  }
  return out;
}

// Expand DAILY / WEEKLY rules inside the window. MONTHLY/YEARLY keep only the first instance;
// they are rare in class and work calendars and wrong expansion is worse than none.
function expand(ev, windowStart, windowEnd) {
  const dur = ev.end != null ? ev.end - ev.start : (ev.allDay ? DAY_MS : 3_600_000);
  const instances = [];
  const push = (startMs) => {
    if (startMs + dur < windowStart || startMs > windowEnd) return;
    if (ev.exdates.has(startMs)) return;
    instances.push({ start: startMs, end: startMs + dur });
  };
  if (!ev.rrule) { push(ev.start); return instances; }
  const r = parseRrule(ev.rrule);
  const freq = r.FREQ;
  const interval = Math.max(1, Number(r.INTERVAL || 1));
  const until = r.UNTIL ? parseIcsDate(r.UNTIL, {}, DEFAULT_TZ)?.ms ?? Infinity : Infinity;
  const count = r.COUNT ? Number(r.COUNT) : Infinity;
  const hardEnd = Math.min(until, windowEnd);
  if (freq === "DAILY") {
    let n = 0;
    for (let t = ev.start; t <= hardEnd && n < count; t += interval * DAY_MS, n++) push(t);
    return instances;
  }
  if (freq === "WEEKLY") {
    const days = r.BYDAY ? r.BYDAY.split(",").map((d) => BYDAY[d.slice(-2)]).filter((d) => d != null) : [new Date(ev.start).getUTCDay()];
    // walk week by week from the week containing DTSTART
    const startDow = new Date(ev.start).getUTCDay();
    const weekStart = ev.start - startDow * DAY_MS;
    let n = 0;
    for (let w = weekStart; w <= hardEnd && n < count; w += interval * 7 * DAY_MS) {
      for (const dow of days.slice().sort((a, b) => a - b)) {
        const t = w + dow * DAY_MS;
        if (t < ev.start || t > hardEnd || n >= count) continue;
        push(t); n++;
      }
    }
    return instances;
  }
  push(ev.start);
  return instances;
}

export function parseIcs(text, { now = Date.now(), pastDays = HORIZON_PAST_DAYS, futureDays = HORIZON_FUTURE_DAYS } = {}) {
  const lines = unfold(text).split("\n");
  const windowStart = now - pastDays * DAY_MS;
  const windowEnd = now + futureDays * DAY_MS;
  const events = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === "BEGIN:VEVENT") { cur = { exdates: new Set() }; continue; }
    if (line === "END:VEVENT") {
      if (cur && cur.uid && cur.start != null) events.push(cur);
      cur = null; continue;
    }
    if (!cur) continue;
    const p = parseProperty(line);
    if (!p) continue;
    switch (p.name) {
      case "UID": cur.uid = p.value.trim(); break;
      case "SUMMARY": cur.summary = unescapeText(p.value); break;
      case "LOCATION": cur.location = unescapeText(p.value); break;
      case "DESCRIPTION": cur.description = unescapeText(p.value); break;
      case "DTSTART": { const d = parseIcsDate(p.value, p.params); if (d) { cur.start = d.ms; cur.allDay = d.allDay; } break; }
      case "DTEND": { const d = parseIcsDate(p.value, p.params); if (d) cur.end = d.ms; break; }
      case "RRULE": cur.rrule = p.value; break;
      case "RECURRENCE-ID": { const d = parseIcsDate(p.value, p.params); if (d) cur.recurrenceId = d.ms; break; }
      case "EXDATE": for (const v of p.value.split(",")) { const d = parseIcsDate(v, p.params); if (d) cur.exdates.add(d.ms); } break;
      case "STATUS": cur.status = p.value.trim().toUpperCase(); break;
      default: break;
    }
  }
  // overrides (RECURRENCE-ID) replace the generated instance with the same uid+start
  const overrides = new Map();
  for (const ev of events) if (ev.recurrenceId != null) overrides.set(`${ev.uid}|${ev.recurrenceId}`, ev);
  const out = [];
  for (const ev of events) {
    if (ev.status === "CANCELLED") continue;
    if (ev.recurrenceId != null) {
      if (ev.start + (ev.end != null ? ev.end - ev.start : 0) >= windowStart && ev.start <= windowEnd) {
        out.push(instance(ev, ev.start, ev.end ?? ev.start + 3_600_000));
      }
      continue;
    }
    for (const inst of expand(ev, windowStart, windowEnd)) {
      const key = `${ev.uid}|${inst.start}`;
      if (overrides.has(key)) continue; // the override row carries its own start
      out.push(instance(ev, inst.start, inst.end));
    }
  }
  out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return out.slice(0, MAX_EVENTS_PER_FEED);
}

function instance(ev, startMs, endMs) {
  return {
    external_uid: `${ev.uid}|${new Date(startMs).toISOString()}`,
    title: (ev.summary || "Untitled").slice(0, 200),
    starts_at: new Date(startMs).toISOString(),
    ends_at: new Date(endMs).toISOString(),
    all_day: !!ev.allDay,
    location: ev.location ? ev.location.slice(0, 200) : null,
    notes: ev.description ? ev.description.slice(0, 1000) : null,
  };
}

// ---------- persistence ----------

const FEED_SELECT = "id,display_name,enabled,configuration,last_verified_at,created_at,owner_user_id,household_id";

function publicFeed(row) {
  const c = row.configuration || {};
  return {
    id: row.id,
    label: row.display_name,
    url: c.url,
    source: c.source || "other",
    visibility: c.visibility || "private",
    enabled: row.enabled,
    last_sync_at: c.last_sync_at || null,
    last_error: c.last_error || null,
    event_count: c.event_count ?? null,
    created_at: row.created_at,
  };
}

export async function listFeeds(env, auth) {
  const rows = await selectRows(env, "integration_connections", new URLSearchParams({
    select: FEED_SELECT, household_id: `eq.${auth.household.id}`, provider: `eq.${PROVIDER}`, order: "created_at.desc", limit: "20",
  }).toString());
  return rows.map(publicFeed);
}

export async function addFeed(env, auth, body) {
  const input = validateFeedInput(body);
  const existing = await listFeeds(env, auth);
  if (existing.length >= MAX_FEEDS_PER_HOUSEHOLD) {
    throw new HttpError(409, "feed_limit", `At most ${MAX_FEEDS_PER_HOUSEHOLD} calendar feeds per household`);
  }
  if (existing.some((f) => f.url === input.url)) {
    throw new HttpError(409, "feed_exists", "That feed is already connected");
  }
  const rows = await supabaseRequest(env, "/rest/v1/integration_connections", {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify({
      household_id: auth.household.id,
      owner_user_id: auth.user.id,
      visibility: "private",
      provider: PROVIDER,
      display_name: input.label,
      enabled: true,
      allowed_actions: ["read"],
      configuration: { url: input.url, source: input.source, visibility: input.visibility },
    }),
  });
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new HttpError(502, "persistence_error", "Supabase did not return the feed");
  return publicFeed(row);
}

export async function removeFeed(env, auth, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "invalid_id", "feed id must be a uuid");
  const rows = await deleteRows(env, "integration_connections", new URLSearchParams({
    id: `eq.${id}`, household_id: `eq.${auth.household.id}`, provider: `eq.${PROVIDER}`,
  }).toString());
  if (!rows.length) throw new HttpError(404, "not_found", "No such feed");
  await deleteRows(env, "appointments", new URLSearchParams({ household_id: `eq.${auth.household.id}`, source: `eq.ics:${id}` }).toString());
  return { removed: id };
}

async function fetchFeed(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "user-agent": USER_AGENT, accept: "text/calendar, text/plain, */*" }, redirect: "follow" });
    if (!res.ok) throw new Error(`feed responded ${res.status}`);
    const len = Number(res.headers.get("content-length") || 0);
    if (len > MAX_BODY_BYTES) throw new Error("feed too large");
    const text = await res.text();
    if (text.length > MAX_BODY_BYTES) throw new Error("feed too large");
    if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("not an ICS calendar");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export async function syncFeed(env, row, { now = Date.now() } = {}) {
  const c = row.configuration || {};
  const source = `ics:${row.id}`;
  const category = c.source === "blackboard" ? "School" : c.source === "outlook" ? "Work" : "Calendar";
  let events;
  try {
    events = parseIcs(await fetchFeed(c.url), { now });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed";
    await updateRows(env, "integration_connections", new URLSearchParams({ id: `eq.${row.id}` }).toString(), {
      configuration: { ...c, last_sync_at: new Date(now).toISOString(), last_error: message },
    });
    return { id: row.id, ok: false, error: message };
  }
  const rows = events.map((e) => ({
    household_id: row.household_id,
    owner_user_id: row.owner_user_id,
    visibility: c.visibility === "shared" ? "shared" : "private",
    title: e.title,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    location: e.location,
    notes: e.notes,
    category,
    source,
    external_uid: e.external_uid,
    updated_at: new Date(now).toISOString(),
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await upsertRows(env, "appointments", rows.slice(i, i + 200), "household_id,source,external_uid");
  }
  // drop instances the feed no longer carries inside the window (cancelled classes, moved meetings)
  const keep = new Set(events.map((e) => e.external_uid));
  const windowStart = new Date(now - HORIZON_PAST_DAYS * DAY_MS).toISOString();
  const windowEnd = new Date(now + HORIZON_FUTURE_DAYS * DAY_MS).toISOString();
  const present = await selectRows(env, "appointments", new URLSearchParams({
    select: "id,external_uid", household_id: `eq.${row.household_id}`, source: `eq.${source}`,
    starts_at: `gte.${windowStart}`, and: `(starts_at.lte.${windowEnd})`, limit: "2000",
  }).toString());
  const stale = present.filter((r) => !keep.has(r.external_uid)).map((r) => r.id);
  for (let i = 0; i < stale.length; i += 100) {
    await deleteRows(env, "appointments", new URLSearchParams({ id: `in.(${stale.slice(i, i + 100).join(",")})` }).toString());
  }
  await updateRows(env, "integration_connections", new URLSearchParams({ id: `eq.${row.id}` }).toString(), {
    last_verified_at: new Date(now).toISOString(),
    configuration: { ...c, last_sync_at: new Date(now).toISOString(), last_error: null, event_count: events.length },
  });
  return { id: row.id, ok: true, events: events.length, removed: stale.length };
}

export async function syncFeedNow(env, auth, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "invalid_id", "feed id must be a uuid");
  const rows = await selectRows(env, "integration_connections", new URLSearchParams({
    select: FEED_SELECT, id: `eq.${id}`, household_id: `eq.${auth.household.id}`, provider: `eq.${PROVIDER}`, limit: "1",
  }).toString());
  if (!rows.length) throw new HttpError(404, "not_found", "No such feed");
  return syncFeed(env, rows[0]);
}

export async function syncCalendarFeeds(event, env) {
  const now = Date.now();
  try {
    const rows = await selectRows(env, "integration_connections", new URLSearchParams({
      select: FEED_SELECT, provider: `eq.${PROVIDER}`, enabled: "eq.true", limit: "200",
    }).toString());
    const due = rows.filter((r) => {
      const last = r.configuration && r.configuration.last_sync_at ? Date.parse(r.configuration.last_sync_at) : 0;
      return now - last >= SYNC_INTERVAL_MINUTES * 60_000;
    });
    const results = await Promise.allSettled(due.map((r) => syncFeed(env, r, { now })));
    const ok = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
    log("info", "cron_calendar_feeds_processed", { feeds: rows.length, due: due.length, ok, cron: event.cron });
    return { feeds: rows.length, due: due.length, ok };
  } catch (error) {
    logError("cron_calendar_feeds_failed", error, { cron: event.cron });
    throw error;
  }
}
