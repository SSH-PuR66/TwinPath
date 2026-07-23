import test from "node:test";
import assert from "node:assert/strict";

import { allocateWaterfall } from "../src/benefits.js";

function total(steps) {
  return Math.round(steps.reduce((sum, step) => sum + step.amount, 0) * 100) / 100;
}

test("every allocated dollar is accounted for", () => {
  for (const amount of [15, 0.5, 100, 1234.56]) {
    const steps = allocateWaterfall(amount, { emergency_balance: 0 });
    assert.equal(total(steps), amount);
    assert.ok(steps.every((step) => step.amount > 0));
    assert.ok(steps.every((step) => typeof step.why === "string" && step.why.length > 10));
  }
});

test("$15 deposit with empty emergency fund routes there first", () => {
  const steps = allocateWaterfall(15, { emergency_balance: 0 });
  assert.equal(steps[0].bucket, "emergency_buffer");
  assert.ok(steps[0].amount >= 7.5);
});

test("full emergency fund skips that bucket", () => {
  const steps = allocateWaterfall(50, { emergency_balance: 500 });
  assert.ok(!steps.some((step) => step.bucket === "emergency_buffer"));
});

test("matched programs claim priority after the buffer", () => {
  const steps = allocateWaterfall(100, {
    emergency_balance: 500,
    has_matched_program: true,
  });
  assert.equal(steps[0].bucket, "matched_savings");
});

test("remainder always lands in the long-horizon bucket", () => {
  const steps = allocateWaterfall(100, { emergency_balance: 500 });
  assert.equal(steps[steps.length - 1].bucket, "roth_ira");
});
