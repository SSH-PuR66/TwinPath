# CODEX BRIEF 11 - Density system, semester mode, and a guard against tall pages

Repo: `C:\Users\sergi\Documents\el_plan`
Target: TwinPath PWA (Cloudflare Workers `twinpath` + `twinpath-control-plane`)
Written: 2026-07-25

This brief has one theme. Every page in TwinPath grew by addition, and the result
is that the phone experience is a long scroll and the desktop experience is a
narrow column in the middle of a wide screen. Part A fixes that with a small set
of layout primitives. Part B makes the fix permanent with a check that fails
when a page gets too tall again. Parts C through E are new surfaces, ordered by
how much they matter this fall.

Do Part A and Part B first and stop. Get them reviewed and deployed before
starting Part C. Do not attempt the whole brief in one pass.

---

## 0. Hard constraints - these are not negotiable and not up for interpretation

1. **The app never moves money.** No transfers, payouts, withdrawals, order
   entry, trade execution, contribution execution, swaps, staking, or purchases.
   Every route is read-only or advisory. Where an action is required, the app
   shows the phone number or the URL and the human does it.
2. **No secrets in code, in commits, or in this repo.** If a key is needed, it
   goes in a Cloudflare secret or an environment variable that a human sets. Do
   not read, echo, or write credentials.
3. **The profile vault structurally refuses identifiers.** No SSNs, no
   government IDs, no Medicaid or CIN card numbers, no bank or card numbers, and
   no user-typed last-four masks. Benefits are tracked as statuses only
   (applied / approved / renewal due), never as card data.
4. **No monetization inside TwinPath.** No affiliate links, no ads, no sponsor
   slots, no upsells, no premium gating.
5. **Do not touch the domain swap wiring.** `CANONICAL_APP_URL` in `App.jsx`,
   the Supabase Site URL, and the Supabase Redirect URLs stay exactly as they
   are. That change is scheduled last and will be done deliberately.
6. **Do not break what works.** No refactor of working code as a side effect of
   a layout change. If a change requires touching a working module, say so and
   stop rather than rewriting it.

## 0.1 Environment facts you will get wrong if you do not read this

- Build chain: `npm run build` runs `themes:package && audit && vite build &&
  verify-dist.mjs`. All four must pass. `verify-dist` failing in a fresh clone
  for a missing `.env` is expected and is not a code fault.
- CSS import order is `styles.css` then `feature-components.css`. Do not
  reorder. New primitives go in `feature-components.css`.
- Line endings, verbatim, do not normalize them:
  - `App.jsx` is CRLF
  - `MoneyActionCenter.jsx` is LF only
  - `styles.css` is CRLF
  - `feature-components.css` is CRLF
- Keep new source ASCII only. Content that travels through the PowerShell bridge
  dies on em dashes and smart quotes with a UnicodeDecodeError. Use `-` and `--`.
- Tests: `node --test test/*.test.js`. A bare directory argument does not work on
  Node 22.
- Supabase project `wtdmjybpfimmsojsdobx`, household
  `c06a3168-264f-423e-b864-221fa9fef052`.
- Plaid sign convention: a positive amount is money leaving the account.

---

## Part A - The density system

The rule the whole system enforces: **a pane may scroll, a page may not.** On a
wide screen the layout fits the viewport and each pane scrolls its own overflow.
On a phone the page does scroll, but every pane is height-capped, so the page is
a short stack of bounded panes rather than one continuous column.

There is a working reference implementation. Read it before writing anything:
the Fall 2026 command board delivered alongside this brief. It is a single HTML
file with no dependencies and it demonstrates all five primitives below in about
300 lines. Copy its behaviour, not its palette.

### A1. Add the primitives to `feature-components.css`

