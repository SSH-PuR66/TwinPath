# Supabase review — TwinPath (project wtdmjybpfimmsojsdobx)

Reviewed live via MCP on 2026-07-20.

## Applied
- Migration `add_missing_fk_indexes`: added covering indexes on 7 unindexed
  foreign keys (business_experiments, career_actions, experiment_budgets,
  family_savings_routes, households, spend_proposals x2). Clears the
  performance advisor's unindexed-FK warnings.

## Wallet: use the EXISTING system, not a duplicate
The database already implements the spend-approval wallet:
- Tables: `spend_proposals`, `experiment_budgets`, `business_experiments`.
- Function: `review_spend_proposal(proposal_id, requested_status)` —
  SECURITY DEFINER, fixed search_path, enforces auth + ownership + household
  membership, a $5 per-proposal cap, a no-recurring rule, and a per-household
  experiment-budget ceiling on approved+purchased totals.
This is a solid human-in-the-loop design. `supabase/wallet-schema.sql` and
`src/WalletPanel.jsx` from the earlier session are a SEPARATE, duplicate design
(wallet_* tables). Do NOT deploy wallet-schema.sql against this project — it
would create a parallel, conflicting system. Kept in-repo only as reference;
wire any new wallet UI to `spend_proposals` + `review_spend_proposal`.

## Recommended (not auto-applied — need your decision / dashboard)
1. Enable "Leaked password protection" (Auth > Providers/Policies in the
   dashboard). Checks new passwords against HaveIBeenPwned. One toggle.
2. auth_rls_initplan (perf): several policies call `auth.uid()` per-row.
   Wrapping as `(select auth.uid())` speeds them up at scale. Left as-is
   because rewriting live policies on a working DB is riskier than the
   current benefit; revisit before heavy load.
3. SECURITY DEFINER function warnings: the flagged helpers
   (is_household_member, is_household_owner, can_access_record,
   can_*_path) are called from within RLS policies, so the authenticated
   role legitimately needs EXECUTE — revoking it (as the linter suggests)
   would break RLS. These warnings are expected for RLS helper functions
   and are safe to leave. The RPC-intended functions (create_household,
   join_household, review_spend_proposal, rotate_household_invite_code)
   are meant to be called and are correctly guarded internally.

## Storage
Buckets `vault` and `family-gallery` both exist, both private, both with
INSERT/SELECT/DELETE RLS policies.

On 2026-07-21 the Family Gallery download path returned
`permission denied for function can_access_document_path`, indicating live
policy/grant drift. Apply `supabase/v14-family-gallery-storage-fix.sql`; it
restores the required helper grants and recreates the gallery policies with
`can_read_family_photo_path`.

The later one-valid/one-broken gallery state was a separate consistency issue:
the old client deleted the Storage object before its `family_photos` row. Apply
`supabase/v16-family-gallery-consistency.sql` once to prune metadata whose exact
Storage object is already missing. The updated client deletes metadata first,
confirms the affected row, and then performs idempotent Storage cleanup.

## Financial integrations

Apply `supabase/v15-financial-integrations.sql` before enabling Plaid or
Stripe provider routes. Provider credentials remain encrypted and inaccessible
to browser roles. M&T Bank and Chime synchronization is read-only through
Plaid; the integration does not support transfers or automated spending.

Apply `supabase/v17-agent-proposals.sql` and then
`supabase/v18-plaid-product-streams.sql` before deploying the corresponding
Worker code. v18 keeps Liabilities and recurring streams product-scoped,
household/owner constrained, RLS-protected, and service-role-write-only.
