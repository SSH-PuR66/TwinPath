import { authenticate } from "./auth.js";
import { enqueueDueSandboxRuns, runAutonomousPlaidSync } from "./cron.js";
import {
  assertObject,
  enforceOrigin,
  errorResponse,
  HttpError,
  json,
  options,
  readJson,
} from "./http.js";
import { log, logError } from "./log.js";
import {
  createPlaidLinkToken,
  disconnectPlaid,
  exchangePlaidPublicToken,
  getPlaidAccounts,
  handlePlaidWebhook,
  isAutonomousPlaidSyncEnabled,
  syncPlaidTransactions,
} from "./plaid.js";
import {
  cancelRun,
  createArtifactSignedUrl,
  createRun,
  createScope,
  decideApproval,
  listDashboard,
  markRunEnqueueFailed,
  pauseRun,
} from "./persistence-v13.js";
import {
  allocateAmount,
  listBenefits,
  upsertEnrollment,
} from "./benefits.js";
import { watchDeposits } from "./deposit-watch.js";
import { getProfile, putProfile } from "./profile.js";
import {
  createRetirementAccount,
  listRetirementAccounts,
  removeRetirementAccount,
  updateRetirementAccount,
} from "./retirement.js";
import {
  addWatcher,
  checkWatchedSources,
  deactivateWatcher,
  listWatchers,
} from "./watchers.js";
import {
  addFeed,
  listFeeds,
  removeFeed,
  syncCalendarFeeds,
  syncFeedNow,
} from "./calendar-feeds.js";
import { financialSummary, importCsvTransactions } from "./imports.js";
import {
  createProposal,
  decideProposal,
  listFlags,
  listProposals,
  markDepositTransfersComplete,
} from "./proposals.js";
import { consumeAgentJobs } from "./queue.js";
import { providerReadiness } from "./provider-mode.js";
import {
  getStripeCustomer,
  listStripeLifecycleEvents,
} from "./provider-persistence-v15.js";
import {
  createBillingPortalSession,
  createCheckoutSession,
  handleStripeWebhook,
} from "./stripe.js";

function routeMatch(pathname, pattern) {
  const match = pattern.exec(pathname);
  return match ? match.slice(1).map(decodeURIComponent) : null;
}