```css
/* ---- density primitives (brief 11) --------------------------------- */

/* Shell: on a wide screen the app fits the viewport and never scrolls. */
.tp-shell{
  height:calc(100dvh - var(--tp-shell-inset, 16px) * 2);
  display:grid; gap:var(--tp-gap, 12px);
  min-height:0; min-width:0;
}

/* min-width:0 is load-bearing. A grid or flex child defaults to min-width:auto,
   so one wide descendant (a rail, a long table, a nowrap number) drags the
   whole page sideways on a phone. This single declaration is the fix for most
   horizontal-scroll bugs. */
.tp-pane{
  display:flex; flex-direction:column; overflow:hidden;
  min-height:0; min-width:0;
  background:var(--surface-1); border:1px solid var(--border);
  border-radius:var(--radius-md);
}

.tp-pane__head{
  flex:none; display:flex; flex-wrap:wrap; align-items:baseline;
  justify-content:space-between; gap:8px;
  padding:11px 13px 9px;
  font:600 10px/1 var(--font-ui); letter-spacing:.14em; text-transform:uppercase;
  color:var(--text-faint);
}
.tp-pane__head em{
  font-style:normal; font-weight:400; font-size:10px;
  letter-spacing:.02em; text-transform:none; color:var(--text-faint);
}

/* The scroll region. The fade is applied only when content actually continues
   below, and removed once you reach the bottom. A permanent fade on a pane that
   fits reads as a rendering bug, which is how the current pages feel. */
.tp-pane__body{
  overflow-y:auto; overflow-x:hidden; min-height:0;
  padding:0 13px 12px;
  scrollbar-width:thin; scrollbar-color:var(--border) transparent;
  overscroll-behavior:contain;
}
.tp-pane__body.is-more{
  mask-image:linear-gradient(180deg,#000 calc(100% - 26px),transparent);
}
.tp-pane__body.is-more.is-end{ mask-image:none; }
.tp-pane__body::-webkit-scrollbar{width:3px}
.tp-pane__body::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}

/* Rail: the anti-tall-page move. A list of 8+ peer items becomes a horizontal
   scroll-snap row instead of a vertical stack. Costs one row of height instead
   of eight. */
.tp-rail{
  display:flex; gap:8px; overflow-x:auto; padding:0 13px 4px;
  scroll-snap-type:x mandatory; scrollbar-width:none;
  min-height:0; min-width:0; align-items:stretch;
}
.tp-rail::-webkit-scrollbar{display:none}
.tp-rail > *{ flex:0 0 var(--tp-rail-item, 148px); scroll-snap-align:start; }

/* Strip: three to five numbers on one line instead of a stack of stat cards. */
.tp-strip{
  display:grid; grid-auto-flow:column; grid-auto-columns:1fr;
  gap:1px; background:var(--border);
  border:1px solid var(--border); border-radius:var(--radius-sm); overflow:hidden;
}
.tp-strip > *{ background:var(--surface-1); padding:8px 10px; min-width:0; }

@media (max-width:860px){
  .tp-shell{ height:auto; grid-template-columns:1fr; }
  /* every pane stays bounded on the phone. this is the difference between
     a short stack of panes and an endless page. */
  .tp-pane{ max-height:min(56vh, 440px); }
  .tp-rail{ --tp-rail-item:148px; }
  .tp-strip{ grid-auto-flow:row; grid-auto-columns:auto; }
}
@media (prefers-reduced-motion:reduce){
  .tp-rail{ scroll-behavior:auto; }
}
```

### A2. Add the overflow hook

New file `src/hooks/usePaneOverflow.js`, LF line endings, ASCII only:

```js
import { useEffect } from "react";

// Toggles is-more / is-end on every .tp-pane__body inside the container so the
// bottom fade appears only where content genuinely continues. Cheap: one
// ResizeObserver, passive scroll listeners, no state, no re-render.
export function usePaneOverflow(rootRef) {
  useEffect(() => {
    const root = rootRef?.current ?? document;
    const panes = Array.from(root.querySelectorAll(".tp-pane__body"));
    if (!panes.length) return undefined;

    const sync = (el) => {
      const over = el.scrollHeight - el.clientHeight;
      el.classList.toggle("is-more", over > 4);
      el.classList.toggle("is-end", over > 4 && el.scrollTop >= over - 4);
    };
    const onScroll = (e) => sync(e.currentTarget);

    panes.forEach((el) => {
      sync(el);
      el.addEventListener("scroll", onScroll, { passive: true });
    });

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver((entries) => entries.forEach((e) => sync(e.target)));
      panes.forEach((el) => ro.observe(el));
    }
    const onResize = () => panes.forEach(sync);
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      panes.forEach((el) => el.removeEventListener("scroll", onScroll));
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
    };
  }, [rootRef]);
}
```

