import test from "node:test";
import assert from "node:assert/strict";

import { ADAPTER_NAMES, executeAdapter } from "../src/adapters/index.js";
import { stableStringify } from "../src/adapters/fixtures.js";
import { evaluatePlan } from "../src/policies.js";

test("all required adapters are registered", () => {
  assert.deepEqual([...ADAPTER_NAMES].sort(), [
    "bounty_recon",
    "content_affiliate",
    "digital_assets",
    "micro_saas",
  ]);
});

test("every adapter is deterministic and sandbox-only", () => {
  for (const name of ADAPTER_NAMES) {
    const input = { topic: "alpha", nested: { z: 2, a: 1 } };
    const first = executeAdapter(name, input);
    const second = executeAdapter(name, { nested: { a: 1, z: 2 }, topic: "alpha" });
    assert.deepEqual(first, second);
    assert.equal(first.mode, "sandbox");
    assert.equal(first.external_actions_performed, false);
    assert.equal(evaluatePlan(first.actions).allowed, true);
  }
});

test("stable fixture serialization ignores object key order", () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
});

test("unknown adapters cannot execute", () => {
  assert.throws(() => executeAdapter("live_deployer", {}), /Unknown sandbox adapter/);
});