async function enqueueRun(env, run) {
  try {
    await env.AGENT_JOBS.send({
      version: 1,
      kind: "execute_run",
      run_id: run.id,
      household_id: run.household_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Queue send failed";
    await markRunEnqueueFailed(env, run.id, run.household_id, message);
    throw new HttpError(503, "queue_unavailable", "Run was saved but could not be queued");
  }
}

async function handleAuthenticated(request, env, pathname) {
  const auth = await authenticate(request, env);
  if (env.API_RATE_LIMITER) {
    const routeFamily = pathname.split("/").slice(0, 4).join("/");
    const { success } = await env.API_RATE_LIMITER.limit({
      key: `${auth.user.id}:${routeFamily}`,
    });
    if (!success) {
      throw new HttpError(429, "rate_limited", "Too many requests; try again shortly");
    }
  }

  if (
    request.method === "POST"
    && ["/v1/plaid/link-token", "/v1/financial/plaid/link-token"].includes(pathname)
  ) {
    return json(request, env, await createPlaidLinkToken(request, env, auth));
  }

  if (
    request.method === "POST"
    && [
      "/v1/plaid/public-token/exchange",
      "/v1/plaid/exchange-public-token",
      "/v1/financial/plaid/exchange",
    ].includes(pathname)
  ) {
    return json(request, env, await exchangePlaidPublicToken(request, env, auth), { status: 201 });
  }

  if (request.method === "GET" && pathname === "/v1/plaid/accounts") {
    return json(request, env, { accounts: await getPlaidAccounts(env, auth) });
  }

  if (request.method === "GET" && pathname === "/v1/financial/connections") {
    const readiness = providerReadiness(env);
    const [accounts, lifecycle, stripeCustomer] = await Promise.all([
      readiness.plaid.ready ? getPlaidAccounts(env, auth) : [],
      readiness.stripe.ready ? listStripeLifecycleEvents(env, auth) : [],
      readiness.stripe.ready ? getStripeCustomer(env, auth) : null,
    ]);
    const connections = [...accounts.reduce((items, account) => {
      const item = account.plaid_items || {};
      const key = account.plaid_item_id;
      if (!items.has(key)) {
        items.set(key, {
          id: key,
          provider: "plaid",
          institution_name: item.institution_name || "Connected institution",
          institution_id: item.institution_id || null,
          status: item.status || "active",
          last_synced_at: item.last_synced_at || null,
          account_count: 0,
        });
      }
      items.get(key).account_count += 1;
      return items;
    }, new Map()).values()];
    return json(request, env, {
      provider_mode: readiness.mode,
      readiness: [
        {
          id: "plaid",
          label: "Read-only bank data",
          status: readiness.plaid.ready ? "ready" : "disabled",
          message: readiness.plaid.ready
            ? `${readiness.plaid.environment} credentials are ready.`
            : "Plaid remains fail-closed until its mode and secrets are configured.",
        },
        {
          id: "stripe",
          label: "Stripe Billing",
          status: readiness.stripe.ready ? "ready" : "disabled",
          message: readiness.stripe.ready
            ? "Stripe keys, webhook signing, and price allowlist are ready."
            : "Stripe remains fail-closed until keys, webhook signing, and prices are configured.",
        },
      ],
      connections,
      billing: {
        checkout_ready: readiness.stripe.ready,
        customer_ready: Boolean(stripeCustomer),
        portal_ready: readiness.stripe.ready && Boolean(stripeCustomer),
        lifecycle,
      },
    });
  }

  if (request.method === "POST" && pathname === "/v1/plaid/transactions/sync") {
    return json(request, env, { sync: await syncPlaidTransactions(request, env, auth) });
  }

  if (request.method === "POST" && pathname === "/v1/plaid/disconnect") {
    return json(request, env, await disconnectPlaid(request, env, auth));
  }

  const financialSync = routeMatch(
    pathname,
    /^\/v1\/financial\/connections\/([^/]+)\/sync$/,
  );
  if (request.method === "POST" && financialSync) {
    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");
    const routedRequest = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ item_id: financialSync[0] }),
      headers,
    });
    return json(request, env, {
      sync: await syncPlaidTransactions(routedRequest, env, auth),
    });
  }

  const financialDisconnect = routeMatch(
    pathname,
    /^\/v1\/financial\/connections\/([^/]+)$/,
  );
  if (request.method === "DELETE" && financialDisconnect) {
    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");
    const routedRequest = new Request(request.url, {
      method: "POST",
      body: JSON.stringify({ item_id: financialDisconnect[0] }),
      headers,
    });
    return json(request, env, await disconnectPlaid(routedRequest, env, auth));
  }

  if (
    request.method === "POST"
    && ["/v1/stripe/checkout", "/v1/billing/checkout"].includes(pathname)
  ) {
    return json(request, env, await createCheckoutSession(request, env, auth), { status: 201 });
  }

  if (
    request.method === "POST"
    && ["/v1/stripe/billing-portal", "/v1/billing/portal"].includes(pathname)
  ) {
    return json(request, env, await createBillingPortalSession(request, env, auth), { status: 201 });
  }

  if (request.method === "GET" && ["/v1/bootstrap", "/v1/dashboard"].includes(pathname)) {
    const dashboard = await listDashboard(env, auth.household.id);
    return json(request, env, {
      ...dashboard,
      user: { id: auth.user.id, email: auth.user.email },
      household_role: auth.household.role,
    });
  }

  if (request.method === "POST" && pathname === "/v1/scopes") {
    const body = assertObject(await readJson(request));
    const scope = await createScope(env, auth, body);
    return json(request, env, { scope }, { status: 201 });
  }

  if (request.method === "POST" && pathname === "/v1/runs") {
    const body = assertObject(await readJson(request));
    const run = await createRun(env, auth, body);
    if (run.status === "queued") await enqueueRun(env, run);
    return json(request, env, { run }, { status: run.status === "queued" ? 202 : 201 });
  }

  const cancel = routeMatch(pathname, /^\/v1\/runs\/([^/]+)\/cancel$/);
  if (request.method === "POST" && cancel) {
    const run = await cancelRun(env, auth, cancel[0]);
    return json(request, env, { run });
  }

  const pause = routeMatch(pathname, /^\/v1\/runs\/([^/]+)\/pause$/);
  if (request.method === "POST" && pause) {
    const run = await pauseRun(env, auth, pause[0]);
    return json(request, env, { run });
  }

  const approval = routeMatch(pathname, /^\/v1\/approvals\/([^/]+)\/decision$/);
  if (request.method === "POST" && approval) {
    const body = assertObject(await readJson(request));
    const decided = await decideApproval(env, auth, approval[0], body);
    return json(request, env, { approval: decided });
  }

  if (request.method === "POST" && pathname === "/v1/financial/import/csv") {
    const body = assertObject(await readJson(request, 700_000));
    const result = await importCsvTransactions(env, auth, body);
    return json(request, env, result, { status: 201 });
  }

  if (request.method === "GET" && pathname === "/v1/financial/summary") {
    return json(request, env, await financialSummary(env, auth));
  }

  if (request.method === "GET" && pathname === "/v1/retirement/accounts") {
    return json(request, env, { accounts: await listRetirementAccounts(env, auth) });
  }

  if (request.method === "POST" && pathname === "/v1/retirement/accounts") {
    const body = assertObject(await readJson(request));
    return json(request, env, { account: await createRetirementAccount(env, auth, body) }, { status: 201 });
  }

  if (request.method === "PATCH" && pathname === "/v1/retirement/accounts") {
    const body = assertObject(await readJson(request));
    return json(request, env, { account: await updateRetirementAccount(env, auth, body) });
  }

  if (request.method === "DELETE" && pathname === "/v1/retirement/accounts") {
    const id = new URL(request.url).searchParams.get("id");
    return json(request, env, { account: await removeRetirementAccount(env, auth, id) });
  }

  if (request.method === "GET" && pathname === "/v1/benefits") {
    return json(request, env, await listBenefits(env, auth));
  }

  if (request.method === "POST" && pathname === "/v1/benefits/enrollment") {
    const body = assertObject(await readJson(request));
    return json(request, env, { enrollment: await upsertEnrollment(env, auth, body) }, { status: 201 });
  }

  if (request.method === "POST" && pathname === "/v1/financial/allocate") {
    const body = assertObject(await readJson(request));
    return json(request, env, await allocateAmount(env, auth, body));
  }

  if (request.method === "GET" && pathname === "/v1/proposals") {
    const status = new URL(request.url).searchParams.get("status");
    return json(request, env, { proposals: await listProposals(env, auth, status) });
  }

  if (request.method === "POST" && pathname === "/v1/proposals") {
    const body = assertObject(await readJson(request));
    const proposal = await createProposal(env, auth, body);
    return json(request, env, { proposal }, { status: 201 });
  }

  const proposalDecision = routeMatch(pathname, /^\/v1\/proposals\/([^/]+)\/decision$/);
  if (request.method === "POST" && proposalDecision) {
    const body = assertObject(await readJson(request));
    const proposal = await decideProposal(env, auth, proposalDecision[0], body);
    return json(request, env, { proposal });
  }

  const transferComplete = routeMatch(pathname, /^\/v1\/proposals\/([^/]+)\/transfer-complete$/);
  if (request.method === "PATCH" && transferComplete) {
    const body = assertObject(await readJson(request));
    return json(request, env, { proposal: await markDepositTransfersComplete(env, auth, transferComplete[0], body) });
  }

  if (request.method === "GET" && pathname === "/v1/watchers") {
    return json(request, env, { watchers: await listWatchers(env, auth) });
  }

  if (request.method === "POST" && pathname === "/v1/watchers") {
    const body = assertObject(await readJson(request));
    return json(request, env, { watcher: await addWatcher(env, auth, body) }, { status: 201 });
  }

  const watcherOff = routeMatch(pathname, /^\/v1\/watchers\/([^/]+)\/deactivate$/);
  if (request.method === "POST" && watcherOff) {
    return json(request, env, { watcher: await deactivateWatcher(env, auth, watcherOff[0]) });
  }

  // calendar feeds: Outlook / Blackboard ICS links, read-only, synced on the cron
  if (request.method === "GET" && pathname === "/v1/calendar/feeds") {
    return json(request, env, { feeds: await listFeeds(env, auth) });
  }

  if (request.method === "POST" && pathname === "/v1/calendar/feeds") {
    const body = assertObject(await readJson(request));
    const feed = await addFeed(env, auth, body);
    // first sync right away so the calendar fills in before the cron comes round
    const first = await syncFeedNow(env, auth, feed.id).catch(() => null);
    return json(request, env, { feed, sync: first }, { status: 201 });
  }

  const feedSync = routeMatch(pathname, /^\/v1\/calendar\/feeds\/([^/]+)\/sync$/);
  if (request.method === "POST" && feedSync) {
    return json(request, env, { sync: await syncFeedNow(env, auth, feedSync[0]) });
  }

  const feedRemove = routeMatch(pathname, /^\/v1\/calendar\/feeds\/([^/]+)$/);
  if (request.method === "DELETE" && feedRemove) {
    return json(request, env, await removeFeed(env, auth, feedRemove[0]));
  }

  if (request.method === "GET" && pathname === "/v1/profile") {
    return json(request, env, await getProfile(env, auth));
  }

  if (request.method === "PUT" && pathname === "/v1/profile") {
    const body = assertObject(await readJson(request, 32_768));
    return json(request, env, { profile: await putProfile(env, auth, body) });
  }

  if (request.method === "GET" && pathname === "/v1/flags") {
    return json(request, env, { flags: await listFlags(env, auth) });
  }

  const artifact = routeMatch(pathname, /^\/v1\/artifacts\/([^/]+)\/signed-url$/);
  if (request.method === "POST" && artifact) {
    const signedUrl = await createArtifactSignedUrl(env, auth, artifact[0]);
    return json(request, env, { signed_url: signedUrl, expires_in: 60 });
  }

  throw new HttpError(404, "not_found", "Endpoint not found");
}