### A3. Convert exactly one route first

Pick the tallest route. Convert it to `.tp-shell` with named
`grid-template-areas`, wrap each existing section in `.tp-pane` with a
`.tp-pane__head` and a `.tp-pane__body`, and turn the longest peer list on that
page into a `.tp-rail`. Call `usePaneOverflow` once at the route root.

Report the before and after numbers from Part B. Do not convert a second route
until the first one is reviewed.

### A4. Three specific conversions worth making

- Any vertical list of eight or more peer items becomes a `.tp-rail`.
- Any run of three or more stat cards becomes a `.tp-strip`.
- Any accordion whose sections are all closed by default becomes a rail of
  headers with one detail pane, so the page height stops depending on what is
  expanded.

---

## Part B - The height budget check

The tall-page problem keeps coming back because nothing detects it. This makes
it mechanical.

New file `scripts/height-budget.mjs`:

```js
// Renders each route at a phone and a laptop viewport and reports how many
// screens tall it is. Fails when a route exceeds its budget.
// Run: npm run heights   (needs a local dev server on PORT)
import { chromium } from "playwright";

const BASE = process.env.HEIGHT_BASE || "http://127.0.0.1:5173";
const ROUTES = [
  { path: "/",         phone: 2.2, wide: 1.05 },
  { path: "/money",    phone: 2.6, wide: 1.05 },
  { path: "/grow",     phone: 2.6, wide: 1.05 },
  { path: "/family",   phone: 2.6, wide: 1.05 },
  { path: "/settings", phone: 2.6, wide: 1.05 },
];

const VIEWPORTS = [
  { key: "phone", width: 390, height: 844 },
  { key: "wide", width: 1440, height: 900 },
];

const browser = await chromium.launch();
const rows = [];
let failed = 0;

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + route.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
      wideX: document.documentElement.scrollWidth > window.innerWidth + 1,
    }));
    await ctx.close();

    const screens = m.docH / m.winH;
    const budget = route[vp.key];
    const bad = screens > budget || m.wideX || errors.length > 0;
    if (bad) failed += 1;
    rows.push({
      route: route.path, vp: vp.key,
      screens: screens.toFixed(2), budget: budget.toFixed(2),
      sideways: m.wideX, errors: errors.length, ok: !bad,
    });
  }
}

await browser.close();
console.table(rows);
if (failed) {
  console.error(`\n${failed} route/viewport pair(s) over budget or scrolling sideways.`);
  process.exit(1);
}
console.log("\nAll routes within budget.");
```

Wire it as `"heights": "node scripts/height-budget.mjs"` in `package.json`
scripts, with `playwright` as a devDependency.

**Do not add this to `npm run build` yet.** Run it, record the current numbers
in the PR description, convert routes until they are green, and only then
propose promoting it into the build. A check that fails on day one gets deleted
on day two.

Two things it catches that a human review misses: horizontal overflow on a
phone (usually a missing `min-width:0`), and a route that is fine today and
three screens tall after two more features land.

---

## Part C - Semester mode

This is the highest-value new surface. The app currently has no idea that its
user is a full-time student with fixed dates, and that is now the single largest
constraint on the household.

New route `/semester`. Data lives in `src/data/semester.js` as a plain exported
array so the dates can be corrected in one place without a migration:

