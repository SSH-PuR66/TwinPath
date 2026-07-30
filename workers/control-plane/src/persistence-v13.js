import { ADAPTER_NAMES, hasAdapter } from "./adapters/index.js";
import { HttpError } from "./http.js";
import {
  insertRow,
  selectRows,
  supabaseRequest,
  updateRows,
  uploadArtifactObject,
} from "./supabase.js";

function text(value, field, max = 500) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpError(400, "invalid_field", `${field} is required and must be at most ${max} characters`);
  }
  return value.trim();
}

function query(householdId, values = {}) {
  return new URLSearchParams({
    household_id: `eq.${householdId}`,
    ...values,
  });
}

function engineId(row) {
  return row?.input?.engine_id || row?.instructions?.engine_id || row?.metadata?.engine_id || "";
}

export async function listDashboard(env, householdId) {
  const requests = [
    ["automation_projects", { order: "created_at.desc", limit: "100" }],
    ["agent_runs", { order: "created_at.desc", limit: "100" }],
    ["agent_artifacts", { order: "created_at.desc", limit: "100" }],
    ["agent_approvals", { order: "created_at.desc", limit: "100" }],
    ["authorized_scopes", { order: "created_at.desc", limit: "100" }],
    ["integration_connections", { order: "created_at.desc", limit: "100" }],
  ];
  const [projects, runs, artifacts, approvals, scopes, integrations] = await Promise.all(
    requests.map(([tableName, values]) =>
      selectRows(env, tableName, query(householdId, { select: "*", ...values }).toString()),
    ),
  );

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const runById = new Map(runs.map((run) => [run.id, run]));
  const mappedRuns = runs.map((run) => {
    const project = projectById.get(run.automation_project_id);
    return {
      ...run,
      engine_id: engineId(run) || engineId(project),
      title: project?.name || "Sandbox run",
      timeline: Array.isArray(run.output?.timeline) ? run.output.timeline : [],
    };
  });
  const mappedArtifacts = artifacts.map((artifact) => {
    const run = runById.get(artifact.agent_run_id);
    return {
      ...artifact,
      ...artifact.metadata,
      name: artifact.metadata?.title || artifact.file_name,
      type: artifact.artifact_type,
      engine_id: artifact.metadata?.engine_id || engineId(run),
      confidential: artifact.metadata?.confidential !== false,
    };
  });
  const mappedApprovals = approvals.map((approval) => {
    const run = runById.get(approval.agent_run_id);
    return { ...approval, engine_id: engineId(run) };
  });

  return {
    household_id: householdId,
    sandbox_only: true,
    engines: ADAPTER_NAMES.map((id) => ({ id, engine_id: id, status: "ready" })),
    projects: projects.map((project) => ({
      ...project,
      engine_id: engineId(project),
    })),
    runs: mappedRuns,
    artifacts: mappedArtifacts,
    approvals: mappedApprovals,
    scopes,
    integrations: integrations.map(({ credential_reference: _secretReference, ...item }) => item),
    readiness: Object.fromEntries(
      ADAPTER_NAMES.map((id) => [
        id,
        [
          { id: `${id}-sandbox`, label: "Sandbox enforcement", status: "passed", summary: "Live external actions are disabled." },
          { id: `${id}-audit`, label: "Audit persistence", status: "passed", summary: "Runs and artifacts are household scoped." },
        ],
      ]),
    ),
  };
}

async function writeAudit(env, row) {
  await insertRow(env, "agent_audit_events", {
    household_id: row.household_id,
    owner_user_id: row.owner_user_id,
    automation_project_id: row.automation_project_id || null,
    agent_run_id: row.agent_run_id || null,
    actor_user_id: row.actor_user_id || row.owner_user_id,
    event_type: row.event_type,
    event_data: row.event_data || {},
  });
}

