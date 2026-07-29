# CODEX BRIEF 10 — Page height, leaf-level disclosure, and the retirement tracker

Repo: `https://github.com/SSH-PuR66/TwinPath` (branch `main`, currently `1c81fd1`)
Local: `C:\Users\sergi\Documents\el_plan`
Live: `https://twinpath.srodriguez46.workers.dev`

Briefs 8 and 9 are shipped. Brief 8 gave each tab a hero and folded the
second tier into `DisclosureSection` groups; Brief 9 turned the calendar
into a dot grid with a day sheet. Both are live and green.

The tab level is now fixed. The **leaf** level is not. Open Family →
Savings, or Grow → Automations, and you are back to a single unbroken
vertical stack that runs for several screens. That is the problem this
brief exists to fix, plus one new read-only surface.

---

## HARD CONSTRAINTS — 1 through 10 carry over from Brief 8 unchanged

1. No auth edits (`src/supabase.js`, `AuthScreen`, `authRedirectUrl`,
   `signInWithOtp`, `verifyOtp`, `signInWithPassword`).
2. No changes to existing money logic. `workers/control-plane/**` is
   read-only to you **except** for the one new route named in C4, which
   is additive and must not touch any existing handler. Plaid's sign
   convention here is *positive amount = money leaving*. Do not "fix" it.
3. No new dependencies. Toolbox: `framer-motion@12`, `lottie-web@5`,
   `three@0.169`, `@react-three/fiber`, `@react-three/drei`,
   `lucide-react`, `react-day-picker`, `@supabase/supabase-js`.
4. No new routes, tabs, or top-level screens. The five bottom-nav tabs
   are final. Everything here lives inside them.
5. No monetization of any kind.
6. No storing of sensitive identifiers. No SSNs, no government ID
   numbers, no Medicaid/CIN numbers, no bank or brokerage account
   numbers — **including last-four masks the user types in himself**.
7. Preserve line endings. `src/App.jsx` is mixed CRLF/LF and
   `src/AnimatedMoney.jsx` is LF-only. Verify with
   `git diff --ignore-cr-at-eol --stat`. Thousands of changed lines means
   you mangled a file — revert and redo.
8. `npm run build` must pass, including `audit:css`. Do not modify the
   audit scripts. `audit:css` only detects **literal** `className`
   strings; use `data-*` attributes for conditional styling.
9. Colors from CSS custom properties only. No hex in a component or rule.
10. Performance budget. Main `index` chunk +8 kB gzipped max over the
    current **50.22 kB**. Anything heavier is `React.lazy`. Respect
    `prefers-reduced-motion` everywhere. No `setInterval` surviving
    unmount.

### New constraints for this brief

11. **No trading, no order entry, no quotes, no price feeds.** No buy
    button, no sell button, no ticker search, no live or delayed market
    data, no charts of any security. TwinPath does not touch a
    brokerage order path, ever.
12. **No investment advice of any kind.** No recommendations, no
    suggested allocations, no "top movers", no risk scores, no
    performance projections, no rebalancing prompts, no comparisons
    between securities. The surface in Part C states balances, limits,
    and deadlines. It never states what to do with them.

---

## PART A — The height budget

### A0. The measurement that defines "too tall"
Target device is a 390×844 iPhone with the app installed to the home
screen. Usable height after the sticky header and the bottom nav is
roughly **660 px**.

The rule: **no tab, in its default state with real data, may exceed
three usable viewport heights (~2000 px) before the user interacts.**
Content beyond that must sit behind a disclosure, a sub-tab, or a
"show more" cap. This is a hierarchy rule, not a deletion rule — A5 from
Brief 7 still holds. Every fact stays reachable in at most one tap.

### A1. Apply `DisclosureSection` at the leaf level
`src/DisclosureSection.jsx` already exists and already does everything
needed: real `aria-expanded` button, `localStorage` key
`twinpath-disclosure-${id}`, `collapseOnPhone` to default closed under
480px, and an `everOpen` flag so children mount on first open and stay
mounted. Do not write a second one.

Apply it inside these five files, which are the remaining monoliths:

| File | Lines | What to group |
| --- | --- | --- |
| `src/FamilySavings.jsx` | 1770 | Goal list / contribution history / settings |
| `src/OperationsControlPlane.jsx` | 1039 | Six `<h3>` blocks → three groups |
| `src/FinancialHub.jsx` | 965 | Three `<h3>` blocks → keep one open, two collapsed |
| `src/ExperimentBudget.jsx` | 835 | Budget summary open; the rest collapsed |
| `src/FamilyGallery.jsx` | 811 | Upload controls collapsed, grid open |