```js
export const SEMESTER = [
  { date: "2026-08-21", label: "Arrival / orientation", note: "Verify - classes start the 24th", kind: "info" },
  { date: "2026-08-24", label: "First day of classes", note: "Iona, Fall 2026", kind: "key" },
  { date: "2026-08-31", label: "Add / drop closes", note: "Cheapest decision point all term", kind: "key" },
  { date: "2026-09-07", label: "Labor Day", note: "Campus closed", kind: "info" },
  { date: "2026-10-01", label: "FAFSA 2027-28", note: "Household size changes with the twins", kind: "money" },
  { date: "2026-10-26", label: "Spring registration", note: "Build the semester around newborns", kind: "key" },
  { date: "2026-11-12", label: "W deadline", note: "Last no-penalty exit from a course", kind: "critical" },
  { date: "2026-11-14", label: "Early-arrival window opens", note: "ESTIMATED - confirm with OB", kind: "estimate" },
  { date: "2026-11-25", label: "Thanksgiving recess", note: "Through the 27th", kind: "info" },
  { date: "2026-12-04", label: "Last day of classes", kind: "key" },
  { date: "2026-12-07", label: "Final exams", note: "Through Dec 11, day students", kind: "critical" },
  { date: "2026-12-14", label: "Grades post", note: "Noon", kind: "info" },
  { date: "2026-12-21", label: "Due window", note: "PLACEHOLDER - late December", kind: "estimate" },
  { date: "2026-12-31", label: "Tax-year line", note: "A birth by this date counts for all of 2026", kind: "money" },
  { date: "2027-01-04", label: "Add twins to coverage", note: "Roughly 30 days from birth", kind: "critical" },
];
```

Render as: a `.tp-rail` spine with a proportional today marker, plus one pane
that states the collision in prose. The collision is the reason this route
exists, so do not bury it:

> Finals end December 11 and a late-December due date sits clear of them. The
> pressure is four weeks earlier. The last day to withdraw from a course with a
> W is November 12, and the window where a twin birth stops being surprising
> opens around November 14. The most consequential academic decision of the
> semester has to be made two days before the information needed to make it
> arrives.

**Anything marked `kind: "estimate"` must render with a visible ESTIMATED tag
and the instruction to replace it with the real date from the OB.** The app must
never present a derived date as a medical fact. An absent measurement is never
displayed as a measurement.

---

## Part D - Three smaller surfaces, in priority order

**D1. Split the action queue by actor.** The money action center currently mixes
things the app computed with things only a human can do. Add
`actor: "human" | "app"` to each item. Human items render with a phone number or
a URL, a hard deadline, and a countdown; app items render with a computed value.
The header for the human column is "your hands, not the app's". Sergio's real
blocker is four phone calls, and they are currently indistinguishable from
informational cards.

**D2. Since you last looked.** Brianna has an account and no reason to open it,
because the app looks identical every time. Add a `household_views` table
`(household_id, user_id, last_seen_at)`, update it on route mount, and render a
single pane on home: what changed since that timestamp. Balances that moved, a
benefit status that changed, a proposal that was decided. If nothing changed,
say so in one line rather than showing an empty card.

**D3. The Sunday review.** There is a recurring 20-minute money review on the
shared calendar. Give it a surface: `/review`, four bounded steps on one screen
each - what came in, what went out, what changed, what to decide - ending in a
row written to a `reviews` table. Rituals keep an app alive; dashboards do not.
Keep it to 20 minutes of content or it will not survive a bad week.

**D4. Window clock (optional, only if D1-D3 land clean).** Some benefits are
time-boxed and expire silently: roughly 30 days to add a newborn to coverage,
WIC recertification, FAFSA opening. Render as a rail of windows with days
remaining. **Statuses only. No card numbers, no identifiers - constraint 3.**

---

## Part E - Acceptance criteria

A pass is done when all of these hold:

1. `npm run build` is green, all four stages.
2. `node --test test/*.test.js` is green.
3. `npm run heights` runs and its output is pasted into the PR description, with
   before and after numbers for every route touched.
4. No route scrolls horizontally at 360px, 390px, or 414px wide.
5. The converted routes fit the viewport at 1440x900 with no page scroll.
6. No pane shows a bottom fade when its content fits.
7. Line endings unchanged: `git diff --stat` shows no whole-file rewrites.
8. `git diff` contains no non-ASCII characters in new source.
9. No new dependency other than `playwright` as a devDependency.
10. `CANONICAL_APP_URL` and both Supabase URL settings are untouched.

## Part F - Stop and ask instead of guessing

Stop and report rather than proceeding if any of these come up:

- A layout fix appears to require changing a data-fetching or auth module.
- A route cannot be brought under budget without removing content. Removing
  content is a decision for Sergio, not for you.
- A test fails for a reason unrelated to your change.
- Any task seems to require a credential, a key, or a login.
- The work seems to require touching the domain or Supabase URL configuration.

Report format: what you changed, the height-budget table before and after, what
you did not do and why, and anything you noticed that is broken but out of
scope.