export async function createScope(env, auth, body) {
  if (body.engine_id !== "bounty_recon") {
    throw new HttpError(400, "invalid_scope", "Authorized scopes are only supported by the bounty recon engine");
  }
  const scopeKey = text(body.asset_pattern, "asset_pattern", 500).toLowerCase();
  const policyUrl = text(body.policy_url, "policy_url", 1000);
  let integrations = await selectRows(
    env,
    "integration_connections",
    query(auth.household.id, {
      select: "*",
      owner_user_id: `eq.${auth.user.id}`,
      provider: "eq.public_bug_bounty_scope",
      limit: "1",
    }).toString(),
  );
  if (!integrations.length) {
    integrations = [
      await insertRow(env, "integration_connections", {
        household_id: auth.household.id,
        owner_user_id: auth.user.id,
        visibility: "private",
        provider: "public_bug_bounty_scope",
        display_name: "Public authorized program scopes",
        enabled: false,
        allowed_actions: [],
        configuration: { sandbox_only: true },
      }),
    ];
  }
  const scope = await insertRow(env, "authorized_scopes", {
    household_id: auth.household.id,
    owner_user_id: auth.user.id,
    visibility: "private",
    integration_connection_id: integrations[0].id,
    action: "passive_recon",
    scope_key: scopeKey,
    enabled: false,
    constraints: {
      name: text(body.name, "name", 180),
      policy_url: policyUrl,
      allowed_techniques: text(body.allowed_techniques, "allowed_techniques", 1000),
      exclusions: text(body.exclusions, "exclusions", 1000),
      sandbox_only: true,
    },
    expires_at: body.expires_at || null,
  });
  await writeAudit(env, {
    household_id: auth.household.id,
    owner_user_id: auth.user.id,
    actor_user_id: auth.user.id,
    event_type: "scope.created_disabled",
    event_data: { scope_id: scope.id, scope_key: scope.scope_key },
  });
  return scope;
}

export async function createRun(env, auth, body) {
  const requestedEngine = text(body.engine_id, "engine_id", 50);
  if (!hasAdapter(requestedEngine)) {
    throw new HttpError(400, "unsupported_engine", "The requested sandbox engine is not supported");
  }
  if (body.mode && body.mode !== "sandbox") {
    throw new HttpError(403, "sandbox_only", "Only sandbox runs can be created");
  }
  const input = body.input && typeof body.input === "object" && !Array.isArray(body.input)
    ? body.input
    : {};
  const experiment = await insertRow(env, "business_experiments", {
    household_id: auth.household.id,
    owner_user_id: auth.user.id,
    visibility: "private",
    title: `${requestedEngine.replaceAll("_", " ")} sandbox experiment`,
    hypothesis: "A deterministic sandbox workflow can produce useful review artifacts without external side effects.",
    target_customer: "TwinPath household owner reviewing a private business experiment",
    offer: "A private, reviewable artifact package generated without deployment, spending, scanning, disclosure, purchasing, or publishing.",
    status: "proposed",
    validation_method: "Review artifact quality and policy checks inside TwinPath.",
    success_threshold: "The workflow completes with policy-approved artifacts and no external actions.",
    stop_rule: "Stop immediately if any action leaves sandbox mode or fails a policy check.",
    estimated_hours: 1,
    estimated_cost: 0,
    expected_price: requestedEngine === "micro_saas" ? 9 : 0,
    score: 60,
    source_urls: [],
    risks: ["Sandbox output requires human verification before use."],
  });
  const project = await insertRow(env, "automation_projects", {
    household_id: auth.household.id,
    owner_user_id: auth.user.id,
    visibility: "private",
    experiment_id: experiment.id,
    name: `${requestedEngine.replaceAll("_", " ")} sandbox`,
    objective: "Generate deterministic review artifacts without external side effects.",
    mode: "sandbox",
    status: "active",
    instructions: { engine_id: requestedEngine, sandbox_only: true },
  });
  const run = await insertRow(env, "agent_runs", {
    household_id: auth.household.id,
    owner_user_id: auth.user.id,
    visibility: "private",
    automation_project_id: project.id,
    mode: "sandbox",
    status: "queued",
    input: { ...input, engine_id: requestedEngine },
  });
  await writeAudit(env, {
    household_id: auth.household.id,
    owner_user_id: auth.user.id,
    automation_project_id: project.id,
    agent_run_id: run.id,
    actor_user_id: auth.user.id,
    event_type: "run.queued",
    event_data: { engine_id: requestedEngine, mode: "sandbox" },
  });
  return run;
}

