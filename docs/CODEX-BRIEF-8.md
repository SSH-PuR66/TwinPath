# CODEX BRIEF 8 — Tab hierarchy, motion, and the money-flow map

Repo: `https://github.com/SSH-PuR66/TwinPath` (branch `main`, currently `ae018ac`)
Local: `C:\Users\sergi\Documents\el_plan`
Live: `https://twinpath.srodriguez46.workers.dev`

TwinPath is a private two-person household planning app. React 18 + Vite 6
SPA served as static assets by a Cloudflare Worker. Two people use it. It is
not a product, it has no customers, and it must never look like it is trying
to sell anything.

---

## HARD CONSTRAINTS — violating any of these fails the task

1. **Do not touch authentication.** `src/supabase.js`, `AuthScreen`,
   `authRedirectUrl`, `signInWithOtp`, `verifyOtp`, `signInWithPassword`
   are off limits. No edits, no refactors, no "improvements".

2. **Do not touch money logic.** `workers/control-plane/**`, anything
   reading `plaid_*` tables, and `financialSummary` are off limits.
   Plaid's sign convention here is *positive amount = money leaving*.
   Do not "fix" it.

3. **Do not add dependencies.** Already installed and available to you:
   `framer-motion@12`, `lottie-web@5`, `three@0.169`, `@react-three/fiber`,
   `@react-three/drei`, `lucide-react`, `react-day-picker`. That is your
   whole toolbox. No new npm packages, no CDN fonts, no icon libraries,
   no map libraries (see Part C — the map is hand-built SVG).

4. **No new routes, no new tabs, no new top-level screens.** The five
   bottom-nav tabs (Home, Money, Grow, Family, Settings) are final.
   Everything in this brief lives inside those five.

5. **No monetization of any kind** inside TwinPath. No affiliate links,
   no ads, no sponsor slots, no upsells, no "premium" gating. A separate
   commercial project exists elsewhere; it does not touch this codebase.

6. **No storing of sensitive identifiers.** The profile vault
   structurally refuses SSNs, government ID numbers, Medicaid/CIN card
   numbers, and bank/card numbers. Do not add fields that accept them.

7. **Line endings.** `src/App.jsx` is mixed CRLF/LF. Read and write files
   preserving existing line endings exactly. Verify with
   `git diff --ignore-cr-at-eol --stat` and confirm the number is small.
   If the stat shows thousands of changed lines, you have mangled the
   file — revert and redo.

8. **`npm run build` must pass**, including `audit`, `themes:validate`,
   `audit:css`, `audit:imports`, `audit:control-plane`, and `verify-dist`.
   Run it before you claim done. Do not modify the audit scripts.

9. **Colors come from CSS custom properties only.** Never hardcode a hex
   value in a component or a rule. The palette lives in `:root` in
   `src/styles.css`; only `--accent` and `--accent-2` come from the theme
   system. Any new color must be a token.

10. **Performance budget.** This is an installed PWA used on a phone.
    The main `index` JS chunk must not grow by more than 8 kB gzipped.
    Anything heavier is lazy-loaded behind `React.lazy`. No animation may
    run when its element is off-screen. No `setInterval` that survives
    unmount. Respect `prefers-reduced-motion: reduce` everywhere —
    every animation in this brief must degrade to an instant state change,
    not a slower version of itself.

---

## PART A — Tab hierarchy and mental declutter

The five tabs work, but each one is a flat wall of cards of equal visual
weight. The user's words: "de-clutter without affecting the critical info."
Nothing is deleted. Hierarchy and progressive disclosure only.

### A1. One hero per tab, everything else recedes
Each tab gets exactly one primary element at the top — the thing the user
opened the tab to see — rendered larger and with more contrast than
anything below it. Proposed heroes:

- **Home** — pregnancy week ticker with days-to-due-date and the single
  next dated obligation across the whole app.
- **Money** — cash on hand and the next money event (bill, deposit,
  deadline). Not the account list.
- **Grow** — the current active goal, one line, with progress.
- **Family** — the next shared calendar item.
- **Settings** — leave as is; it is already a list and should be.

Everything currently at the top of those tabs stays on the tab, below the
hero, at reduced visual weight.

### A2. Collapse the second tier into disclosure groups
Below the hero, group the remaining cards into at most three labelled
sections per tab, with the second and third collapsed by default on
viewports under 480px. Use a real `<details>`/`<summary>` or an
`aria-expanded` button — not a div with a click handler. Collapse state
persists in `localStorage` per tab per section.

Every fact currently on screen must still be reachable in at most one
interaction. This is A5 from Brief 7 and it still holds: decluttering is
hierarchy, not deletion.

### A3. The bottom nav itself
Five tabs, unchanged. But the active tab is currently only weakly
indicated. Give it: a filled icon state, a label weight change, and a
shared-layout indicator pill that slides between tabs
(`framer-motion` `layoutId`). The slide is the only motion; do not bounce.

---

## PART B — Motion that earns its place

