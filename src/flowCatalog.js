import { TWINS_EDD } from "./twinsDates.js";

export const PROFILE_SEED = {
    county: "Westchester",
    school: "Iona University",
    state: "NY",
    twins_expected: "yes",
    due_month: new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "America/New_York" }).format(new Date(`${TWINS_EDD}T12:00:00`)),
    school_code: "002737",
    internet_provider: "Optimum",
};

export const FLOW_CATALOG = [
    {
        id: "aid-moving",
        title: "Get the aid moving",
        estMinutes: 4,
        steps: [
            { id: "student-name", prompt: "What name should appear on your aid checklist?", field: "student_name", inputType: "text", help: "Use the name you use for school records.", validate: (value) => String(value || "").trim().length >= 2 },
            { id: "student-birth-date", prompt: "What is your birth date?", field: "student_birth_date", inputType: "date", validate: (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) },
            { id: "student-address", prompt: "What mailing address should your checklist use?", field: "student_address", inputType: "text", help: "A street address is enough; add apartment details if you use them on forms.", validate: (value) => String(value || "").trim().length >= 8 },
            { id: "county", prompt: "Which county do you live in?", field: "county", inputType: "text" },
            { id: "school", prompt: "Which school is this for?", field: "school", inputType: "text" },
            { id: "school-code", prompt: "Which school code belongs on the checklist?", field: "school_code", inputType: "text", inputMode: "numeric", validate: (value) => /^\d{6}$/.test(String(value || "")) },
            { id: "contributor-email", prompt: "What email should the contributor use?", field: "contributor_email", inputType: "email", inputMode: "email", validate: (value) => /^\S+@\S+\.\S+$/.test(String(value || "")) },
        ],
        checklist: [
            ["Student name", "student_name"],
            ["Birth date", "student_birth_date"],
            ["Mailing address", "student_address"],
            ["School", "school"],
            ["School code", "school_code"],
            ["Contributor email", "contributor_email"],
        ],
        callScript: "Hello, I’m an Iona student. I’m checking that my FAFSA is on file and that school code 002737 is attached. Can you confirm what you see and the next step?",
    },
    {
        id: "twins-setup",
        title: "Twins setup",
        estMinutes: 3,
        steps: [
            { id: "due-month", prompt: "When are the twins due?", field: "due_month", inputType: "text" },
            { id: "wic", prompt: "Are you enrolled in WIC?", field: "wic_enrolled", inputType: "select", options: ["yes", "no", "not sure"] },
            { id: "medicaid", prompt: "Are you covered by Medicaid?", field: "medicaid_enrolled", inputType: "select", options: ["yes", "no", "not sure"] },
        ],
        resourceIds: ["westchester-diaper-bank", "wic-fmnp", "medicaid-breast-pump", "formula-maker-programs"],
    },
    {
        id: "cut-bills",
        title: "Cut the bills",
        estMinutes: 2,
        steps: [
            { id: "provider", prompt: "Who provides your home internet?", field: "internet_provider", inputType: "text" },
            { id: "coverage", prompt: "Is anyone in the household on SNAP or Medicaid?", field: "benefit_coverage", inputType: "select", options: ["yes", "no", "not sure"] },
        ],
        callScript: "Hi, I have {internet_provider} and may qualify through SNAP or Medicaid. Please check whether I can switch to New York’s Affordable Broadband Act plan and tell me what proof you need.",
    },
];

function hasValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== "";
}

export function flowById(id) {
    return FLOW_CATALOG.find((flow) => flow.id === id) || null;
}

export function activeSteps(flow, profile = {}) {
    return flow.steps.filter((step) => !step.showIf || step.showIf(profile));
}

export function pendingSteps(flow, profile = {}) {
    return activeSteps(flow, profile).filter((step) => !hasValue(profile[step.field]));
}

export function prefillCount(flow, profile = {}) {
    return activeSteps(flow, profile).filter((step) => hasValue(profile[step.field])).length;
}

export function remainingMinutes(flow, profile = {}) {
    const visible = activeSteps(flow, profile).length;
    if (!visible) return 0;
    const pending = pendingSteps(flow, profile).length;
    if (!pending) return 0;
    return Math.max(1, Math.ceil((pending / visible) * flow.estMinutes));
}

export function reviewAnswers(flow, profile = {}) {
    return activeSteps(flow, profile).map((step) => ({
        id: step.id,
        prompt: step.prompt,
        field: step.field,
        value: profile[step.field] || "Not answered",
        prefilled: hasValue(profile[step.field]),
    }));
}

export function flowProgress(profile = {}) {
    return profile.flow_progress && typeof profile.flow_progress === "object" ? profile.flow_progress : {};
}
