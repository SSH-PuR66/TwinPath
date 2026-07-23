# Codex Brief 2 — iOS-class experience pass (July 23, 2026)

Prior pass (5ddee42) delivered proposals badge, Benefits Radar with
"Before the Twins" checklist, and community palettes — good work.
This pass makes TwinPath feel like a native iOS app and finishes the
functional surface. Frontend only; the worker API is stable and complete
(proposals, flags, benefits, allocate, import/csv, summary — all live).

## A. iOS PWA excellence (highest priority — Sergio & Brianna are phone-first)
1. Installability: apple-touch-icon set (180px), `display: standalone`
   verified, iOS splash screens via apple-touch-startup-image for common
   device sizes, correct theme-color per palette (light+dark meta).
2. Safe areas & viewport: `viewport-fit=cover`, respect
   env(safe-area-inset-*) on the tab bar and headers; use 100dvh (never
   100vh); no rubber-band scroll glitches on modals.
3. Bottom tab bar navigation (Home · Money · Grow · Family · Settings)
   per docs/ROADMAP-AND-DESIGN.md B1 — thumb-reachable, 44pt minimum
   touch targets everywhere, active state obvious.
4. iOS Safari quirks: input font-size ≥16px (prevents zoom-on-focus),
   position:fixed keyboards handling, momentum scrolling in panels,
   -webkit-tap-highlight tuned, no hover-only affordances.
5. Performance: Home interactive <2s on a mid phone — defer the three.js
   scene chunk until idle, static gradient fallback for
   prefers-reduced-motion AND for iOS low-power mode; lazy-load below-fold
   panels; keep Lighthouse PWA + a11y ≥90.
6. Add "Add to Home Screen" onboarding hint for iOS Safari users
   (dismissible, shown once).

## B. Finish the functional surface
7. Deposit Router widget on Home: input amount → POST
   /v1/financial/allocate → render steps as friendly cards with the
   "why" per bucket; celebrate state when a deposit-watch proposal is
   approved (the $150 CVS moment).
8. CSV Import screen (Money tab): drop/paste → POST /v1/financial/import/csv
   {csv, source_label, invert?} → imported count + refreshed summary;
   designed empty/loading/error states; mobile file-picker friendly.
9. Financial summary on Money: hero = 90-day net; income/expense split,
   top categories, by-month mini-bars from /v1/financial/summary.
10. Benefits Radar polish: deadline badges turn urgent <14 days; checklist
    progress per program; "tracked annual value" hero; deep links to
    official_url open in new tab with security rel attrs.
11. Realtime everywhere it matters: transactions + agent_proposals
    subscriptions with a single toast system (no stacking spam).

## C. Content & copy quality
12. Every screen: one hero number, plain-language sub-copy, empty states
    that sell the next action ("Connect a bank or import a CSV — 2 min").
13. Trust microcopy at Plaid/import moments: "TwinPath never sees your
    bank login and never moves money — you approve every plan."
14. Family tone: this app is for two young parents building freedom —
    warm, direct, zero jargon. Twins countdown on Home (due late Dec).

## D. Guardrails (CI enforces — unchanged)
verify-dist gates builds; PROVIDER_MODE pinned production; no route moves
money; proposal kinds closed; run `npm run test:worker` (48/48) and
`npm run build` before any commit. Commit in logical chunks.
