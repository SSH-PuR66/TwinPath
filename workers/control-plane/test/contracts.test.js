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