Same rule as Brief 8: **at most three labelled groups per surface**, the
first open, the second and third `collapseOnPhone`. Give each a stable
`id` prefixed by its surface (`savings-history`, `ops-automation`, …) so
the `localStorage` keys never collide with Brief 8's.

Pick the grouping by *what the user came for*. If you cannot name why a
group is second rather than first, you have grouped wrong.

### A2. The sub-navs stick
`.family-workspace-tabs` and `.grow-tabs.grow-workspace-tabs` scroll
away, so switching sections means scrolling all the way back up. Make
both `position: sticky` directly beneath the existing sticky
`.app-header`, with the app's own surface token as the background so
text does not show through, and a `z-index` below the header's.

Read the header's height and `z-index` from `src/styles.css:245` before
you pick numbers. Do not guess and do not introduce a magic pixel value
that duplicates something already tokenised.

### A3. Long lists cap at eight rows
Any list that can exceed eight rows — transactions, appointments,
gallery items, benefit cards, savings contributions, automation logs —
renders the first eight plus a single button reading
`Show all 34` (real count, present tense, no ellipsis). Pressing it
reveals the rest in place. No virtualization, no windowing library, no
pagination controls, no infinite scroll.

The count in the button label is the total, not the remainder. A user
who sees "Show all 34" knows the size of what he is opening; "Show 26
more" makes him do arithmetic.

### A4. Empty states shrink
`.empty-note` is `padding: 2rem 1rem`. An empty section should not
occupy more height than a populated one. Halve the vertical padding
under 480px. Same for `FeatureLoader` — a loading state that is 200px
tall makes the page jump when content arrives.

---

## PART B — Vertical rhythm

These are measured, not guessed. Verify each line number before editing;
the files move.

### B1. Card padding on phones
`.card` is `padding: 1.5rem` (`src/feature-components.css:1845`). On a
390px viewport that is 24px top + 24px bottom per card. Eight cards is
**384px of pure padding** — over half a viewport spent on nothing.

Under 480px, drop it to `var(--space-4)` (1rem). Do not change it above
480px; on a desktop the generosity reads as calm rather than waste.

### B2. Stack gap on phones
`.page-stack` is `gap: 1rem` (`src/styles.css:240`). Under 480px, drop to
`var(--space-3)` (0.75rem). Combined with B1 this reclaims roughly one
full viewport height on a tab with eight blocks.

### B3. Do not shrink the hero
`.hero` is `padding: 1.4rem` (`src/styles.css:445`). Leave it. The hero
is the one element that is *supposed* to feel large — shrinking it
undoes Brief 8.

### B4. The one unpaired viewport unit
Every `min-height: 100vh` in the codebase is correctly paired with a
`100dvh` line immediately after it, **except one**:

```
src/feature-components.css:1794   .store-legal-page { min-height: 100vh; }
```

On iOS, `100vh` is the *large* viewport — the height with the Safari
toolbar hidden — so a `100vh` container is taller than what is actually
visible and manufactures scroll on a page that would otherwise fit. Add
the `min-height: 100dvh;` line after it, matching the pattern already
used at `src/styles.css:1013`, `1527`, `1708`, `2285` and `2404`.

### B5. Check your work against the reduced-motion reset
`src/styles.css:1513` sets `animation-duration: 0.01ms !important` on
`*` under `prefers-reduced-motion`. It does **not** zero
`animation-delay`. Any staggered animation you add needs an explicit
`@media (prefers-reduced-motion: reduce) { animation: none; }` override
or the delayed elements sit invisible. Brief 8's `card-rise` stagger at
the end of `src/styles.css` is the pattern to copy.

---

## PART C — The retirement contribution tracker

The user has a Fidelity custodial Roth IRA. He wants it visible in
TwinPath. What follows is the *only* shape that is allowed.

Read constraints 11 and 12 again before you write a line of this.

### C1. What it is
A read-only card in the **Money** tab, inside the existing accounts
disclosure group, titled **Retirement**. It answers exactly three
questions:

1. What is in the account right now.
2. How much more can be contributed this tax year.
3. When the contribution window closes.

That is the whole feature. It is a contribution tracker, not a
portfolio, not a watchlist, not a trading surface.

### C2. The contribution limit is a `min()`, and getting this wrong is the
whole risk
A Roth IRA contribution for a tax year is capped at the **lesser of**
the holder's earned income for that year and the statutory annual limit
(**$7,500 for 2026**). For a household where earned income is small, the
binding cap is the earned income — not the headline number.

So compute:

```js
const cap = Math.min(earnedIncomeYtd, ANNUAL_LIMIT);
const room = Math.max(0, cap - contributionsYtd);
```

