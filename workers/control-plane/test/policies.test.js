import test from "node:test";
import assert from "node:assert/strict";

import { BLOCKED_ACTIONS, evaluateAction, evaluatePlan } from "../src/policies.js";

test("categorically blocks every live-capability action even in sandbox", () => {
  for (const kind of BLOCKED_ACTIONS) {
    const decision = evaluateAction({ kind, mode: "sandbox" });
    assert.equal(decision.allowed, false);
    assert.equal(decision.code, "live_action_categorically_blocked");
    assert.equal(decision.requirement, "future_explicit_configuration_and_fresh_approval");
  }
});

test("blocks all non-sandbox modes before execution", () => {
  assert.deepEqual(evaluateAction({ kind: "analyze", mode: "live" }), {
    allowed: false,
    code: "sandbox_only",
    action: { kind: "analyze", mode: "live" },
    requirement: "future_explicit_configuration_and_fresh_approval",
  });
});

test("allows only a non-empty plan of allowlisted sandbox actions", () => {
  assert.equal(evaluatePlan(["analyze", "draft"]).allowed, true);
  assert.equal(evaluatePlan([]).allowed, false);
  assert.equal(evaluatePlan(["analyze", "email"]).allowed, false);
});

test("policy never enables external actions", () => {
  const decision = evaluatePlan(["simulate"]);
  assert.equal(decision.allowed, true);
  assert.equal(decision.external_actions_enabled, false);
});