export async function markRunEnqueueFailed(env, runId, householdId, message) {
  await updateRows(env, "agent_runs", query(householdId, { id: `eq.${runId}`, status: "eq.queued" }).toString(), {
    status: "failed",
    error_message: String(message).slice(0, 4000),
    finished_at: new Date().toISOString(),
  });
}

export async function cancelRun(env, auth, runId) {
  const rows = await updateRows(
    env,
    "agent_runs",
    query(auth.household.id, {
      id: `eq.${runId}`,
      owner_user_id: `eq.${auth.user.id}`,
      status: "in.(queued,running,awaiting_approval,authorized)",
    }).toString(),
    { status: "cancelled", finished_at: new Date().toISOString(), error_message: "Cancelled by owner." },
  );
  if (rows.length !== 1) {
    throw new HttpError(409, "run_not_cancelable", "Run was not found or is already terminal");
  }
  return rows[0];
}

export async function pauseRun(env, auth, runId) {
  const runs = await selectRows(
    env,
    "agent_runs",
    query(auth.household.id, {
      select: "*",
      id: `eq.${runId}`,
      owner_user_id: `eq.${auth.user.id}`,
      status: "in.(queued,running)",
      limit: "1",
    }).toString(),
  );
  if (runs.length !== 1) {
    throw new HttpError(409, "run_not_pausable", "Run was not found or is no longer active");
  }
  await updateRows(
    env,
    "automation_projects",
    query(auth.household.id, {
      id: `eq.${runs[0].automation_project_id}`,
      owner_user_id: `eq.${auth.user.id}`,
    }).toString(),
    { status: "paused" },
  );
  const rows = await updateRows(
    env,
    "agent_runs",
    query(auth.household.id, { id: `eq.${runId}` }).toString(),
    { status: "cancelled", finished_at: new Date().toISOString(), error_message: "Project paused by owner." },
  );
  return rows[0];
}

export async function decideApproval(env, auth, approvalId, body) {
  const decision = text(body.decision, "decision", 20).toLowerCase();
  const normalized = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : decision;
  if (!["approved", "rejected"].includes(normalized)) {
    throw new HttpError(400, "invalid_decision", "decision must be approved or rejected");
  }
  return supabaseRequest(env, "/rest/v1/rpc/review_agent_approval", {
    method: "POST",
    userToken: auth.token,
    body: JSON.stringify({
      p_approval_id: approvalId,
      p_decision: normalized,
      p_rationale: typeof body.note === "string" ? body.note.slice(0, 1000) : null,
    }),
  });
}

export async function createArtifactSignedUrl(env, auth, artifactId) {
  const rows = await selectRows(
    env,
    "agent_artifacts",
    query(auth.household.id, {
      select: "id,storage_path",
      id: `eq.${artifactId}`,
      owner_user_id: `eq.${auth.user.id}`,
      limit: "1",
    }).toString(),
  );
  if (rows.length !== 1) {
    throw new HttpError(404, "artifact_not_found", "Private artifact was not found");
  }
  const encodedPath = rows[0].storage_path
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  const result = await supabaseRequest(
    env,
    `/storage/v1/object/sign/agent-artifacts/${encodedPath}`,
    {
      method: "POST",
      body: JSON.stringify({ expiresIn: 60 }),
    },
  );
  const signedPath = result?.signedURL || result?.signedUrl;
  if (typeof signedPath !== "string") {
    throw new HttpError(502, "artifact_signing_failed", "Supabase did not return a signed artifact URL");
  }
  return new URL(signedPath, env.SUPABASE_URL).toString();
}

