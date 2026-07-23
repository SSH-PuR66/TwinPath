import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  normalizePlaidLiabilities,
  normalizePlaidRecurringStreams,
} from "../src/plaid.js";

const root = new URL("../../../", import.meta.url);
const read = (file) => readFile(new URL(file, root), "utf8");

test("optional Plaid streams normalize to a minimal read-only persistence shape", () => {
  assert.deepEqual(normalizePlaidLiabilities({
    liabilities: { credit: [{ account_id: "acct_1", current_balance: 44.2, minimum_payment_amount: 15, next_payment_due_date: "2026-08-01" }] },
  }), [{
    account_id: "acct_1", liability_type: "credit", current_balance: 44.2,
    minimum_payment: 15, next_payment_due_date: "2026-08-01", interest_rate: null, currency: null,
  }]);
  assert.deepEqual(normalizePlaidRecurringStreams({
    outflow_streams: [{ stream_id: "stream_1", description: "Phone", average_amount: { amount: 55 }, predicted_next_date: "2026-08-02" }],
  }), [{
    stream_id: "stream_1", account_id: null, kind: "outflow", description: "Phone",
    merchant_name: null, average_amount: 55, frequency: null, last_date: null,
    next_date: "2026-08-02", currency: null,
  }]);
});

test("optional product migration is household-scoped and service-role only", async () => {
  const migration = await read("supabase/v18-plaid-product-streams.sql");
  assert.match(migration, /plaid_product_sync_status/);
  assert.match(migration, /plaid_liabilities/);
  assert.match(migration, /plaid_recurring_streams/);
  assert.match(migration, /force row level security/i);
  assert.match(migration, /grant select, insert, update, delete[\s\S]*to service_role/i);
  assert.match(migration, /Plaid product record must match its item household and owner/i);
});

test("optional product sync remains read-only and does not block Transactions", async () => {
  const plaid = await read("workers/control-plane/src/plaid.js");
  assert.match(plaid, /await applyPlaidTransactions[\s\S]*await syncOptionalProducts/);
  assert.match(plaid, /status: "unavailable"/);
  assert.doesNotMatch(plaid, /\/transfer\/|\/payment\/|\/auth\/get/);
});
