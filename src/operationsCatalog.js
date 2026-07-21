export const operationsSafetyText = {
    sandbox:
        "Every new run starts in a sandbox. It may research, draft, and prepare artifacts, but it cannot publish, submit, contact anyone, spend money, or change production systems.",
    approvals:
        "Approvals are single-purpose and consequence-bound. Review the scope, audience, cost, reversibility, and data exposure before allowing an action.",
    evidence:
        "Confidential evidence stays redacted by default. Open it only in a private setting and never copy secrets, credentials, private reports, or personal data into public channels.",
    emergency:
        "Pause stops new work; cancel ends the run. Use the global queue to reject anything unexpected before resuming an engine.",
};

export const operationsCatalog = [
    {
        id: "micro_saas",
        shortName: "Micro SaaS",
        title: "Micro SaaS studio",
        eyebrow: "PRODUCT ENGINE",
        description:
            "Validate narrow software problems, shape a testable offer, and prepare a reversible launch package.",
        objective:
            "Produce evidence-backed product experiments without deploying, charging, or contacting prospects automatically.",
        color: "#7c5cff",
        icon: "blocks",
        capabilities: [
            "Market and problem research",
            "Offer and landing-page drafts",
            "Sandbox prototype plans",
        ],
        guardrails: [
            "No production deployment",
            "No customer outreach",
            "No billing or purchases",
        ],
        approvalExamples:
            "Publishing, external outreach, production access, or any paid service.",
    },
    {
        id: "bounty_recon",
        shortName: "Bounty Recon",
        title: "Authorized bounty reconnaissance",
        eyebrow: "SECURITY ENGINE",
        description:
            "Organize passive reconnaissance and evidence for security programs whose written scope you have verified.",
        objective:
            "Prepare low-impact, authorized research while preserving program boundaries and disclosure requirements.",
        color: "#00a896",
        icon: "radar",
        capabilities: [
            "Scope-aware passive discovery",
            "Program policy readiness",
            "Redacted evidence packaging",
        ],
        guardrails: [
            "Explicit scope required",
            "No destructive testing",
            "No secret or PII exposure",
        ],
        approvalExamples:
            "Active testing, report submission, or any action beyond passive collection.",
        scopeNotice:
            "Only add assets you own or are explicitly authorized to test. The exact asset pattern, allowed techniques, exclusions, and policy URL become an immutable run boundary.",
    },
    {
        id: "digital_assets",
        shortName: "Digital Assets",
        title: "Domain and asset arbitrage",
        eyebrow: "ASSET ENGINE",
        description:
            "Score fixture-based domain and micro-asset candidates, then prepare explainable valuation and relisting drafts.",
        objective:
            "Evaluate acquisition margins without connecting a wallet, purchasing an asset, or opening a marketplace listing.",
        color: "#f28c45",
        icon: "package",
        capabilities: [
            "Candidate and expiry fixtures",
            "Explainable liquidation valuation",
            "Optimized relisting drafts",
        ],
        guardrails: [
            "No wallet or registrar connection",
            "No automatic purchase",
            "No trademark targeting",
        ],
        approvalExamples:
            "Any purchase, marketplace upload, public listing, or price commitment.",
    },
    {
        id: "content_affiliate",
        shortName: "Content",
        title: "Content and affiliate desk",
        eyebrow: "PUBLISHING ENGINE",
        description:
            "Build useful, source-backed content plans with clear commercial disclosures and editorial review.",
        objective:
            "Draft audience-first content without publishing, impersonating, or creating undisclosed endorsements.",
        color: "#2979ff",
        icon: "pen",
        capabilities: [
            "Topic and source research",
            "Editorial draft packages",
            "Disclosure and link checks",
        ],
        guardrails: [
            "Human editorial approval",
            "Affiliate disclosure required",
            "No fabricated experience",
        ],
        approvalExamples:
            "Publication, affiliate-link activation, email distribution, or sponsored claims.",
    },
];

export function getOperationsEngine(engineId) {
    return operationsCatalog.find((engine) => engine.id === engineId) || null;
}
