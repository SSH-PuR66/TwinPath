import { HttpError } from "./http.js";
import { financialSummary } from "./imports.js";
import { selectRows, upsertRows } from "./supabase.js";

const ENROLLMENT_STATUSES = new Set([
  "researching",
  "eligible_likely",
  "applied",
  "approved",
  "denied",
  "renewing",
  "not_eligible",
]);
const TRACKS = new Set(["household", "cyber", "nursing"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listBenefits(env, auth) {
  const [programs, enrollments] = await Promise.all([
    selectRows(
      env,
      "benefit_programs",
      new URLSearchParams({
        select: "key,name,category,jurisdiction,est_value_note,eligibility_summary,how_to_apply,official_url",
        active: "eq.true",
        order: "category.asc,name.asc",
        limit: "100",
      }).toString(),
    ),
    selectRows(
      env,
      "benefit_enrollments",
      new URLSearchParams({
        select: "program_key,status,next_deadline_on,est_annual_value,notes,checklist,track,updated_at",
        household_id: `eq.${auth.household.id}`,
        limit: "100",
      }).toString(),
    ),
  ]);
  const byKey = new Map(enrollments.map((row) => [row.program_key, row]));
  const tracked_annual_value = enrollments
    .filter((row) => ["approved", "renewing"].includes(row.status))
    .reduce((total, row) => total + (Number(row.est_annual_value) || 0), 0);
  return {
    programs: programs.map((program) => ({
      ...program,
      enrollment: byKey.get(program.key) || null,
    })),
    tracked_annual_value: Math.round(tracked_annual_value * 100) / 100,
    disclaimer:
      "Educational summaries, not financial or legal advice. Verify eligibility with each program.",
  };
}

export async function upsertEnrollment(env, auth, body) {
  if (typeof body.program_key !== "string" || !/^[a-z0-9][a-z0-9_.-]{1,60}$/.test(body.program_key)) {
    throw new HttpError(400, "invalid_program", "program_key is required");
  }
  const status = typeof body.status === "string" ? body.status : "researching";
  if (!ENROLLMENT_STATUSES.has(status)) {
    throw new HttpError(400, "invalid_status", `status must be one of: ${[...ENROLLMENT_STATUSES].join(", ")}`);
  }
  const estValue = body.est_annual_value === undefined ? 0 : Number(body.est_annual_value);
  if (!Number.isFinite(estValue) || estValue < 0 || estValue > 1_000_000) {
    throw new HttpError(400, "invalid_value", "est_annual_value must be a non-negative number");
  }
  let deadline = null;
  if (body.next_deadline_on) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.next_deadline_on))) {
      throw new HttpError(400, "invalid_deadline", "next_deadline_on must be YYYY-MM-DD");
    }
    deadline = body.next_deadline_on;
  }
  let checklist = [];
  if (body.checklist !== undefined) {
    if (
      !Array.isArray(body.checklist)
      || body.checklist.length > 30
      || !body.checklist.every(
        (item) => typeof item === "object" && item !== null
          && typeof item.label === "string" && item.label.length <= 160
          && typeof item.done === "boolean"
          && (item.done_by === undefined || item.done_by === null || UUID_PATTERN.test(item.done_by)),
      )
    ) {
      throw new HttpError(400, "invalid_checklist", "checklist must be up to 30 {label, done} items");
    }
    checklist = body.checklist.map((item) => ({
      label: item.label,
      done: item.done,
      done_by: item.done ? (item.done_by || auth.user.id) : null,
    }));
  }
  const track = typeof body.track === "string" ? body.track : "household";
  if (!TRACKS.has(track)) {
    throw new HttpError(400, "invalid_track", "track must be household, cyber, or nursing");
  }
  const rows = await upsertRows(
    env,
    "benefit_enrollments",
    [{
      household_id: auth.household.id,
      program_key: body.program_key,
      status,
      est_annual_value: estValue,
      next_deadline_on: deadline,
      notes: typeof body.notes === "string" ? body.notes.slice(0, 2000) : null,
      checklist,
      track,
      updated_at: new Date().toISOString(),
    }],
    "household_id,program_key",
  );
  return rows[0];
}