async function handleFetch(request, env) {
  const requestId = crypto.randomUUID();
  const url = new URL(request.url);
  const started = Date.now();
  try {
    if (request.method === "OPTIONS") return options(request, env);
    enforceOrigin(request, env);
    if (request.method === "GET" && url.pathname === "/health") {
      const providers = providerReadiness(env);
      const autonomousPlaidSync = isAutonomousPlaidSyncEnabled(env) && providers.plaid.ready;
      return json(request, env, {
        ok: true,
        service: "twinpath-control-plane",
        mode: env.ENVIRONMENT || "sandbox",
        external_actions_enabled: autonomousPlaidSync,
        autonomous_runs: autonomousPlaidSync ? "plaid_sync_only" : "sandbox_only",
        providers,
      });
    }
    if (request.method === "POST" && url.pathname === "/v1/webhooks/plaid") {
      const limited = env.API_RATE_LIMITER
        ? await env.API_RATE_LIMITER.limit({ key: "webhook:plaid" })
        : { success: true };
      if (!limited.success) {
        throw new HttpError(429, "rate_limited", "Webhook rate limit exceeded");
      }
      return json(request, env, await handlePlaidWebhook(request, env));
    }
    if (request.method === "POST" && url.pathname === "/v1/webhooks/stripe") {
      const limited = env.API_RATE_LIMITER
        ? await env.API_RATE_LIMITER.limit({ key: "webhook:stripe" })
        : { success: true };
      if (!limited.success) {
        throw new HttpError(429, "rate_limited", "Webhook rate limit exceeded");
      }
      return json(request, env, await handleStripeWebhook(request, env));
    }
    const response = await handleAuthenticated(request, env, url.pathname);
    log("info", "http_request_completed", {
      request_id: requestId,
      method: request.method,
      path: url.pathname,
      status: response.status,
      duration_ms: Date.now() - started,
    });
    return response;
  } catch (error) {
    logError("http_request_failed", error, {
      request_id: requestId,
      method: request.method,
      path: url.pathname,
      duration_ms: Date.now() - started,
    });
    return errorResponse(request, env, error, requestId);
  }
}

export default {
  async fetch(request, env) {
    return handleFetch(request, env);
  },

  async queue(batch, env) {
    await consumeAgentJobs(batch, env);
  },

  async scheduled(event, env) {
    await Promise.allSettled([
      enqueueDueSandboxRuns(event, env),
      runAutonomousPlaidSync(event, env),
      watchDeposits(event, env),
      checkWatchedSources(event, env),
      syncCalendarFeeds(event, env),
    ]);
  },
};