export async function getRun(env, runId, householdId) {
  const rows = await selectRows(env, "agent_runs", query(householdId, { select: "*", id: `eq.${runId}`, limit: "1" }).toString());
  return rows[0] || null;
}

export async function transitionRun(env, runId, householdId, fromStatus, toStatus, changes = {}) {
  const rows = await updateRows(
    env,
    "agent_runs",
    query(householdId, { id: `eq.${runId}`, status: `eq.${fromStatus}` }).toString(),
    { status: toStatus, ...changes },
  );
  return rows[0] || null;
}

export async function persistArtifacts(env, run, fixture) {
  const artifacts = Array.isArray(fixture.artifacts) ? fixture.artifacts : [];
  const created = [];
  for (const artifact of artifacts) {
    const id = crypto.randomUUID();
    const body = JSON.stringify({ ...artifact, fixture_id: fixture.fixture_id }, null, 2);
    const bytes = new TextEncoder().encode(body);
    const path = `${run.household_id}/${run.owner_user_id}/${id}.json`;
    await uploadArtifactObject(env, path, body);
    created.push(
      await insertRow(env, "agent_artifacts", {
        id,
        household_id: run.household_id,
        owner_user_id: run.owner_user_id,
        visibility: "private",
        agent_run_id: run.id,
        artifact_type: String(artifact.type || "sandbox_artifact").slice(0, 80),
        file_name: `${String(artifact.type || "artifact").slice(0, 200)}.json`,
        storage_path: path,
        mime_type: "application/json",
        file_size: bytes.byteLength,
        metadata: {
          engine_id: fixture.adapter,
          title: String(artifact.title || artifact.type || "Sandbox artifact").slice(0, 180),
          confidential: fixture.adapter === "bounty_recon",
          sandbox_only: true,
          redaction_status: fixture.adapter === "bounty_recon" ? "required" : "not_required",
        },
      }),
    );
  }
  const simulatedRevenue = artifacts.find(
    (artifact) => artifact.type === "subscription_event" && artifact.charged === false,
  );
  if (simulatedRevenue && Number(simulatedRevenue.amount) > 0) {
    await insertRow(env, "revenue_events", {
      household_id: run.household_id,
      owner_user_id: run.owner_user_id,
      visibility: "private",
      automation_project_id: run.automation_project_id,
      agent_run_id: run.id,
      source: "sandbox_fixture",
      external_event_id: `${fixture.fixture_id}:${run.id}`,
      mode: "sandbox",
      verification_status: "unverified",
      amount: Number(simulatedRevenue.amount),
      currency: simulatedRevenue.currency || "USD",
      category: "Simulated subscription",
      description: "Sandbox event — not income",
      occurred_at: new Date(0).toISOString(),
      payload: { simulated: true, charged: false },
    });
  }
  return created;
}

export async function listDueSandboxProjects(env, nowIso) {
  const rows = await selectRows(env, "automation_projects", new URLSearchParams({
    select: "*",
    mode: "eq.sandbox",
    status: "eq.active",
    limit: "100",
  }).toString());
  return rows.filter((project) => {
    const due = project.instructions?.next_run_at;
    return due && !Number.isNaN(Date.parse(due)) && due <= nowIso;
  });
}

export async function createScheduledRun(env, project) {
  return insertRow(env, "agent_runs", {
    household_id: project.household_id,
    owner_user_id: project.owner_user_id,
    visibility: project.visibility,
    automation_project_id: project.id,
    mode: "sandbox",
    status: "queued",
    input: { engine_id: project.instructions.engine_id, scheduled: true },
  });
}