The user asked for animations that are "amazing" and "visually appealing."
The trap is making a two-person utility app feel like a landing page. The
rule for this entire section: **motion communicates state change, never
decorates.** If you cannot name the state change an animation expresses,
delete it.

`framer-motion` is already a dependency and already in the bundle
(`motion-*.js`). `lottie-web` is too. Use them; add nothing.

### B1. Tab hover and press
On pointer devices, hovering a bottom-nav tab lifts the icon 2px and
raises its opacity over 140ms with an ease-out curve. On press, a 0.96
scale for 90ms. On touch devices there is no hover state — do not fake
one with `:active` lingering. Guard with `@media (hover: hover)`.

### B2. Card entrance
Cards in a grid stagger in on mount at 24ms intervals, 12px upward
translate, 180ms each, capped at eight cards — after that they appear
instantly. Do not re-run the stagger on every re-render; run it once per
mount using a key that does not change on data refresh.

### B3. The drawer
The benefit drawer (now a centred modal, see `src/BenefitsRadar.jsx`)
should scale from 0.96 to 1 with a fade over 160ms and reverse on close.
The backdrop blur fades in over the same duration. `AnimatePresence`
handles the exit — do not unmount before the exit completes.

### B4. Number transitions
When a currency figure changes — cash on hand, tracked annual value —
tween the displayed number over 400ms rather than snapping. Format the
tweened value with the same formatter used for the static value so there
is no flicker in the final frame.

### B5. Lottie budget
At most **two** Lottie animations in the whole app, each under 30 kB,
each lazy-loaded, each with a static SVG fallback under
`prefers-reduced-motion`. Suggested placements: the empty state when a
tab has no data yet, and the success beat after a benefit status saves.
If you cannot find or author a Lottie that small, skip it entirely —
do not ship a heavy one.

---

## PART C — The money-flow map

This is **not** a geographic map. The user's words: "routes show when
money is imported or moved out." It is a flow diagram of the household's
money, and it lives inside the **Money** tab, below the hero, as a
collapsible section — not a new tab and not a new route.

### C1. What it renders
A hand-built inline SVG Sankey-style flow, three columns:

  sources → household → destinations

- **Sources** (left): each connected account and each recurring inflow
  the app already knows about, sized by amount.
- **Household** (centre): a single node showing net position.
- **Destinations** (right): spending categories that already exist in the
  transaction data, plus any tracked benefit inflows.

Positive Plaid amounts are money leaving. Do not re-derive this; read the
existing `financialSummary` output, which already has the sign correct.

### C2. Data source
**Read only from what the control plane already returns.** Do not add a
control-plane route, do not add a third-party financial API, do not call
any external service from the client for this. Everything the map needs
is already in the `/v1/financial/*` responses. If a figure you want is
genuinely absent, render the map without it and note the gap in your
summary — do not invent a new endpoint.

### C3. How it is built
Pure SVG with `framer-motion` `path` length animation for the ribbons —
no D3, no charting library, no map library, no canvas. Ribbons draw in
left-to-right over 600ms on first reveal, once per session. Node labels
use existing typography tokens. Colours from `--accent`, `--accent-2`,
and the neutral surface tokens only.

### C4. Interaction
Tapping a node dims every ribbon it does not touch and shows its total in
a caption below the diagram. Tapping again clears. Keyboard: nodes are in
tab order, Enter/Space toggles, Escape clears. Everything the diagram
shows must also be available as a plain text summary directly beneath it,
because a Sankey is not accessible on its own.

### C5. Empty and thin states
With one connected account and few transactions, a Sankey looks broken.
Below a threshold — fewer than three distinct flows — render the plain
text summary alone and hide the diagram. Say why in one quiet line.

---

## PART D — The "official program site" links

The user: "The official sites look a bit obnoxious." Currently each
benefit drawer renders a full-width secondary button reading "Official
program site," which shouts louder than the content around it.

Replace with an inline text link at the end of the `how_to_apply`
paragraph, carrying a small external-link icon and the host name
(`irs.gov`, `mtb.com`, `nysaves.org`) so the destination is legible before
tapping. Keep `safeExternalUrl`, keep `target="_blank"`, keep
`rel="noopener noreferrer"`. Do not remove any link.

---

## Definition of done

- `npm run build` passes end to end, including `verify-dist`.
- `git diff --ignore-cr-at-eol --stat` shows a change count consistent
  with the work described — not thousands of lines.
- No file under `workers/` and no auth-related file appears in the diff.
- `package.json` and `package-lock.json` are unchanged.
- The main `index` JS chunk grew by no more than 8 kB gzipped. State the
  before and after gzip sizes in your summary.
- On a 390px viewport: no clipped text, no horizontal scrollbar, and each
  tab shows one obviously-dominant hero.
- With `prefers-reduced-motion: reduce` set, the app is fully usable and
  no element animates.
- Every fact that was on screen before is still reachable in at most one
  interaction. State plainly what you moved behind a disclosure.

## Commit

One commit, present tense, explaining *why* rather than listing files.
Do not push. Leave it committed locally so it can be reviewed before it
goes near production.
