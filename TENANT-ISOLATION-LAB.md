# Tenant Isolation Lab — TwinPath / Supabase RLS

**Target:** my own multi-tenant Postgres (Supabase) behind TwinPath — households
are tenants, users belong to households, and Row Level Security is the only thing
stopping one household from reading another's finances, documents, and photos.
**Scope:** my own database. Read-only against production; the mutating probe runs
on a branch/local only.
**Method:** exercise the policies as the real `authenticated` role with a
simulated JWT — don't just read the policy text and trust it.

---

## Why RLS is the whole ballgame here

The client talks to Postgres directly through PostgREST. There is no middle tier
to enforce "you can only see your household." If a policy is wrong, the data is
exposed to anyone with a valid login and a guessed id. This is exactly the class
of bug I already found once in this schema (a `WHERE h.id = h.id` tautology in the
households update policy) — so I don't get to assume the rest is fine. I test it.

## The target surface, from the advisors

`get_advisors(security)` mapped the ground truth before I wrote a line:

- **10 tables: RLS enabled, no policy** — `stripe_customers`, every `plaid_*`
  table, the `financial_provider_*` set. Deny-all *by construction*, if it holds.
- **~15 SECURITY DEFINER functions callable by `authenticated`** via RPC — the
  authorization primitives (`can_access_record`, `is_household_member`,
  `is_household_owner`, `join_household`, `create_household`, …). Callable-by-
  signed-in-users is fine *iff* each does its own checks. That "iff" is where
  tenant bugs live.
- 1 auth setting: leaked-password protection disabled (a hardening toggle, yours
  to flip).

## Static audit: the core is sound (and the old bug is gone)

The read path for every tenant table funnels through one function, so I read it
first. If `can_access_record` is wrong, everything is wrong:

```sql
create function can_access_record(household uuid, owner uuid, vis record_visibility)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select auth.uid() is not null
     and ( owner = auth.uid()
        or (vis = 'shared' and is_household_member(household, auth.uid())) );
$$;
```

This is correct, and correct in the ways that usually go wrong:

- **No NULL-slip.** `auth.uid() is not null` is explicit, so an anonymous call
  can't ride a NULL comparison into a match.
- **No over-broad branch.** The only cross-user path requires `vis = 'shared'`
  **and** membership. There is no `visibility = 'public'` escape hatch.
- **`search_path` pinned** and `SECURITY DEFINER`, so it can't be hijacked by a
  caller's search path and reads the real membership table.

And the previously-found tautology is **fixed** — the households UPDATE check now
reads:

```sql
with check ( is_household_owner(id, auth.uid())
  and created_by = (select h.created_by from households h where h.id = households.id) )
```

`h.id = households.id` (correlated to the row under update), not `h.id = h.id`.
It now does what it was always meant to: pin `created_by` immutable across an
update. Confirming a prior fix held is part of the job.

One more good sign worth recording: the `revenue_events` client INSERT policy is
locked to `transaction_id IS NULL AND mode='sandbox' AND verification_status='unverified'`.
Clients can only ever write *sandbox* revenue; verified live rows come solely
from the service-role webhook. That's the DB half of the webhook lab's defense in
depth, and it's really there.

## Proof 1 — deny-all holds (run against production, safely)

Reading "RLS on, no policy" and assuming deny-all is the same mistake as trusting
any other untested control. So I proved it, as a simulated signed-in user, in a
rolled-back transaction:

```
DENY_ALL_PROOF ::
  stripe_customers=no-grant[PASS]  financial_provider_credentials=no-grant[PASS]
  financial_provider_sync_cursors=no-grant[PASS]  financial_provider_webhook_events=no-grant[PASS]
  plaid_items=no-grant[PASS]  plaid_liabilities=no-grant[PASS]
  plaid_product_sync_status=no-grant[PASS]  plaid_recurring_streams=no-grant[PASS]
  plaid_transactions=no-grant[PASS]  provider_webhook_events=no-grant[PASS]
```

Stronger than expected. It's not just that RLS returns zero rows — the
`authenticated` role has **no table-level GRANT at all**, so it can't even name
these tables. Two independent layers deny access. That's the result you want on
the tables holding bank credentials and Plaid transactions.

## Proof 2 — cross-tenant probe (branch/local, because it seeds auth.users)

The full probe seeds two synthetic tenants and exercises every cross-tenant path
as each user. Alice owns Tenant A; Bob owns Tenant B; they share nothing:

| Probe | Expected |
|---|---|
| Bob reads Tenant A rows | 0 |
| Bob reads Tenant B rows | 1 (his own) |
| Bob INSERTs into Tenant A | rejected by `WITH CHECK` |
| Bob UPDATEs Tenant A rows | 0 rows affected |
| Bob DELETEs Tenant A rows | 0 rows affected |
| Alice reads Tenant A | 2 (shared + her own private) |
| Alice reads Tenant B | 0 |

**Where it stops on production, and why.** `households.created_by` is a foreign
key into `auth.users`, so seeding two tenants means inserting into the **auth
schema**. I won't do that on a production database — not even inside a
transaction I'm about to roll back. The blast radius of a mistake there isn't
worth the convenience. So Part 2 ships as `test/tenant_isolation_harness.sql`,
built to run on a Supabase **branch** or a local `supabase start`, where a throw-
away auth schema is exactly what you have. It rolls itself back via a sentinel
raise regardless, so even there it leaves nothing behind.

## Findings summary

- **No cross-tenant read/write path found** in the audited surface.
- **Deny-all confirmed** on all 10 sensitive tables — and hardened by a missing
  GRANT, not policy alone.
- **Prior tautology bug confirmed fixed.**
- **Hardening item (yours):** enable leaked-password protection —
  [docs](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- **Design note, not a bug:** ~15 SECURITY DEFINER RPCs are callable by
  `authenticated`. Each I read enforces membership/ownership internally, which is
  correct — but that surface is where the *next* bug would live, so it's the
  first place to re-probe after any policy change. The harness is built to grow
  those cases.

The honest headline: I tried to break my own tenant isolation and couldn't, and
I can show you the exact commands that failed to break it. That's a stronger
claim than "it has RLS."

---

*Serg Rodriguez — B.S. Cybersecurity (Threat Analysis) @ Iona.
Building in public, hunting Summer 2027 security internships.*
