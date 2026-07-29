// Aid, tax and benefit actions that have a date attached, ranked by dollars at stake.
//
// Two rules this file enforces, same as twinsPrepCatalog.js:
//
//   1. No dollar figure and no deadline goes in here without a citation in `source`.
//      If a number can't be traced to a regulation, a statute or an agency page,
//      it doesn't belong on a screen that someone is going to act on.
//
//   2. Nothing in here holds a person's medical, financial or identity data.
//      An action may TELL you to write a number down. No action may store one.
//      The SSI action is the live example: it says to record birth weights in
//      grams, and deliberately gives you nowhere in this app to put them.
//
// Verified against primary sources on AID_VERIFIED_ON. Anything that turns over
// annually (Pell max, PFL cap, FPL table, TAP ceiling) is marked in `source` so
// a stale figure is visible rather than silently wrong.

import { TWINS_EDD, TWINS_LIKELY_ARRIVAL } from "./twinsDates.js";

export const AID_VERIFIED_ON = "2026-07-29";
export { TWINS_EDD, TWINS_LIKELY_ARRIVAL };

export const IONA_SCHOOL_CODE = "002737";

export const tracks = [
    { id: "all", label: "Everything", short: "All" },
    { id: "aid", label: "Federal & state aid", short: "Aid" },
    { id: "tax", label: "Tax", short: "Tax" },
    { id: "benefits", label: "Benefits", short: "Benefits" },
    { id: "birth", label: "At the birth", short: "At birth" },
];

