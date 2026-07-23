# Codex brief — from Claude session, July 23 2026

Repo is at commit 8d2f81b (just pushed: Benefits Radar, allocation engine,
deposit watcher, your Plaid product-stream worker changes, Master Plan doc).
All migrations v17/v18/v19 are APPLIED to live Supabase. Worker tests 48/48.

## Your mission: the design pass (frontend only — worker is stable, do not restructure it)

1. PROPOSALS INBOX (highest priority): style and mount src/ProposalsPanel.jsx
   where decisions belong; pending-count badge on Home. This is the
   "confirm or continue" UX — when a deposit hits Chime, the deposit
   watcher files a proposal within ~5 min and it must POP.
2. SUPABASE REALTIME: subscribe to `transactions` and `agent_proposals`
   (RLS applies automatically) so new deposits/proposals appear live with
   a toast — no refresh.
3. BENEFITS RADAR screen: `GET /v1/benefits` returns the 13-program
   catalog with the household's enrollments merged (10 enrollments are
   pre-loaded with checklists + deadlines, ~$34k/yr tracked value).
   Catalog cards, status chips, deadline badges, checklist drawer,
   tracked-annual-value hero number. Render Tier 1 of docs/MASTER-PLAN.md
   as a "Before the Twins" checklist, front and center.
4. DEPOSIT ROUTER widget on Home: POST /v1/financial/allocate {amount}
   → render steps as a friendly breakdown with the "why" per bucket.
5. CSV IMPORT screen: paste/drop → POST /v1/financial/import/csv
   ({csv, source_label, invert?}) → show imported count + refreshed
   /v1/financial/summary numbers.
6. THEMES: replace/augment AI-ish themes with community palettes mapped
   into themeCatalog.js as data (validated by src/themeValidation.js):
   Catppuccin (Mocha/Latte), Nord, Rosé Pine (+Dawn), Tokyo Night,
   Everforest — use their published canonical hexes; credit in About.
   CSS-only animated gradients per palette; respect prefers-reduced-motion.

## Contracts (CI enforces): verify-dist.mjs gates builds; audits pin
PROVIDER_MODE "production"; proposal kinds are a closed allowlist; no
route ever moves money; schema changes = vNN file + live apply together.
docs/ROADMAP-AND-DESIGN.md Part B has the full design language (one hero
metric per screen, states-before-screens, WCAG AA contrast).
