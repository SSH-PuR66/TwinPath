// Twins prep catalog.
//
// Two hard rules govern this file and the test suite enforces both:
//
//   1. NO AFFILIATE PARAMETERS. Not `tag`, not `ref`, not `linkCode`, not a
//      partner id of any kind. TwinPath takes no referral credit. A cart link
//      here carries product identifiers and quantities and nothing else.
//   2. NO INVENTED IDENTIFIERS. Every ASIN below was read out of a real
//      amazon.com product URL during research. Every UNiDAYS and Student Beans
//      slug below was read off a real live page. A wrong identifier produces a
//      wrong cart, which is worse than no link. Where a slug could not be
//      confirmed the entry links to the platform home and names the brand in
//      text instead of guessing.
//
// Deep-link only. Nothing in this module completes a purchase.

export const PREP_VERIFIED_ON = "2026-07-29";

// Everything here is timed to the realistic arrival date, not the EDD. Both
// dates live in twinsDates.js so the countdown on Home and the copy on this
// surface can never drift apart again.
export { TWINS_EDD, TWINS_LIKELY_ARRIVAL } from "./twinsDates.js";

export const AMAZON_CART_BASE =
  "https://www.amazon.com/gp/aws/cart/add.html";

const ASIN_PATTERN = /^B[0-9A-Z]{9}$/;
const MAX_CART_LINES = 10;
const MAX_QUANTITY = 12;

export function isValidAsin(value) {
  return typeof value === "string" && ASIN_PATTERN.test(value);
}

// Builds https://www.amazon.com/gp/aws/cart/add.html?ASIN.1=..&Quantity.1=..
// Returns null rather than a half-built URL if anything fails validation.
export function buildCartUrl(lines) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  if (lines.length > MAX_CART_LINES) return null;

  const url = new URL(AMAZON_CART_BASE);
  let index = 0;

  for (const line of lines) {
    const asin = line?.asin;
    const quantity = Number(line?.qty ?? 1);

    if (!isValidAsin(asin)) return null;
    if (!Number.isInteger(quantity)) return null;
    if (quantity < 1 || quantity > MAX_QUANTITY) return null;

    index += 1;
    url.searchParams.set(`ASIN.${index}`, asin);
    url.searchParams.set(`Quantity.${index}`, String(quantity));
  }

  return url.toString();
}

export function cartUrlForItems(items) {
  const lines = (Array.isArray(items) ? items : [])
    .filter((item) => isValidAsin(item?.asin))
    .map((item) => ({ asin: item.asin, qty: item.qty || 1 }));

  return buildCartUrl(lines);
}

/* --------------------------------------------------------------------------
   Portals. Three storefronts, one tap each.
   -------------------------------------------------------------------------- */

