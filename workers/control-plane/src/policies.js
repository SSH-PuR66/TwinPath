export const BLOCKED_ACTIONS = Object.freeze([
  "charge",
  "deploy",
  "spend",
  "disclose",
  "payment",
  "payout",
  "purchase",
  "publish",
  "transfer",
  "withdraw",
]);

const SAFE_SANDBOX_ACTIONS = new Set([
  "analyze",
  "draft",
  "evaluate",
  "generate_fixture",
  "simulate",
  "summarize",
]);

export function normalizeAction(action) {
  if (typeof action === "string") {
    return { kind: action.trim().toLowerCase(), mode: "sandbox" };
  }
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return { kind: "", mode: "" };
  }
  return {
    kind: typeof action.kind === "string" ? action.kind.trim().toLowerCase() : "",
    mode: typeof action.mode === "string" ? action.mode.trim().toLowerCase() : "sandbox",
  };
}

export function evaluateAction(action) {
  const normalized = normalizeAction(action);
  if (!normalized.kind) {
    return { allowed: false, code: "invalid_action", action: normalized };
  }
  if (normalized.mode !== "sandbox") {
    return {
      allowed: false,
      code: "sandbox_only",
      action: normalized,
      requirement: "future_explicit_configuration_and_fresh_approval",
    };
  }
  if (BLOCKED_ACTIONS.includes(normalized.kind)) {
    return {
      allowed: false,
      code: "live_action_categorically_blocked",
      action: normalized,
      requirement: "future_explicit_configuration_and_fresh_approval",
    };
  }
  if (!SAFE_SANDBOX_ACTIONS.has(normalized.kind)) {
    return { allowed: false, code: "action_not_allowlisted", action: normalized };
  }
  return { allowed: true, code: "sandbox_action_allowed", action: normalized };
}

export function evaluatePlan(actions) {
  const decisions = Array.isArray(actions) ? actions.map(evaluateAction) : [];
  const denied = decisions.filter((decision) => !decision.allowed);
  return {
    allowed: decisions.length > 0 && denied.length === 0,
    decisions,
    denied,
    external_actions_enabled: false,
  };
}