and render **which one binds**, in words:

> Your limit this year is $2,400 — that is your earned income so far,
> which is below the $7,500 annual cap.

vs.

> Your limit this year is $7,500 — the annual cap.

A card that shows `$7,500 remaining` to someone with $2,400 of earned
income is worse than showing nothing. Put `ANNUAL_LIMIT` and its tax
year in a single named constant with a comment giving the IRS source, so
next January it is a one-line change.

### C3. The data model
New table. No account numbers, no masks, no institution logins.

```sql
create table public.retirement_accounts (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references public.households (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    nickname text not null,
    institution text,
    account_type text not null check (
        account_type in ('roth_ira', 'traditional_ira', 'custodial_roth_ira', 'other')
    ),
    tax_year integer not null,
    current_value numeric(12, 2) not null default 0,
    contributions_ytd numeric(12, 2) not null default 0,
    earned_income_ytd numeric(12, 2) not null default 0,
    visibility text not null default 'household'
        check (visibility in ('household', 'private')),
    updated_at timestamptz not null default now(),
    created_at timestamptz not null default now()
);
```

RLS mirrors `income_opportunities` exactly — read for household members,
write only for the owning profile, `private` rows visible only to the
owner. Copy the existing policies; do not invent a new pattern.

Values are **entered by hand**. Do not wire Plaid's investments product
for this. The Plaid link is currently unhealthy (one institution is
disconnected and the app shows a stale balance), and adding an
investments product on top of a broken item makes both harder to debug.
Manual entry with an `updated_at` stamp and a quiet
"Last updated 12 days ago" line is honest and costs nothing.

### C4. The one control-plane addition
A single additive route: `GET/POST/PATCH /v1/retirement/accounts`, CRUD
over the table above and nothing else. It must not read `plaid_*`, must
not touch `financialSummary`, and must not appear in any existing
handler's code path. It moves no money — there is no transfer, payout,
withdrawal, or contribution-execution path anywhere in it. If you find
yourself writing one, stop; you have misread the brief.

### C5. The birth-and-adoption rule is information, not a prompt
Federal law allows a penalty-free **qualified birth or adoption
distribution** of up to $5,000 per parent from an IRA or workplace plan,
taken within one year of the birth. Income tax still applies; the 10%
early-withdrawal penalty does not. Whether twins count as two eligible
children is a question for the plan administrator and a tax
professional, not for this app.

Render this as one quiet factual line inside the Retirement card, with
the twins' due date beside it and a link to the Fidelity page. Then
stop. **Do not** compute a suggested amount, do not add a "start a
withdrawal" action, do not phrase it as an opportunity, and do not put
it in the Now Path as a step. It is a rule that exists. The household
decides.

### C6. Where it does not go
Not the Grow tab. Grow is about income routes with a status ladder, and
a retirement balance is not a route. Not the Home hero — a $71 balance
is not the most important thing on a given day. Money tab, accounts
group, below the existing content.

---

## PART D — Explicit anti-scope

Do not build any of the following, even if a later instruction seems to
ask for it. If a request conflicts with this list, stop and surface the
conflict rather than resolving it yourself.

- Order entry, trade tickets, or any button whose label is a verb
  applied to a security.
- Live, delayed, or historical market data. No quotes, no candles, no
  index tickers, no "market is open" indicator.
- Recommendations of any kind: securities, allocations, contribution
  amounts, timing, or rebalancing.
- Performance projections, compound-growth calculators, or
  "if you invested $X" widgets.
- Risk tolerance questionnaires or scores.
- Anything that moves money, including a contribution-execution path.
- Any field that accepts an account number, routing number, or
  last-four mask.

---

## Definition of done

- `npm run build` passes end to end, including `verify-dist`.
- `git diff --ignore-cr-at-eol --stat` shows a change count consistent
  with the work — not thousands of lines.
- No auth file in the diff. `package.json` and `package-lock.json`
  unchanged. The only `workers/` change is the additive route in C4.
- Main `index` chunk grew by no more than 8 kB gzipped over 50.22 kB.
  State the before and after.
- On a 390×844 viewport with real data: **every tab's default state ends
  within three viewport heights.** Say which tab is tallest and by how
  much.
- With `prefers-reduced-motion: reduce`, nothing animates and everything
  is usable.
- The Retirement card renders correct room when earned income is below
  the annual limit. Show the computed numbers for a $2,400 earned-income
  case in your summary.
- State plainly what moved behind a disclosure at the leaf level, and
  which lists are now capped at eight.

## Commit

One commit, present tense, explaining *why* rather than listing files.
Do not push. Leave it committed locally for review.