export const portals = [
  {
    id: "unidays",
    name: "UNiDAYS",
    url: "https://www.myunidays.com/US/en-US",
    lead: "Groceries, memberships, tech.",
    truth:
      "There is no baby category in the US storefront. Do not go looking for one — the kids partner is GB-only and will not redeem on a US account.",
    picks: [
      {
        label: "Costco membership",
        detail:
          "$20 Digital Shop Card on Gold Star, $40 on Executive. New members only. Cached listings still showing $50 are stale.",
        url: "https://www.myunidays.com/US/en-US/partners/costco/view",
      },
      {
        label: "Walmart+ 50% off",
        detail:
          "Same $49/yr as Walmart+ Assist, re-routed — not additive. Take Assist instead: identical price, and it does not lapse when you graduate.",
      },
      {
        label: "HelloFresh / EveryPlate",
        detail: "50% off the first box. One-time, not a standing discount.",
      },
      {
        label: "Samsung, HP, Dell",
        detail:
          "Up to 30% / up to 71% / 10%. Apple is education pricing plus 10% off AppleCare+ — the gift-card figure floating around is page metadata, not a live offer.",
      },
    ],
  },
  {
    id: "studentbeans",
    name: "Student Beans",
    url: "https://www.studentbeans.com/student-discount/us",
    lead: "Where the two real wins are.",
    truth:
      "Target's listed \"60% student discount\" is not a student discount. Target has no year-round student offer — those are general Circle offers and clearance.",
    picks: [
      {
        label: "BJ's Wholesale — $20/year",
        detail:
          "Plus a $20 reward on $60 spent in the first 30 days. New members only. Best single membership price on either platform.",
        url: "https://www.studentbeans.com/student-discount/us/bj-s-wholesale-club",
      },
      {
        label: "Sam's Club — $25 Club / $55 Plus",
        detail: "About half of standard. New members only.",
        url: "https://www.studentbeans.com/student-discount/us/sam-s-club",
      },
      {
        label: "Instacart",
        detail:
          "2 weeks free, then $49 the first year and $99/yr after. Valid through Dec 31, 2026. Void if you are already a member.",
      },
      {
        label: "TryHackMe — 30% off yearly",
        detail:
          "Plus 15% off the SEC0 / SEC1 / SAL1 / PT1 certs. This beats going direct: tryhackme.com/students publishes only 20%.",
      },
    ],
  },
  {
    id: "amazon",
    name: "Amazon",
    url: "https://www.amazon.com/baby-reg/homepage",
    lead: "Registry first, then the carts below.",
    truth:
      "Enroll in the young-adult Prime path BEFORE you build the registry. Taking a standard 30-day trial to grab the welcome box can burn the 6-month free trial.",
    picks: [
      {
        label: "Prime for Young Adults",
        detail:
          "\"Prime Student\" no longer exists under that name. 6 months free, then $7.49/mo or $69/yr. Full Prime benefits, no reduced shipping tier.",
      },
      {
        label: "Then switch to Prime Access — $6.99/mo",
        detail:
          "For SNAP EBT / Medicaid / WIC / SSI / TANF holders. Cheaper than the student rate, identical benefits, and it does not expire at graduation or at 25. Take the 6 free months first, then move.",
      },
      {
        label: "Baby Registry",
        detail:
          "Welcome box valued up to $35, plus a 15% completion discount for Prime members, usable from 60 days before the due date through 90 days after. Free 90-day returns.",
        url: "https://www.amazon.com/baby-reg/homepage",
      },
      {
        label: "Run Target's registry too",
        detail:
          "Target's welcome kit is $100 in value against Amazon's $35. Both are free. There is no published twins bonus on either — no raised cap, no second box.",
      },
    ],
  },
];

/* --------------------------------------------------------------------------
   Kits. Each one is a rail card; selecting it opens the list below.
   -------------------------------------------------------------------------- */

