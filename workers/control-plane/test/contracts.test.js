import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../../../", import.meta.url);

async function read(path) {
  return readFile(new URL(path, root), "utf8");
}

test("migration enforces household RLS and immutable audit events", async () => {
  const sql = await read("supabase/v13-autonomous-operations.sql");
  assert.match(sql, /alter table public\.agent_runs enable row level security/i);
  assert.match(sql, /can_access_record\(household_id, owner_user_id, visibility\)/i);
  assert.match(sql, /Agent audit events are append-only/i);
  assert.match(sql, /prevent_record_reassignment/i);
});

test("revenue posting is idempotent and rejects simulated events", async () => {
  const sql = await read("supabase/v13-autonomous-operations.sql");
  assert.match(sql, /unique \(owner_user_id, source, external_event_id\)/i);
  assert.match(sql, /selected_event\.mode <> 'live'/i);
  assert.match(sql, /selected_event\.verification_status <> 'verified'/i);
  assert.match(sql, /selected_event\.transaction_id is not null/i);
});

test("Worker derives household scope from authenticated membership", async () => {
  const [auth, persistence] = await Promise.all([
    read("workers/control-plane/src/auth.js"),
    read("workers/control-plane/src/persistence-v13.js"),
  ]);
  assert.match(auth, /household_members|HOUSEHOLD_MEMBERS_TABLE/);
  assert.match(auth, /user_id: `eq\.\$\{user\.id\}`/);
  assert.match(persistence, /household_id: `eq\.\$\{householdId\}`/);
  assert.doesNotMatch(persistence, /body\.household_id|body\.owner_user_id/);
});

test("sandbox artifacts are private and evidence requires redaction", async () => {
  const persistence = await read("workers/control-plane/src/persistence-v13.js");
  assert.match(persistence, /visibility: "private"/);
  assert.match(persistence, /fixture\.adapter === "bounty_recon"/);
  assert.match(persistence, /redaction_status/);
});

test("financial provider secrets are service-only and ledger posts are verified", async () => {
  const sql = await read("supabase/v15-financial-integrations.sql");
  assert.match(sql, /encrypted_access_token text/i);
  assert.match(sql, /revoke all on public\.plaid_items[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /record_revenue_event_transaction[\s\S]*verified live USD Stripe revenue/i);
  assert.match(sql, /provider_webhook_events[\s\S]*verification_status/i);
  assert.match(
    sql,
    /on public\.transactions\(household_id, external_source, external_id\)/i,
  );
});

test("provider runtime and frontend contracts use the same routes", async () => {
  const [worker, panel] = await Promise.all([
    read("workers/control-plane/src/index.js"),
    read("src/FinancialConnectionsPanel.jsx"),
  ]);
  for (const route of [
    "/v1/financial/connections",
    "/v1/financial/plaid/link-token",
    "/v1/financial/plaid/exchange",
  ]) {
    assert.match(worker, new RegExp(route.replaceAll("/", "\\/")));
    assert.match(panel, new RegExp(route.replaceAll("/", "\\/")));
  }
  assert.match(worker, /\/v1\/billing\/checkout/);
  assert.match(worker, /\/v1\/billing\/portal/);
  assert.match(worker, /getStripeCustomer/);
  assert.match(
    worker,
    /portal_ready:\s*readiness\.stripe\.ready\s*&&\s*Boolean\(stripeCustomer\)/,
  );
  assert.match(panel, /\/v1\/billing\/\$\{kind\}/);
});

test("approval wallet policies cache auth context and keep the RPC scoped", async () => {
  const [migration, rpc] = await Promise.all([
    read("supabase/migrations/20260721202311_wallet_rls_initplan_optimization.sql"),
    read("supabase/v7-budget-enforcement.sql"),
  ]);
  assert.match(migration, /owner_user_id = \(select auth\.uid\(\)\)/i);
  assert.match(
    migration,
    /is_household_member\([\s\S]*?\(select auth\.uid\(\)\)[\s\S]*?\)/i,
  );
  assert.doesNotMatch(migration, /owner_user_id = auth\.uid\(\)/i);
  assert.match(rpc, /security definer[\s\S]*set search_path = ''/i);
  assert.match(rpc, /owner_user_id = current_user_id/i);
});
