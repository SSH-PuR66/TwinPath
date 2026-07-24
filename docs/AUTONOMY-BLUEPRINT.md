# TwinPath Autonomy & Hardening Blueprint

Shared reference for Sergio, Claude (backend/infra), and Codex (UI/UX).
This documents the proposals/flags system shipped in v17, the permission
model that keeps autonomy safe, and the remaining hardening work.

## 1. The core loop: propose → approve → activate

Any agent (Claude in Cowork, Codex, or a future in-worker automation) can
suggest an app change without deploying it. A human approves in-app, and
the change activates through a feature flag — no redeploy needed.

```
agent files proposal ──► agent_proposals (pending)
                              │  user taps Approve in ProposalsPanel
                              ▼
              decide_agent_proposal RPC (membership-checked)
                              │  approved + flag_key present
                              ▼
                    feature_flags upsert (enabled=true)
                              │  frontend reads under RLS
                              ▼
                 flag-gated UI/route becomes visible
```

### Shipped in this pass
- `supabase/v17-agent-proposals.sql` — `agent_proposals` + `feature_flags`
  tables (RLS: members read; writes only via service role or the RPC),
  `decide_agent_proposal` RPC. **Already applied to the live database.**
- Worker endpoints in `workers/control-plane/`:
  `GET/POST /v1/proposals`, `POST /v1/proposals/:id/decision`,
  `GET /v1/flags` (all Bearer-authenticated, household-scoped,
  rate-limited like every other /v1 route).
- `src/useFeatureFlags.js` — hook returning `isEnabled(flagKey)` /
  `flagPayload(flagKey)`.
- `src/ProposalsPanel.jsx` — functional, unstyled approval inbox.
- `workers/control-plane/test/proposals.test.js` — validation tests.

### For Codex (UI/UX pass)
1. Mount `ProposalsPanel` where decisions belong — suggested: a card in
   `OperationsControlPlane` or a bell/badge in the app header showing the
   pending count. Style to match the existing design system.
2. Wire `useFeatureFlags(householdId)` at the app shell and gate optional
   UI: `isEnabled("route.twins-prep")`, `isEnabled("button.savings-boost")`,
   etc. Convention for flag keys: `route.*`, `button.*`, `panel.*`,
   `theme.*`, `config.*`.
3. Hidden routes: extend the private-app view (not `appRoutes.js`, which
   only splits app/storefront/legal) — render a flag-gated section when
   its flag is on. The flag's `payload` carries route metadata
   (`{"path": "/twins-prep", "label": "Twins Prep"}`).
4. Proposal creation UI (optional): a small "Suggest a change" form
   POSTing to `/v1/proposals` — users can file proposals too.

### Proposal kinds (closed allowlist — extend deliberately)
`new_button`, `hidden_route`, `theme`, `connector`, `copy_change`,
`config`. Payloads are bounded JSON (≤8 KB), flag keys must match
`^[a-z0-9][a-z0-9_.-]{1,79}$`. Never add a kind that executes code or
moves money.

## 2. Permission model — the lines that keep this safe

| Action | Who decides |
| --- | --- |
| Read-only data sync (Plaid transactions) | Autonomous (cron), already live |
| UI changes, routes, themes, copy | Agent proposes → human approves → flag flips |
| Code changes | Agent prepares commit → human pushes (CI gates: audits, tests, verify-dist) |
| Money movement, billing, credentials | **Human only. Never autonomous. No proposal kind may bridge this.** |

Existing enforcement stays load-bearing: origin allowlist, per-user rate
limits, RLS + service-role separation, signed webhooks with idempotent
event claims, `STRIPE_ALLOWED_PRICE_IDS` allowlist, sandbox-only agent
runs, append-only audit events.

## 3. Hardening checklist

### Done (this pass)
- [x] Proposals/flags write path locked to service role + RPC.
- [x] Theme import validation (`src/themeValidation.js`): data-only
  themes — hex colors, allowlisted scenes, no URLs/CSS/JS. Wire this into
  `ThemeMarketplace` before accepting any external theme JSON.
- [x] `.github/dependabot.yml` — weekly npm + Actions update PRs.
- [x] Build provenance: `verify-dist.mjs` blocks builds missing backend
  URLs; audits pin `PROVIDER_MODE: "production"`.

### To do (small, high value)
- [ ] **Supabase Auth: enable leaked-password protection** (advisor WARN).
  Dashboard → Authentication → Providers → Password → enable HaveIBeenPwned
  check. Two minutes, real win.
- [ ] **GitHub secret scanning + push protection**: repo Settings →
  Code security. Free for public repos.
- [ ] **Cloudflare Turnstile** on any public storefront form (contact,
  checkout-adjacent). Create a Turnstile widget in the Cloudflare
  dashboard, expose `TURNSTILE_SITE_KEY` to the frontend and verify the
  token in the worker with `TURNSTILE_SECRET_KEY` (encrypted secret,
  same flow as the others). Gate on env so it stays off until keys exist.
- [ ] **Branch protection on `main`**: require the Verify workflow to pass
  before merge; both agents keep pushing, but broken builds can't land.
- [ ] Storefront external links: keep routing everything through
  `safeUrl.js` allowlists (Stripe hosts only for checkout).

### Advisor notes (reviewed, intentional)
- `rls_enabled_no_policy` INFO on plaid/stripe/webhook tables: correct —
  those are service-role-only by design.
- SECURITY DEFINER RPC warnings: all RPCs validate membership internally;
  `decide_agent_proposal` follows the same pattern as
  `review_agent_approval`.

## 4. Third-party expansion pattern

Every new financial/commerce provider follows the Plaid/Stripe template:
secrets via `wrangler secret put` (never in config), readiness gate in
`provider-mode.js` (fail closed), signature-verified webhook with
idempotent event claim, household-scoped service-role persistence, and a
`readiness` entry surfaced in `/v1/financial/connections`. Stripe goes
live by adding `sk_live_*` + `whsec_*` + price allowlist — production
mode already requires live keys. Stripe sales can flow into
`revenue_events` through a signature-verified webhook the same way.

## 5. Scheduled agent reviews (deferred — opt in later)

A recurring Cowork task can have Claude check CI, worker health, Plaid
sync results, and Supabase advisors, then file proposals via
`POST /v1/proposals` and prepare any code in the project folder. Nothing
activates without an in-app approval. Ask Claude to "set up the weekly
review task" when wanted.

## 6. Concurrency etiquette (Claude ↔ Codex)

- Claude avoids editing existing UI components; new frontend capability
  lands as new files with integration notes here.
- The guard scripts (`audit-control-plane.mjs`,
  `validate-control-plane-deploy.mjs`, `verify-dist.mjs`) are contracts:
  config changes must update them in the same commit, or CI fails loudly
  (~20s failure at the guard step is the signature).
- Schema changes ship as `supabase/vNN-*.sql` files AND get applied to the
  live project in the same pass, so files and database never drift.
