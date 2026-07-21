import { authenticate } from "./auth.js";
import { enqueueDueSandboxRuns } from "./cron.js";
import { assertObject, errorResponse, HttpError, json, options, readJson } from "./http.js";
import { log, logError } from "./log.js";
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
import { consumeAgentJobs } from "./queue.js";

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
    if (request.method === "GET" && url.pathname === "/health") {
      return json(request, env, {
        ok: true,
        service: "el-plan-control-plane",
        mode: "sandbox",
        external_actions_enabled: false,
      });
    }
    if (env.ENVIRONMENT !== "sandbox") {
      throw new HttpError(503, "sandbox_required", "This control plane is configured for sandbox operation only");
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
    await enqueueDueSandboxRuns(event, env);
  },
};
