# Codex Brief 6 — MASTER handoff: fix "finances don't load", harden, polish

A browser audit + a live Chime deposit test found real issues. Backend
fixes already shipped by Claude (commit 75d4c47): the financial summary
and deposit watcher now BRIDGE plaid_transactions into the unified view
(they were reading only the `transactions` ledger, so connected-bank data
never appeared — this was the #1 "nothing loaded" cause). Your job is the
frontend reliability + UX so the app never freezes and always shows
something real.

## P0 — Reliability (this is why the page froze / showed nothing)
1. **Timeouts + graceful fallback on EVERY control-plane fetch.** The
   audit found /v1/financial/connections and /v1/profile hanging in
   `pending` forever, freezing the SPA. Wrap all worker fetches in an
   AbortController with a ~8s timeout. On timeout/error: render the
   panel's error state with a retry button and, for money, fall back to
   the CSV-import path — NEVER a blank freeze.
2. **Loading + empty + error states on every data panel** (use
   Skeleton.jsx). Money must show a skeleton, then either data or a clear
   "Connect a bank or import a CSV" empty state — never a spinner forever.
3. **Fresh-data affordance:** Money shows "as of <time>" and a manual
   refresh; a just-made deposit may take minutes to post at Chime + sync
   via Plaid, so copy should say "Bank deposits can take a few minutes to
   appear" instead of implying it's broken.

## P0 — Stripe webhook is pointed at the WRONG worker
The Stripe webhook currently targets vestige.srodriguez46.workers.dev,
NOT the twinpath control-plane. So checkout/subscription events never
reach TwinPath. FIX (Sergio does this in Stripe dashboard, not code):
repoint (or add) the webhook endpoint to
https://twinpath-control-plane.srodriguez46.workers.dev/v1/webhooks/stripe
and set STRIPE_SECRET_KEY (sk_live) + the webhook whsec in Cloudflare
secrets. The worker already verifies signatures + is idempotent. Codex:
ensure /shop checkout-success handling reads from control-plane, not any
vestige path; remove any lingering vestige endpoint references in src.

## P0 — Security audit (verify, then confirm in a comment)
- Confirm NO service-role key is in the client bundle (only the anon key).
  grep the built dist for "service_role" and any sk_ / eyJ...service key.
- Confirm every Supabase table the client reads has RLS enabled (the
  audit noted raw household_id/owner_user_id in query strings — safe ONLY
  if RLS is on everywhere; it is, but verify no new table slipped through).
- CSP stays self-only; payment links open new tab rel=noopener noreferrer.

## P1 — The finances view itself
- Money hero = 90-day NET from /v1/financial/summary (now includes Plaid).
  Show income, expense, top categories, by-month mini-bars.
- Net-worth hero on Home from networth_snapshots (v23) with sparkline.
- Deposit router widget calls /v1/financial/allocate.
- Wire the earlier briefs still pending: CODEX-BRIEF-3 (approval→Chime
  handoff, Web Share Target, live video wallpapers, watchers UI, vault
  UI), BRIEF-4 (iOS share fix, per-member tracks), BRIEF-5 (Stripe
  storefront flip catalog).

## P1 — Kill the confusion
- Remove ALL Gumroad remnants and any VESTIGE-branded product/listing
  from the public storefront. The catalog is ONLY the three Stripe
  products in BRIEF-5. One brand: TwinPath.
- Private app (Home/Money/Grow/Family for Sergio + Brianna) is SEPARATE
  from the public /shop business — do not blur them.

## Guardrails (CI enforces)
npm run test:worker (50/50) + npm run build green before every commit;
no route moves money; proposal kinds closed; commit in logical chunks.
