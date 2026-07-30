import { executeAdapter, hasAdapter } from "./adapters/index.js";
import { evaluatePlan } from "./policies.js";
import {
  getRun,
  persistArtifacts,
  transitionRun,
} from "./persistence-v13.js";

export async function processRun(env, job) {
  if (!job || typeof job.run_id !== "string" || typeof job.household_id !== "string") {
    throw new Error("Queue job is missing run_id or household_id");
  }
  const run = await getRun(env, job.run_id, job.household_id);
  if (!run) return { outcome: "missing" };
  if (["cancelled", "succeeded", "failed"].includes(run.status)) {
    return { outcome: "already_terminal", status: run.status };
  }
  const adapter = run.input?.engine_id;
  if (run.mode !== "sandbox" || !hasAdapter(adapter)) {
    await transitionRun(env, run.id, run.household_id, run.status, "failed", {
      error_message: "Only registered sandbox adapters can execute.",
      finished_at: new Date().toISOString(),
    });
    return { outcome: "blocked" };
  }

  const claimed = await transitionRun(env, run.id, run.household_id, "queued", "running", {
    started_at: new Date().toISOString(),
  });
  if (!claimed) return { outcome: "not_claimed" };

  try {
    const fixture = executeAdapter(adapter, run.input || {});
    const policy = evaluatePlan(fixture.actions);
    if (!policy.allowed) {
      await transitionRun(env, run.id, run.household_id, "running", "failed", {
        output: { fixture, policy },
        error_message: "The sandbox plan was denied by policy.",
        finished_at: new Date().toISOString(),
      });
      return { outcome: "blocked" };
    }
    const artifacts = await persistArtifacts(env, run, fixture);
    await transitionRun(env, run.id, run.household_id, "running", "succeeded", {
      output: {
        fixture,
        policy,
        engine_id: adapter,
        artifact_ids: artifacts.map((artifact) => artifact.id),
        timeline: [
          { type: "policy", label: "Policy gate", summary: "Sandbox actions allowed." },
          { type: "adapter", label: "Adapter", summary: fixture.summary },
          { type: "artifact", label: "Artifacts", summary: `${artifacts.length} private artifacts stored.` },
        ],
      },
      error_message: null,
      finished_at: new Date().toISOString(),
    });
    return { outcome: "completed" };
  } catch (error) {
    await transitionRun(env, run.id, run.household_id, "running", "failed", {
      error_message: error instanceof Error ? error.message : "Adapter execution failed",
      finished_at: new Date().toISOString(),
    });
    throw error;
  }
}
