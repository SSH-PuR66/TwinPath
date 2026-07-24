# Codex Brief 5 — The Storefront Flip (Gumroad → Stripe, generic → lived expertise)

Scope: PUBLIC storefront only (/shop). Do not touch the private app.
Backend done: buy.stripe.com allowlisted in safeUrl.js; three LIVE Stripe
products + payment links exist; price IDs registered in wrangler config.

## New catalog (replace the generic cyber PDFs in storeProducts.js)
1. **The Student-Parent Money Map: New York Edition** — $29
   Checkout: https://buy.stripe.com/5kQ9AVdgi7vYcPp5WAes004
   Pitch: the benefits most families never claim, the appeal mechanics
   that are federally required to work, the deadline calendar — cited,
   verified, lived. Content source: docs/MASTER-PLAN.md (rewrite as a
   polished buyer-facing guide; strip all personal identifiers).
2. **Before the Twins: The Benefits Checklist System** — $19
   Checkout: https://buy.stripe.com/3cIcN77VYdUmcPp2Koes005
   Content source: Master Plan Tier 1 + Appendix A, generalized.
3. **Digital Safety Setup for New Parents — 1:1 Session** — $49
   Checkout: https://buy.stripe.com/aFa8wR2BE17A2aLbgUes006
   Service listing: what's included, 60-90 min, remote or Hudson Valley
   local, credentials line (CCST, ISC2 CC, Blue Team pathway).

## Storefront reframe
- Positioning: "Money systems from a family actually living them" —
  not generic cyber products. Story-first: built by a student-parent
  family, verified against primary sources, updated as rules change.
- Keep legacy Gumroad products in a collapsed "archive" section or
  remove; new catalog leads.
- Trust elements near buy buttons: secure Stripe checkout badge, refund
  policy link, "updated July 2026" freshness stamp.
- IMPORTANT: guides ship as PDFs. Until fulfillment automation exists,
  after-purchase fulfillment is manual (email the PDF) — add a line
  under each buy button: "Delivered to your email within 24 hours."
  Claude will draft the two guide PDFs from the docs next session.
- No earnings claims anywhere; educational-not-advice disclaimer in
  footer for the money guides.

Contracts: tests + build green; CSP unchanged (payment links open in
new tab, rel=noopener); private app untouched.