// trigger.kind:
//   "asap" — nothing gates it, and waiting costs money
//   "date" — a real published deadline, ISO
//   "birth" — fires on the twins' arrival, planned against TWINS_LIKELY_ARRIVAL
export const actions = [
    {
        id: "census-policy",
        track: "aid",
        trigger: { kind: "asap" },
        title: "Ask Iona whether they honor a mid-year dependency update",
        do: "Email SFS and ask in writing: if my dependency status changes in December, will you reprocess my 2026-27 award, or does a census date close it?",
        why: "This one answer decides whether the single biggest number below is real or dead. The regulation makes the update mandatory on your side; some schools still set an internal census date. Ask before December, not after.",
        value: { low: 11400, unit: "year" },
        valueNote: "gates the FAFSA update below",
        source: "34 CFR 668.55(a) + 34 CFR 668.59(b)(1)",
        url: "https://www.ecfr.gov/current/title-34/subtitle-B/chapter-VI/part-668/subpart-E/section-668.55",
        phone: "(914) 633-2497",
        contact: "Iona SFS · sfs@iona.edu · McSpedon Hall, 2nd floor",
    },
    {
        id: "fafsa-on-file",
        track: "aid",
        trigger: { kind: "asap" },
        title: "Confirm a 2026-27 FAFSA exists and Iona is listed on it",
        do: "Log in to studentaid.gov, open the 2026-27 Submission Summary, confirm it says Submitted and that school code 002737 is on the list.",
        why: "Your Fall award is 100% institutional — no Pell, no TAP, no loan of any kind. Direct Unsubsidized is not need-based, so a zero there is an anomaly, not a low-income determination. The likeliest cause is that the ISIR never reached Iona. If the code is missing, the Data Release Number on that same summary is what SFS uses to add it.",
        value: null,
        valueNote: "gates every federal dollar",
        source: "FSA Handbook 2026-27 Vol 3 Ch 3; Iona code 002737 per ED Federal School Code List",
        url: "https://studentaid.gov",
    },
    {
        id: "fafsa-update-at-birth",
        track: "aid",
        trigger: { kind: "birth" },
        title: "Update the FAFSA to independent the week the twins arrive",
        do: "Log back in to the 2026-27 FAFSA and answer yes to the children question, family size 3. Then tell SFS you have done it.",
        why: "Having children makes you independent by statute — no dependency override, no professional judgment, no argument with anyone. The regulation says an applicant whose dependency status changes during the award year must update. Independent with dependents runs Formula B, which floors your SAI at negative 1,500 and pays the full Pell for the entire award year, retroactively. It also lifts your loan ceiling from $5,500 to $9,500.",
        value: { low: 11400, unit: "year" },
        valueNote: "$7,395 Pell + $4,000 more loan capacity",
        source: "HEA §480(d); 34 CFR 668.55(a); 34 CFR 668.59(b)(1); Pell max $7,395 per GEN-26-01",
        url: "https://studentaid.gov",
    },
    {
        id: "tap",
        track: "aid",
        trigger: { kind: "date", on: "2027-06-30" },
        title: "File the NYS TAP application",
        do: "Apply at tap.hesc.ny.gov/totw. It is a separate application from the FAFSA — filing the FAFSA does not file this.",
        why: "Most students who miss TAP miss it because they assume the FAFSA covered it. Once you have children, the income test stops looking at your parents and starts looking at you, against the same $125,000 ceiling. Same form, completely different number.",
        value: { low: 1000, high: 5665, unit: "year" },
        source: "NYS HESC; independent-with-dependents NTI ceiling $125,000; AY 2026-27 deadline June 30, 2027",
        url: "https://tap.hesc.ny.gov/totw",
    },
    {
        id: "coa-dependent-care",
        track: "aid",
        trigger: { kind: "birth" },
        title: "Ask Iona to add a dependent-care allowance to your cost of attendance",
        do: "Submit Iona's professional judgment request with actual child-care costs for class time, study time and commuting. Allow about 15 business days.",
        why: "This is a statutory component of cost of attendance for students with dependents, not a favor being asked. Raising COA raises the gap between COA and your aid, and unsubsidized loan eligibility is calculated off exactly that gap.",
        value: null,
        valueNote: "raises loan headroom",
        source: "HEA Sec. 472; FSA Handbook 2026-27 Vol 3 Ch 2",
    },
    {
        id: "health-waiver",
        track: "aid",
        trigger: { kind: "date", on: "2026-09-18" },
        title: "Submit the Iona health insurance waiver",
        do: "Waive the student plan before the deadline or it auto-bills.",
        why: "Miss it and the charge posts to your student account for the year. Open question worth resolving first: the waiver asks for a U.S.-based insurance company, and whether NY Medicaid or an Essential Plan satisfies that wording is unresolved. Ask SFS before you assume either way.",
        value: { low: 4657, unit: "once" },
        source: "Iona student health insurance waiver terms",
    },
    {
        id: "efile-detect",
        track: "tax",
        trigger: { kind: "asap" },
        title: "Find out whether your parents claimed you",
        do: "E-file your own return without checking the box that says someone can claim you as a dependent. If it rejects with code IND-516, someone has already claimed your SSN. If it goes through, nobody has.",
        why: "The IRS is legally barred from telling you who claimed you, and no transcript type shows it — not Tax Return, not Tax Account, not Wage and Income. The reject code is the only reliable detector there is. If it rejects, you paper-file within 10 days and the IRS adjudicates it from there.",
        value: { low: 3600, high: 5600, unit: "year" },
        valueNote: "EITC + CTC swing",
        source: "IRS MeF business rule IND-516; irs.gov Identity Theft — Dependents",
        phone: "800-829-1040",
    },
    {
        id: "support-worksheet",
        track: "tax",
        trigger: { kind: "asap" },
        title: "Run the support test honestly, on paper",
        do: "Fill in Publication 501 Worksheet 2. Scholarships come out of the calculation entirely, on both sides. Student loans in your own name count as support you provided.",
        why: "That second rule is the one nearly everyone gets backwards, and it is the one most likely to flip your answer. Money you borrowed and spent is your money for this test, counted in the year you spend it, not the year you repay it. Wages you spent count too. Savings you didn't spend do not.",
        value: null,
        valueNote: "decides the question above",
        source: "IRC §152(f)(5); IRS Pub 501 Worksheet 2 and Example 2",
        url: "https://www.irs.gov/forms-pubs/about-publication-501",
    },
    {
        id: "it201-item-c",
        track: "tax",
        trigger: { kind: "asap" },
        title: "Check Item C on your New York return",
        do: "On Form IT-201, Item C asks whether you can be claimed on someone else's return. Check what you answered, and check whether you claimed the IT-272 college tuition credit.",
        why: "New York punishes this harder than the federal return does. Marking yes drops your standard deduction from $8,000 to $3,100 and kills the household credit outright. The instruction is explicit that you mark yes even if the other person never actually claimed you.",
        value: null,
        valueNote: "$4,900 of deduction",
        source: "NYS Form IT-201 instructions, Item C; Form IT-272",
    },
    {
        id: "ta-westchester",
        track: "benefits",
        trigger: { kind: "asap" },
        title: "Apply for Temporary Assistance at Westchester DSS",
        do: "Apply for Brianna and the children. Bring medical verification of the pregnancy.",
        why: "The cash is the smaller half of this. Applying for or receiving public assistance triggers a guaranteed child care benefit under state regulation, which is how you get around the county's child care waiting list rather than sitting on it. Verified pregnancy also adds a $50 monthly allowance, and a HEAP approval that follows auto-enrolls you in Con Edison's discount for 18 months.",
        value: { low: 11768, unit: "year" },
        valueNote: "at household of 4, plus guaranteed child care",
        source: "18 NYCRR Part 415; 18 NYCRR 352.7(k); Westchester DSS schedules SA-2a/2b/2c",
        phone: "(914) 995-3333",
        contact: "after-hours emergencies (914) 995-2099",
    },
    {
        id: "pfl-clock",
        track: "benefits",
        trigger: { kind: "asap" },
        title: "Start the paid-family-leave clock now",
        do: "Take a job at 20+ hours a week. Twenty-six consecutive weeks of work is the eligibility bar, and the clock has to run before the birth, not after.",
        why: "Start in August and you clear 26 weeks around February 2027, which lands inside the twelve months after the birth when bonding leave can be taken — and it can be taken in full-day increments rather than all at once. Wait until the twins are here and the clock starts too late to matter.",
        value: { low: 2734, unit: "once" },
        valueNote: "12 weeks at 67% of average weekly wage",
        source: "NY Paid Family Leave; 2026 cap $1,228.53/week; 2027 rate not yet published",
    },
    {
        id: "doula",
        track: "benefits",
        trigger: { kind: "asap" },
        title: "Line up a doula through Medicaid",
        do: "Confirm the doula participates with Brianna's Medicaid managed care plan specifically, then book.",
        why: "Eight visits across pregnancy and postpartum plus support during labor, through twelve months after birth, at no cost. One trap: since April 2025 the doula has to be in the managed care plan's network, so the fee-for-service directory is the wrong list to shop from.",
        value: null,
        valueNote: "8 visits + birth support, $0",
        source: "NYS Medicaid doula benefit, SPA approved March 25, 2024",
    },
    {
        id: "parentage-form",
        track: "benefits",
        trigger: { kind: "birth" },
        title: "Sign the Acknowledgment of Parentage at the hospital",
        do: "Ask for form LDSS-5171 and sign it before discharge.",
        why: "Without this, a birth certificate naming you, or a court order, the paid family leave bonding claim has nothing to attach to and fails. It takes five minutes in a hospital room and it is the cheapest single form on this list.",
        value: null,
        valueNote: "gates the PFL claim above",
        source: "NYS OTDA Form LDSS-5171",
    },
    {
        id: "birth-weights",
        track: "benefits",
        trigger: { kind: "birth" },
        title: "Write down exact birth weights in grams, days 1 to 3",
        do: "Record each twin's birth weight in grams and gestational age in weeks. Keep it on paper or in your health portal — not in this app. Then call SSA.",
        why: "SSI for low birth weight is decided against a hard gram threshold that scales with gestational age: 1,700 g at 35 weeks, 2,000 g at 37 to 40. Twins at 35 weeks often land well above that, so do not count on it — but the number is only recorded once, and if you miss it you cannot go back for it. Deemed income is divided between the children and each is decided separately, so twins can generate two benefits. Presumptive payments can start before any medical decision and are not clawed back if the claim later fails.",
        value: { low: 24408, unit: "year" },
        valueNote: "both twins, if the thresholds are met",
        source: "SSA Listing 100.04; 20 CFR 416.931 and 416.934; POMS SI 01320.630; Form SSA-3830",
        phone: "1-800-772-1213",
    },
    {
        id: "hospital-financial-aid",
        track: "benefits",
        trigger: { kind: "birth" },
        title: "File hospital financial assistance with every billing entity",
        do: "Apply to the hospital and separately to each physician group that bills you — neonatology, anesthesia, radiology. There is no deadline, and you can apply while already in collections.",
        why: "Under the amended state law, a household below 200% of the poverty line gets all charges waived, with no nominal payment collected. For a family of four that line is $66,000. The trap is that physician bills arrive separately from the hospital bill and are not covered automatically. Several state summary pages still show the old 300% ceiling and 90-day window — those are superseded.",
        value: null,
        valueNote: "full waiver below 200% FPL",
        source: "NY PHL §2807-k(9-a) as amended eff. Oct 20, 2024; NYS DOH DAL 25-04",
        phone: "914-365-3812",
        contact: "Montefiore New Rochelle · NRFinancialAssistance@montefiore.org",
    },
    {
        id: "early-intervention",
        track: "benefits",
        trigger: { kind: "birth" },
        title: "Refer both twins to Early Intervention",
        do: "Call the Westchester Children With Special Needs unit. Refer both, separately.",
        why: "Free, no income test, and a referral has to reach the coordinator within two days with a service plan inside 45. Automatic eligibility only applies under 999 g at birth; otherwise it runs on evaluation, and prematurity is a common route in. Parents pay nothing — no deductible, no copay.",
        value: null,
        valueNote: "free, no income test",
        source: "NYS Early Intervention Program; Westchester County DOH",
        phone: "(914) 813-5094",
        contact: "145 Huguenot Street, 7th floor, New Rochelle",
    },
];

