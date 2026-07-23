import test from "node:test";
import assert from "node:assert/strict";

import { allocateWaterfall } from "../src/benefits.js";
import { buildDepositProposal } from "../src/deposit-watch.js";

test("deposit proposal is well-formed and human-readable", () => {
  const txn = {
    id: "11111111-1111-1111-1111-111111111111",
    household_id: "22222222-2222-2222-2222-222222222222",
    amount: "150.00",
    description: "CVS cash deposit",
  };
  const steps = allocateWaterfall(150, { emergency_balance: 0 });
  const proposal = buildDepositProposal(txn, steps);

  assert.equal(proposal.kind, "config");
  assert.equal(proposal.origin, "agent");
  assert.equal(proposal.status, "pending");
  assert.match(proposal.title, /\$150/);
  assert.match(proposal.rationale, /CVS cash deposit/);
  assert.match(proposal.rationale, /you make the actual transfers/i);
  assert.equal(proposal.payload.source_transaction_id, txn.id);
  assert.equal(proposal.payload.amount, 150);
  const routed = proposal.payload.steps.reduce((sum, step) => sum + step.amount, 0);
  assert.equal(Math.round(routed * 100) / 100, 150);
});

test("proposal fields respect schema length limits", () => {
  const txn = {
    id: "id",
    household_id: "hh",
    amount: 99999.99,
    description: "x".repeat(400),
  };
  const proposal = buildDepositProposal(txn, allocateWaterfall(99999.99, {}));
  assert.ok(proposal.title.length <= 160);
  assert.ok(proposal.rationale.length <= 2000);
});
