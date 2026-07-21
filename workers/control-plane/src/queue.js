import { log, logError } from "./log.js";
import { processRun } from "./orchestrator.js";

async function consumeMessage(message, env) {
  try {
    const result = await processRun(env, message.body);
    message.ack();
    log("info", "queue_job_processed", {
      message_id: message.id,
      run_id: message.body?.run_id,
      outcome: result.outcome,
    });
  } catch (error) {
    message.retry();
    logError("queue_job_failed", error, {
      message_id: message.id,
      run_id: message.body?.run_id,
    });
  }
}

export async function consumeAgentJobs(batch, env) {
  await Promise.all(batch.messages.map((message) => consumeMessage(message, env)));
}