export function parseDay(iso) {
    const [year, month, day] = String(iso).split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function startOfToday(now) {
    const base = now instanceof Date ? now : new Date();
    return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

export function daysBetween(iso, now) {
    return Math.round((parseDay(iso) - startOfToday(now)) / 86400000);
}

export function longDate(iso) {
    return parseDay(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// One of: "now" | "overdue" | "due" | "scheduled" | "birth".
export function actionState(action, now) {
    if (!action || !action.trigger) return "scheduled";
    if (action.trigger.kind === "asap") return "now";
    if (action.trigger.kind === "birth") return "birth";
    const days = daysBetween(action.trigger.on, now);
    if (days < 0) return "overdue";
    if (days <= 60) return "due";
    return "scheduled";
}

export function actionTiming(action, now) {
    const state = actionState(action, now);
    if (state === "now") return "Start today";
    if (state === "birth") return "When the twins arrive";
    const days = daysBetween(action.trigger.on, now);
    if (days < 0) return "Passed " + longDate(action.trigger.on);
    if (days === 0) return "Today";
    if (days === 1) return "Tomorrow";
    if (days <= 60) return days + " days — " + longDate(action.trigger.on);
    return longDate(action.trigger.on);
}

export function formatMoney(amount) {
    return "$" + Number(amount).toLocaleString("en-US");
}

export function valueLabel(action) {
    if (!action || !action.value) return null;
    const { low, high, unit } = action.value;
    const range = high ? formatMoney(low) + "–" + formatMoney(high) : formatMoney(low);
    return unit === "year" ? range + "/yr" : range;
}

export function actionsForTrack(trackId, now) {
    if (trackId === "birth") {
        return actions.filter((action) => actionState(action, now) === "birth");
    }
    if (!trackId || trackId === "all") return actions.slice();
    return actions.filter((action) => action.track === trackId);
}

// Annual dollars that are currently on the table and not yet claimed. Deliberately
// excludes one-time amounts so the headline number is comparable year over year.
export function annualAtStake(list) {
    return (list || actions).reduce((total, action) => {
        if (!action.value || action.value.unit !== "year") return total;
        return total + action.value.low;
    }, 0);
}

export function countByState(now) {
    return actions.reduce(
        (tally, action) => {
            const state = actionState(action, now);
            if (state === "now" || state === "overdue" || state === "due") tally.open += 1;
            if (state === "birth") tally.birth += 1;
            return tally;
        },
        { open: 0, birth: 0 },
    );
}
