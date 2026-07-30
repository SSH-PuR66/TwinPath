import { log, logError } from "./log.js";
import {
  createScheduledRun,
  listDueSandboxProjects,
  markRunEnqueueFailed,
} from "./persistence-v13.js";
import { syncAutonomousPlaidTransactions } from "./plaid.js";

async function enqueueDueProject(env, project) {
  const run = await createScheduledRun(env, project);
  try {
    await env.AGENT_JOBS.send({
      version: 1,
      kind: "execute_run",
      run_id: run.id,
      household_id: run.household_id,
    });
    return { run_id: run.id, outcome: "queued" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Queue send failed";
    await markRunEnqueueFailed(env, run.id, run.household_id, message);
    throw error;
  }
}

export async function enqueueDueSandboxRuns(event, env) {
  try {
    const due = await listDueSandboxProjects(env, new Date(event.scheduledTime).toISOString());
    const results = await Promise.allSettled(due.map((project) => enqueueDueProject(env, project)));
    const queued = results.filter((result) => result.status === "fulfilled" && result.value.outcome === "queued").length;
    const failed = results.filter((result) => result.status === "rejected").length;
    log("info", "cron_due_runs_processed", { due: due.length, queued, failed, cron: event.cron });
  } catch (error) {
    logError("cron_processing_failed", error, { cron: event.cron });
    throw error;
  }
}

export async function runAutonomousPlaidSync(event, env) {
  try {
    const result = await syncAutonomousPlaidTransactions(env, event.scheduledTime);
    log("info", "cron_plaid_sync_processed", { ...result, cron: event.cron });
    return result;
  } catch (error) {
    logError("cron_plaid_sync_failed", error, { cron: event.cron });
    throw error;
  }
}
