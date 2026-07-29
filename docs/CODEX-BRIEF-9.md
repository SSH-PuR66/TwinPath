# CODEX BRIEF 9 — Calendar density, the day sheet, and the Now Path

Repo: `https://github.com/SSH-PuR66/TwinPath` (branch `main`)
Local: `C:\Users\sergi\Documents\el_plan`
Live: `https://twinpath.srodriguez46.workers.dev`

Run AFTER Brief 8 (or together — same constraints). The calendar now
contains ~214 imported class sessions (category "School", six courses,
Aug 24–Dec 11), and the Family tab's calendar page has become enormously
tall on a phone. That is the problem this brief exists to fix.

---

## HARD CONSTRAINTS — identical to Brief 8, all still binding

1. No auth edits (`src/supabase.js`, `AuthScreen`, `authRedirectUrl`,
   `signInWithOtp`, `verifyOtp`, `signInWithPassword`).
2. No money logic (`workers/control-plane/**`, `plaid_*` readers,
   `financialSummary`). Positive Plaid amount = money leaving.
3. No new dependencies. Toolbox: `framer-motion`, `lottie-web`,
   `react-day-picker`, `lucide-react`, existing three/@react-three (do
   not add new uses of three for this brief — it is too heavy for a
   calendar).
4. No new routes, tabs, or top-level screens.
5. No monetization of any kind.
6. No sensitive-identifier fields.
7. Preserve line endings; verify with `git diff --ignore-cr-at-eol --stat`.
8. `npm run build` must pass; do not modify audit scripts.
9. Colors from CSS custom properties only.
10. Performance budget from Brief 8 holds: main index chunk +8 kB gzipped
    max, `prefers-reduced-motion` fully respected, no off-screen
    animation, no surviving intervals.

---

## PART A — Calendar density

`src/CalendarView.jsx` (~307 lines) renders a DayPicker month grid, then
the selected day's appointments as full cards inline below it. With six
classes a day, the page is several screens tall and reads as congestion.

### A1. The month grid carries dots, not text
Each day cell shows at most three category-colored dots (4px) beneath the
number, plus a "+N" micro-label if more. Use `categoryColors` for the dot
colors. No titles, no times in the grid. The grid must fit entirely in
one phone viewport width with no horizontal scroll at 390px.

### A2. Tapping a day opens a day sheet
Replace the inline appointment list with a bottom sheet (phone) / centred
modal (wide viewports) that opens when a day with appointments is tapped.
Reuse the pattern already established by the benefit drawer in
`BenefitsRadar.jsx`: fixed backdrop with `--overlay` + blur, sheet on
`--surface-strong`, `role="dialog"` `aria-modal="true"`, Escape closes,
backdrop tap closes, background inert. framer-motion: sheet slides up
120px with fade over 180ms; exits in reverse via `AnimatePresence`.

Inside the sheet, the day's appointments render as a **timeline list**:
one row per appointment — time range, a 3px category color bar, title,
location in muted text. One line each, two max. The existing edit/delete
actions move behind a tap on the row (expand in place), not visible on
every row at rest.

### A3. Class sessions are compact by design
Appointments whose category is "School" render in the day sheet as the
compact rows above and are **grouped**: the sheet shows them under a
small "Classes" sub-header, other categories under "Appointments". A
day that is only classes should feel like a class schedule, not six
identical large cards. Do not special-case course names — key off the
category only.

### A4. The add flow stays
The "+ Add" button for the selected day stays visible outside the sheet
(on the grid page) and also inside the sheet header. Do not make adding
an appointment harder than it is today.

### A5. Do not delete information
Every field currently displayed (notes, transportation plan, questions,
reminder) must remain reachable — inside the row expansion. Decluttering
is hierarchy, not deletion.

---

## PART B — The Now Path (the animated to-do plan)

A new section, placed as the second block on the **Home** tab (directly
under whatever hero Brief 8 established). This is the user's "what do I
do right now" view, drawn as an animated path — the thing he has been
calling the map.

### B1. Data
Read from what already exists: the `tasks` table rows (via the existing
tasks fetch) and the next dated items across benefits deadlines and
appointments. No new endpoints, no new tables. Compose client-side into
an ordered list of at most **five** steps: overdue/dated first, then
undated by priority. Each step: title, one-line detail, done/not-done,
optional date.

### B2. Rendering
A vertical winding path (inline SVG, one `<path>`, gentle S-curve) with
five evenly spaced nodes. Completed nodes are filled (`--accent`) with a
check; the current step's node is larger, pulsing once on mount (scale
1 → 1.15 → 1, 600ms, once — not looping); future nodes are outlined.
The path segment up to the current node draws in on first reveal using
framer-motion `pathLength` (800ms, once per session — persist a flag in
`sessionStorage`). Tapping a node opens the same task detail interaction
that already exists on the task list; do not build a second editor.

### B3. Empty state
Zero steps: one quiet line ("Nothing urgent right now") and no SVG.

### B4. Reduced motion
`prefers-reduced-motion`: path renders fully drawn, no pulse, instant.

---

## Definition of done

- `npm run build` passes end to end.
- Small CRLF-insensitive diff; no `workers/`, no auth files,
  `package.json` unchanged.
- On a 390px viewport: the Family tab calendar page fits the month grid
  in one viewport height including its header; the day sheet opens and
  closes cleanly; no clipped text, no horizontal scroll.
- A day with six classes reads as one compact timeline, not six cards.
- The Now Path renders with real task data, animates once, and is inert
  under reduced motion.
- State plainly what moved behind the row expansion in the day sheet.

## Commit

One commit, present tense, explaining why. Do not push. Leave it local
for review.