export const kits = [
  {
    id: "arrival",
    label: "Arrival kit",
    short: "Arrival",
    icon: "package",
    when: "Bought and installed by Sep 30",
    headline: "The five things that must exist before a 35-week delivery",
    note:
      "Two car seats, two sleep surfaces, one twin nursing pillow, sixteen bottles, one stroller frame. That is the whole list. Everything else can arrive late.",
    items: [
      {
        name: "Evenflo LiteMax NXT infant seat",
        asin: "B0DXP9S96C",
        qty: 2,
        price: "≈$180 each",
        why: "Rated 3–30 lb — the lowest minimum weight found anywhere. Twins arrive small; this is the seat that still fits at 4 lb.",
      },
      {
        name: "Graco Pack 'n Play Close2Baby bassinet",
        asin: "B08K3314ZL",
        qty: 2,
        price: "≈$90 each",
        why: "Two of these beat one twin bassinet on cost and on AAP compliance at the same time. The HALO twin unit is $500+ and puts both babies on one surface.",
      },
      {
        name: "My Brest Friend Twin nursing pillow",
        asin: "B00PC3KVYA",
        qty: 1,
        price: "≈$74",
        why: "Tandem feeding needs a twin pillow. A regular Boppy does not work for this.",
      },
      {
        name: "Dr. Brown's Options+ 4 oz — four 4-packs",
        asin: "B01845QGKK",
        qty: 4,
        price: "≈$18 per 4-pack",
        why: "Sixteen bottles is the stated minimum for twins. You wash roughly sixteen a day, so part count is a real daily cost.",
      },
      {
        name: "Baby Trend Universal Double Snap-N-Go",
        asin: "B008U4MKU6",
        qty: 1,
        price: "≈$110",
        why: "The cheapest thing that carries two infant seats. Confirm your seat model is on Baby Trend's fit list — \"universal\" is the manufacturer's claim, not a guarantee.",
      },
    ],
  },
  {
    id: "seats",
    label: "Car seats",
    short: "Seats",
    icon: "car",
    when: "The one item that cannot be late",
    headline: "Infant buckets. Not convertibles.",
    note:
      "Four reasons, all of them specific to twins: preemie fit needs a low harness slot and a 4 lb rating; the NICU car seat tolerance test is done in the seat you bring; one adult cannot carry two babies, so the click-out bucket is the entire mechanism; and the cheapest twin stroller only accepts buckets.",
    items: [
      {
        name: "Evenflo LiteMax NXT",
        asin: "B0DXP9S96C",
        qty: 2,
        price: "≈$180",
        why: "3–30 lb. The preemie pick.",
      },
      {
        name: "Chicco KeyFit 30 ClearTex + base",
        asin: "B09LKZFKGD",
        qty: 2,
        price: "≈$200",
        why: "Consumer Reports Value Pick at 88/100 with their highest crash-protection rating, updated May 2026. BabyGearLab scores it 69 — but that review is from Oct 2023. Weight the newer one.",
      },
      {
        name: "Chicco KeyFit + base, 4–30 lb",
        asin: "B07MLW6ZSQ",
        qty: 2,
        price: "≈$190",
        why: "Same seat family, 4 lb floor.",
      },
      {
        name: "Chicco KeyFit 30 Easy Level base — 2-pack",
        asin: "B07T25WNL3",
        qty: 1,
        price: "≈$150",
        why: "Two cars times two babies is up to four bases. This is the only 2-pack found, and it is the reason to pick Chicco if a second car is in play.",
      },
      {
        name: "Graco SnugRide Lite LX",
        asin: "B07Y5S4VWT",
        qty: 2,
        price: "≈$150",
        why: "BabyGearLab Best Value.",
      },
      {
        name: "Evenflo LiteMax 35",
        asin: "B08TX4GYTB",
        qty: 2,
        price: "≈$125",
        why: "Cheapest viable pair.",
      },
    ],
    warnings: [
      "Car seats are bought new. No exceptions. Used seats carry invisible crash damage, an expiration date you cannot see, missing parts, and no registration — so you never hear about a recall.",
      "Free installation check: Westchester Medical Center / Maria Fareri, 100 Woods Road, Valhalla. No appointment. They inspect seats; they do not hand them out.",
    ],
  },
  {
    id: "sleep",
    label: "Sleep",
    short: "Sleep",
    icon: "moon",
    when: "Two surfaces, both cheap",
    headline: "Two Pack 'n Plays beat one twin bassinet",
    note:
      "About $90 each against $500+ for a HALO BassiNest Twin, and two separate surfaces is what the AAP actually asks for. The expensive option is worse on both axes.",
    items: [
      {
        name: "Graco Pack 'n Play Close2Baby bassinet",
        asin: "B08K3314ZL",
        qty: 2,
        price: "≈$90 each",
        why: "Bassinet insert, folds, travels, doubles as the playard later.",
      },
      {
        name: "Graco Pack 'n Play with bassinet — Tinker",
        asin: "B00H8MRBI2",
        qty: 2,
        price: "≈$85 each",
        why: "Same idea, older colorway, often cheaper.",
      },
      {
        name: "Graco Pack 'n Play On The Go",
        asin: "B09MWHG3ZT",
        qty: 2,
        price: "≈$80 each",
        why: "Lightest of the three.",
      },
    ],
    warnings: [
      "Crib bumpers and inclined sleepers are federally banned under the Safe Sleep for Babies Act. It is illegal to sell a recalled product — that does not stop them appearing on resale sites.",
      "The current AAP safe-sleep policy is the 2022 statement. There is no 2025 or 2026 replacement; anything marketing \"AAP 2026 guidelines\" is wrong.",
      "On twins sharing one surface the sources genuinely disagree: AAP says separate surfaces because evidence is insufficient, the UK Twins Trust permits co-bedding feet-to-foot in a full-size cot until rolling. Two cheap surfaces makes the disagreement moot.",
    ],
  },
  {
    id: "feeding",
    label: "Feeding",
    short: "Feeding",
    icon: "milk",
    when: "Buy the pillow, not the pump",
    headline: "One pillow, sixteen bottles, zero pumps",
    note:
      "NY Medicaid covers a manual or personal double-electric pump through pregnancy and twelve months postpartum — prescription, then a participating pharmacy or DME vendor. Hospital-grade is rentable if there is a NICU stay. Do not buy a pump.",
    items: [
      {
        name: "My Brest Friend Twin",
        asin: "B00PC3KVYA",
        qty: 1,
        price: "≈$74",
        why: "Best value in twin nursing pillows.",
      },
      {
        name: "Twin Z pillow",
        asin: "B007VEBMBO",
        qty: 1,
        price: "≈$119",
        why: "Lucie's List top pick. Six positions, doubles as a prop pillow.",
      },
      {
        name: "Dr. Brown's Options+ 4 oz 4-pack",
        asin: "B01845QGKK",
        qty: 4,
        price: "≈$18 each",
        why: "Four packs gets you to sixteen. One brand only — mixing brands multiplies the parts you wash.",
      },
      {
        name: "Dr. Brown's Options+ gift set",
        asin: "B01N34NNJK",
        qty: 2,
        price: "≈$40 each",
        why: "Bottles plus brush plus cleaning tools if you would rather buy it as a set.",
      },
    ],
    math: {
      title: "Formula, if fully formula-fed",
      rows: [
        ["Month 1", "≈40 oz/day for both", "≈1,200 fl oz", "≈13 cans"],
        ["Month 2", "≈52 oz/day", "≈1,560 fl oz", "≈17 cans"],
        ["Month 3", "≈60 oz/day", "≈1,800 fl oz", "≈20 cans"],
      ],
      footer:
        "≈51 cans across three months: $760 store brand to $1,013 name brand. NY WIC issues 9 cans per infant per month at 0–3 months — 18 for twins — which covers essentially all of months 1 and 2.",
    },
    warnings: [
      "Do not stockpile formula before you know the NY WIC contract brand. WIC only covers specific contract formulas and Similac Advance is not one of them. Buying the wrong brand in bulk converts a covered expense into an uncovered one.",
    ],
  },
  {
    id: "diapers",
    label: "Diapers",
    short: "Diapers",
    icon: "baby",
    when: "Bulk only",
    headline: "The pack size costs more than the brand",
    note:
      "Buying in small packs instead of bulk costs about $200 across three months. That is larger than any brand decision on this page.",
    items: [
      {
        name: "Pampers Swaddlers Newborn, 84 ct",
        asin: "B07CVBTN3N",
        qty: 2,
        price: "≈$28",
        why: "Two packs maximum. Newborn size is outgrown fast, and twins born early still move through it quickly.",
      },
      {
        name: "Pampers Swaddlers Size 1, 198 ct",
        asin: "B07DCCP3Y1",
        qty: 2,
        price: "≈$55",
        why: "This is the size you actually live in. Buy the big box.",
      },
      {
        name: "Pampers Swaddlers Size 1, 164 ct",
        asin: "B08PX2V52Q",
        qty: 2,
        price: "≈$48",
        why: "Smaller box if the 198 is out of stock.",
      },
    ],
    math: {
      title: "Three months, both babies",
      rows: [
        ["Month 1", "20 diapers/day", "≈600", "—"],
        ["Months 2–3", "16 diapers/day", "≈480 each month", "—"],
        ["Total", "—", "≈1,560 diapers", "≈3,900 wipes"],
      ],
      footer:
        "≈$218 store-brand bulk · ≈$312 Pampers bulk · ≈$437 in small packs. Free local diaper help: 914Cares (914-458-5220) and The Sharing Shelf, 47 Purdy Ave, Port Chester (914-305-5950).",
    },
  },
  {
    id: "wheels",
    label: "Wheels",
    short: "Wheels",
    icon: "cart",
    when: "Frame first, real stroller later",
    headline: "Every \"best double stroller\" list is wrong for you",
    note:
      "Those lists optimize for a toddler plus a baby. The BabyGearLab #1 overall takes one infant car seat. Joggers take one. You need something that takes two buckets, and the cheapest correct answer is a car-seat frame.",
    items: [
      {
        name: "Baby Trend Universal Double Snap-N-Go",
        asin: "B008U4MKU6",
        qty: 1,
        price: "≈$110",
        why: "Frame only, holds two infant seats, folds flat. The correct first stroller.",
      },
      {
        name: "Joovy Twin Roo+ with Chicco adapters",
        asin: "B01LZBEZYY",
        qty: 1,
        price: "≈$200",
        why: "Better build than the Snap-N-Go, but adapters are brand-specific — this bundle is the Chicco one.",
      },
      {
        name: "Evenflo Pivot Xpand WITH second seat",
        asin: "B0D59NZ1DW",
        qty: 1,
        price: "≈$450",
        why: "The only realistic sub-$500 stroller that takes two infant seats now and converts to two toddler seats later. Buy this one if you want one stroller for years.",
      },
    ],
    warnings: [
      "Do not order ASIN B0BRMFYKM7. BabyGearLab lists it as the \"Pivot Xpand Double\" but Amazon's own title is the single-seat stroller with no second seat. The twins SKU is B0D59NZ1DW. This exact mislabel is how people end up with one seat and two babies.",
      "Used is fine for strollers made after Sep 10, 2015, cribs after 2011, and high chairs after June 2019. Never used: car seats, crib mattresses, anything recalled, and Boppy Newborn Loungers — those were recalled after infant deaths and still circulate on Marketplace.",
    ],
  },
  {
    id: "memberships",
    label: "Memberships",
    short: "Perks",
    icon: "ticket",
    when: "Do these in order",
    headline: "The sequence matters more than the individual offers",
    note:
      "Both platform accounts can be held at once off the same .edu address, but only one code applies per order. The ordering below is the part that is easy to get wrong and expensive to undo.",
    steps: [
      "Enroll in Prime for Young Adults first — 6 months free. Do not take a standard 30-day Prime trial before this; it can burn the 6-month one.",
      "Build the Amazon baby registry once Prime is active. Ten items on it and $10 purchased from it unlocks the welcome box.",
      "Open the Target registry too. $100 welcome kit against Amazon's $35, and running both is free.",
      "Join Student Beans, take BJ's at $20/yr. That is the single best membership price available to you.",
      "Join UNiDAYS, take the Costco shop card if you want Costco. Otherwise skip it.",
      "When the 6 free Prime months end, switch to Prime Access at $6.99/mo if any benefit card is in hand. It is cheaper and it never expires.",
      "Use the 15% registry completion discount for the big purchase, from 60 days before the due date through 90 days after.",
    ],
    warnings: [
      "Amazon Family's 20% diaper subscription now requires 5+ Subscribe & Save items in a month to one address. Guides saying the diaper subscription alone qualifies are out of date.",
      "Walmart+ Student and Walmart+ Assist are both $49/year. Take Assist — it does not lapse when you graduate.",
    ],
  },
];

export const realisticBudget = {
  low: 700,
  high: 950,
  contrast: "$3,000–5,000",
  note:
    "That is what this list actually costs, against what a standard twin registry implies. The gap is mostly things marketed as twin-specific that two cheap singles do better.",
};
