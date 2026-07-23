import { allocateWaterfall } from "./benefits.js";
import { log, logError } from "./log.js";
import { insertRow, selectRows } from "./supabase.js";

const MIN_DEPOSIT = 25;
const LOOKBACK_MINUTES = 30;
const MAX_PROPOSALS_PER_RUN = 5;

const round = (value) => Math.round(value * 100) / 100;

export function buildDepositProposal(txn, steps) {
  const routed = steps
    .map((step) => `$${step.amount} → ${step.bucket.replaceAll("_", " ")}`)
    .join(", ");
  return {
    household_id: txn.household_id,
    origin: "agent",
    kind: "config",
    title: `Route your $${round(Number(txn.amount))} deposit`.slice(0, 160),
    rationale: `New income detected (${String(txn.description || txn.title || "deposit").slice(0, 120)}). Suggested split: ${routed}. Approve to log this plan — you make the actual transfers.`.slice(0, 2000),
    payload: {
      source: "deposit_watch",
      source_transaction_id: txn.id,
      amount: round(Number(txn.amount)),
      steps,
    },
    flag_key: null,
    status: "pending",
  };
}

export async function watchDeposits(event, env) {
  try {
    const sinceIso = new Date(
      new Date(event.scheduledTime).getTime() - LOOKBACK_MINUTES * 60 * 1000,
    ).toISOString();

    const deposits = await selectRows(
      env,
      "transactions",
      new URLSearchParams({
        select: "id,household_id,amount,description,title,created_at",
        kind: "eq.income",
        amount: `gte.${MIN_DEPOSIT}`,
        created_at: `gte.${sinceIso}`,
        order: "created_at.desc",
        limit: "20",
      }).toString(),
    );

    if (deposits.length === 0) {
      return { checked: 0, proposed: 0 };
    }

    let proposed = 0;
    for (const txn of deposits.slice(0, MAX_PROPOSALS_PER_RUN)) {
      const existing = await selectRows(
        env,
        "agent_proposals",
        new URLSearchParams({
          select: "id",
          household_id: `eq.${txn.household_id}`,
          "payload->>source_transaction_id": `eq.${txn.id}`,
          limit: "1",
        }).toString(),
      );
      if (existing.length > 0) continue;

      const steps = allocateWaterfall(round(Number(txn.amount)), {
        emergency_balance: 0,
        emergency_target: 500,
        has_matched_program: false,
        twins_fund_active: true,
      });
      await insertRow(env, "agent_proposals", buildDepositProposal(txn, steps));
      proposed += 1;
    }

    log("info", "deposit_watch_processed", {
      checked: deposits.length,
      proposed,
      cron: event.cron,
    });
    return { checked: deposits.length, proposed };
  } catch (error) {
    logError("deposit_watch_failed", error, { cron: event.cron });
    return { checked: 0, proposed: 0, error: true };
  }
}