const round = (value) => Math.round(value * 100) / 100;

export function allocateWaterfall(amount, context = {}) {
  const emergencyTarget = context.emergency_target ?? 500;
  const emergencyBalance = context.emergency_balance ?? 0;
  const hasMatchedProgram = Boolean(context.has_matched_program);
  const twinsFundActive = context.twins_fund_active !== false;

  const steps = [];
  let remaining = amount;

  const emergencyGap = Math.max(0, emergencyTarget - emergencyBalance);
  if (emergencyGap > 0 && remaining > 0) {
    const portion = round(Math.min(remaining, Math.max(remaining * 0.5, Math.min(remaining, 10))));
    steps.push({
      bucket: "emergency_buffer",
      amount: portion,
      why: `Starter emergency buffer is $${round(emergencyBalance)} of a $${emergencyTarget} target. Cash on hand prevents debt when surprises hit — this comes first.`,
    });
    remaining = round(remaining - portion);
  }

  if (hasMatchedProgram && remaining > 0) {
    const portion = round(remaining * 0.5);
    if (portion > 0) {
      steps.push({
        bucket: "matched_savings",
        amount: portion,
        why: "You're tracking a matched-savings program (IDA or Saver's Credit-eligible IRA). Matched dollars are an instant guaranteed return no market can beat.",
      });
      remaining = round(remaining - portion);
    }
  }

  if (twinsFundActive && remaining > 0) {
    const portion = round(remaining * 0.6);
    if (portion > 0) {
      steps.push({
        bucket: "twins_fund",
        amount: portion,
        why: "Twins arrive around late December — pre-funding gear, diapers, and the first months now converts small deposits into calm later.",
      });
      remaining = round(remaining - portion);
    }
  }

  if (remaining > 0) {
    steps.push({
      bucket: "roth_ira",
      amount: round(remaining),
      why: "Long-horizon bucket. At 18-19, dollars here have ~45 years of tax-free compounding; contributions remain withdrawable if truly needed.",
    });
    remaining = 0;
  }

  return steps;
}

export async function allocateAmount(env, auth, body) {
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
    throw new HttpError(400, "invalid_amount", "amount must be a positive number");
  }

  const [summary, enrollments] = await Promise.all([
    financialSummary(env, auth).catch(() => null),
    selectRows(
      env,
      "benefit_enrollments",
      new URLSearchParams({
        select: "program_key,status,next_deadline_on",
        household_id: `eq.${auth.household.id}`,
        limit: "100",
      }).toString(),
    ).catch(() => []),
  ]);

  const hasMatchedProgram = enrollments.some(
    (row) => ["ida_match", "roth_ira", "savers_credit"].includes(row.program_key)
      && !["denied", "not_eligible"].includes(row.status),
  );

  const emergencyBalance = body.emergency_balance !== undefined
    ? Number(body.emergency_balance) || 0
    : 0;
  const emergencyKnown = body.emergency_balance !== undefined;

  const steps = allocateWaterfall(round(amount), {
    emergency_balance: emergencyBalance,
    emergency_target: 500,
    has_matched_program: hasMatchedProgram,
    twins_fund_active: true,
  });

  const upcomingDeadlines = enrollments
    .filter((row) => row.next_deadline_on)
    .sort((a, b) => String(a.next_deadline_on).localeCompare(String(b.next_deadline_on)))
    .slice(0, 3)
    .map((row) => ({ program_key: row.program_key, next_deadline_on: row.next_deadline_on }));

  return {
    amount: round(amount),
    steps,
    context: {
      emergency_balance_known: emergencyKnown,
      matched_program_tracked: hasMatchedProgram,
      last_90d_net: summary ? summary.net : null,
      upcoming_benefit_deadlines: upcomingDeadlines,
    },
    disclaimer:
      "Educational default routing, not financial advice. You decide every actual transfer — TwinPath never moves money.",
  };
}
