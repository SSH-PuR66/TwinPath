import test from "node:test";
import assert from "node:assert/strict";

import { PROPOSAL_KINDS, validateProposalInput } from "../src/proposals.js";

test("proposal kinds are a closed allowlist", () => {
  assert.ok(PROPOSAL_KINDS.has("hidden_route"));
  assert.ok(PROPOSAL_KINDS.has("new_button"));
  assert.ok(!PROPOSAL_KINDS.has("run_arbitrary_code"));
});

test("valid proposal input normalizes cleanly", () => {
  const result = validateProposalInput({
    kind: "Hidden_Route",
    title: "  Twins prep route  ",
    rationale: "Dedicated checklist for the twins arriving late December.",
    flag_key: "route.twins-prep",
    payload: { path: "/twins-prep" },
  });
  assert.equal(result.kind, "hidden_route");
  assert.equal(result.title, "Twins prep route");
  assert.equal(result.flag_key, "route.twins-prep");
  assert.deepEqual(result.payload, { path: "/twins-prep" });
});

test("unknown kinds are rejected", () => {
  assert.throws(
    () => validateProposalInput({
      kind: "surprise",
      title: "nope",
      rationale: "nope nope",
    }),
    /kind must be one of/,
  );
});

test("flag keys must match the safe pattern", () => {
  assert.throws(
    () => validateProposalInput({
      kind: "config",
      title: "Bad flag",
      rationale: "Flag key with invalid characters must fail.",
      flag_key: "Route/../Escape",
    }),
    /flag_key/,
  );
});

test("payload must be a bounded plain object", () => {
  assert.throws(
    () => validateProposalInput({
      kind: "config",
      title: "Bad payload",
      rationale: "Arrays are not accepted as payloads.",
      payload: ["not", "an", "object"],
    }),
    /payload must be an object/,
  );
  assert.throws(
    () => validateProposalInput({
      kind: "config",
      title: "Huge payload",
      rationale: "Oversized payloads must be rejected.",
      payload: { blob: "x".repeat(9000) },
    }),
    /at most 8000/,
  );
});
