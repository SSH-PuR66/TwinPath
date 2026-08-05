-- ============================================================================
-- TENANT ISOLATION HARNESS  —  TwinPath / Supabase RLS
-- ============================================================================
-- Proves that a signed-in user of one household cannot read, write, update, or
-- delete another household's rows — at the POLICY layer, exercised as the real
-- `authenticated` Postgres role with a simulated JWT, not just by reading the
-- policy text and trusting it.
--
-- TWO PARTS:
--   Part 1  DENY-ALL PROOF   — safe on ANY environment incl. production.
--                              No seeding; reads only; rolls back.
--   Part 2  TWO-TENANT PROBE — seeds two synthetic tenants (incl. auth.users),
--                              so run it on a BRANCH or local `supabase start`,
--                              NOT production. Rolls back via a sentinel raise
--                              so nothing persists even on success.
--
-- Both parts abort with a RAISE at the end. That is intentional: the raise
-- rolls the whole transaction back, and the verdict string rides out in the
-- error message. A harness that leaves rows behind is a harness you stop
-- trusting.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- PART 1 — DENY-ALL PROOF  (production-safe)
-- ---------------------------------------------------------------------------
-- Ten tables have RLS enabled with NO policy (stripe_customers, all plaid_*,
-- the financial_provider_* set). "RLS on, no policy" should mean deny-all to
-- authenticated. This proves it — and in fact proves something stronger: the
-- table-level GRANT to `authenticated` is absent too, so the role can't even
-- reference the table. Two independent layers.
do $$
declare
  tbls text[] := array[
    'stripe_customers','financial_provider_credentials','financial_provider_sync_cursors',
    'financial_provider_webhook_events','plaid_items','plaid_liabilities',
    'plaid_product_sync_status','plaid_recurring_streams','plaid_transactions',
    'provider_webhook_events'];
  t text; c bigint; v text := '';
begin
  perform set_config('request.jwt.claims',
    '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
  set local role authenticated;
  foreach t in array tbls loop
    begin
      execute format('select count(*) from public.%I', t) into c;
      v := v || t || '=VISIBLE(' || c || ')[FAIL] ';
    exception
      when insufficient_privilege then v := v || t || '=no-grant[PASS] ';
      when others then v := v || t || '=deny[PASS] ';
    end;
  end loop;
  reset role;
  raise exception 'DENY_ALL_PROOF :: %', v;
end $$;
-- Observed result (production, 2026-08-04): all ten =no-grant[PASS].


-- ---------------------------------------------------------------------------
-- PART 2 — TWO-TENANT PROBE  (branch / local ONLY — seeds auth.users)
-- ---------------------------------------------------------------------------
-- Alice owns Tenant A. Bob owns Tenant B. They share nothing. Every cross-tenant
-- path is exercised as the real authenticated role with each user's JWT.
do $$
declare
  alice uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  bob   uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  hhA uuid := '1a1a1a1a-0000-0000-0000-000000000001';
  hhB uuid := '2b2b2b2b-0000-0000-0000-000000000002';
  v text := '';
  n int;
begin
  -- seed auth.users (minimal). Local/branch only.
  insert into auth.users (id, aud, role, email)
    values (alice,'authenticated','authenticated','alice@harness.test'),
           (bob,  'authenticated','authenticated','bob@harness.test');

  insert into households(id,name,invite_code,created_by) values
    (hhA,'Tenant A','AAAA1111',alice),(hhB,'Tenant B','BBBB2222',bob);
  insert into household_members(household_id,user_id,role) values
    (hhA,alice,'owner'),(hhB,bob,'owner');
  insert into tasks(household_id,owner_user_id,visibility,title) values
    (hhA,alice,'shared','A-shared'),(hhA,alice,'private','A-private'),
    (hhB,bob,'shared','B-shared');

  set local role authenticated;

  -- ===== as BOB (member of B only) =====
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', bob), true);

  execute 'select count(*) from tasks where household_id=$1' into n using hhA;
  v := v || format('bob_sees_A=%s[%s] ', n, case when n=0 then 'PASS' else 'FAIL' end);
  execute 'select count(*) from tasks where household_id=$1' into n using hhB;
  v := v || format('bob_sees_B=%s[%s] ', n, case when n=1 then 'PASS' else 'FAIL' end);

  begin  -- INSERT into A must be blocked by WITH CHECK
    insert into tasks(household_id,owner_user_id,visibility,title) values (hhA,bob,'shared','intrusion');
    v := v || 'bob_insert_A=ALLOWED[FAIL] ';
  exception when others then v := v || 'bob_insert_A=rejected[PASS] '; end;

  execute 'update tasks set title=''hijacked'' where household_id=$1' using hhA;
  get diagnostics n = row_count;
  v := v || format('bob_update_A=%s[%s] ', n, case when n=0 then 'PASS' else 'FAIL' end);

  execute 'delete from tasks where household_id=$1' using hhA;
  get diagnostics n = row_count;
  v := v || format('bob_delete_A=%s[%s] ', n, case when n=0 then 'PASS' else 'FAIL' end);

  -- ===== as ALICE (owner of A) =====
  perform set_config('request.jwt.claims', format('{"sub":"%s","role":"authenticated"}', alice), true);
  execute 'select count(*) from tasks where household_id=$1' into n using hhA;
  v := v || format('alice_sees_A=%s[%s] ', n, case when n=2 then 'PASS' else 'FAIL' end);  -- shared + own private
  execute 'select count(*) from tasks where household_id=$1' into n using hhB;
  v := v || format('alice_sees_B=%s[%s] ', n, case when n=0 then 'PASS' else 'FAIL' end);

  reset role;
  raise exception 'TENANT_ISOLATION :: %', v;
end $$;
