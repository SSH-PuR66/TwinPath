import { HttpError } from "./http.js";
import { insertRow, selectRows, supabaseRequest } from "./supabase.js";

export const PROPOSAL_KINDS = new Set([
  "new_button",
  "hidden_route",
  "theme",
  "connector",
  "copy_change",
  "config",
]);

const FLAG_KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]{1,79}$/;

function requiredText(value, field, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new HttpError(
      400,
      "invalid_field",
      `${field} is required and must be at most ${max} characters`,
    );
  }
  return value.trim();
}

export function validateProposalInput(body) {
  const kind = requiredText(body.kind, "kind", 40).toLowerCase();
  if (!PROPOSAL_KINDS.has(kind)) {
    throw new HttpError(
      400,
      "invalid_kind",
      `kind must be one of: ${[...PROPOSAL_KINDS].join(", ")}`,
    );
  }
  const title = requiredText(body.title, "title", 160);
  const rationale = requiredText(body.rationale, "rationale", 2000);

  let flagKey = null;
  if (body.flag_key !== undefined && body.flag_key !== null) {
    if (
      typeof body.flag_key !== "string"
      || !FLAG_KEY_PATTERN.test(body.flag_key)
    ) {
      throw new HttpError(
        400,
        "invalid_flag_key",
        "flag_key must be 2-80 chars of lowercase letters, digits, dot, dash, or underscore",
      );
    }
    flagKey = body.flag_key;
  }

  let payload = {};
  if (body.payload !== undefined && body.payload !== null) {
    if (
      typeof body.payload !== "object"
      || Array.isArray(body.payload)
    ) {
      throw new HttpError(400, "invalid_payload", "payload must be an object");
    }
    const serialized = JSON.stringify(body.payload);
    if (serialized.length > 8000) {
      throw new HttpError(400, "invalid_payload", "payload must be at most 8000 characters serialized");
    }
    payload = JSON.parse(serialized);
  }

  return { kind, title, rationale, flag_key: flagKey, payload };
}

export async function listProposals(env, auth, statusFilter) {
  const params = new URLSearchParams({
    select: "id,kind,title,rationale,payload,flag_key,status,origin,track,decision_note,decided_at,created_at",
    household_id: `eq.${auth.household.id}`,
    order: "created_at.desc",
    limit: "50",
  });
  if (statusFilter && ["pending", "approved", "rejected", "superseded"].includes(statusFilter)) {
    params.set("status", `eq.${statusFilter}`);
  }
  return selectRows(env, "agent_proposals", params.toString());
}

export async function createProposal(env, auth, body) {
  const validated = validateProposalInput(body);
  return insertRow(env, "agent_proposals", {
    household_id: auth.household.id,
    created_by: auth.user.id,
    origin: "user",
    ...validated,
  });
}

export async function decideProposal(env, auth, proposalId, body) {
  const decision = requiredText(body.decision, "decision", 20).toLowerCase();
  const normalized = decision === "approve"
    ? "approved"
    : decision === "reject"
      ? "rejected"
      : decision;
  if (!["approved", "rejected"].includes(normalized)) {
    throw new HttpError(400, "invalid_decision", "decision must be approved or rejected");
  }
  return supabaseRequest(env, "/rest/v1/rpc/decide_agent_proposal", {
    method: "POST",
    userToken: auth.token,
    body: JSON.stringify({
      p_proposal_id: proposalId,
      p_decision: normalized,
      p_note: typeof body.note === "string" ? body.note.slice(0, 1000) : null,
    }),
  });
}

export async function markDepositTransfersComplete(env, auth, proposalId, body) {
  const proposals = await selectRows(env, "agent_proposals", new URLSearchParams({
    select: "id,status,payload,decision_note",
    id: `eq.${proposalId}`,
    household_id: `eq.${auth.household.id}`,
    limit: "1",
  }).toString());
  const proposal = proposals[0];
  if (!proposal || proposal.status !== "approved" || proposal.payload?.source !== "deposit_watch") {
    throw new HttpError(404, "proposal_not_found", "Approved deposit proposal was not found");
  }
  const completed = body.completed === true;
  return supabaseRequest(env, `/rest/v1/agent_proposals?id=eq.${encodeURIComponent(proposalId)}&household_id=eq.${auth.household.id}`,
    { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ decision_note: completed ? "completed_transfers" : null }) },
  ).then((rows) => rows?.[0]);
}

export async function listFlags(env, auth) {
  const params = new URLSearchParams({
    select: "flag_key,enabled,payload,updated_at",
    household_id: `eq.${auth.household.id}`,
    order: "flag_key.asc",
    limit: "200",
  });
  return selectRows(env, "feature_flags", params.toString());
}
