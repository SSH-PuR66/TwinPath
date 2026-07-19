export const financialRoutes = [
    {
        id: "ny-unclaimed-funds",
        title: "New York Unclaimed Funds",
        category: "Overlooked money",
        description:
            "Search the official New York State Comptroller database for money held in your name.",
        url: "https://www.osc.ny.gov/unclaimed-funds",
        carRequired: false,
        startupCost: 0,
        speed: "Varies",
        likelihood: "unknown",
        reportingNote:
            "A recovered asset may have tax or benefits implications depending on what it represents.",
    },
    {
        id: "iona-student-employment",
        title: "Iona Student Employment",
        category: "Reliable income",
        description:
            "Ask financial aid, career services and campus IT about Work-Study and non-Work-Study positions.",
        url: "https://www.iona.edu/",
        carRequired: false,
        startupCost: 0,
        speed: "2–8 weeks",
        likelihood: "medium",
        reportingNote:
            "Wages are taxable and may need to be reported to assistance programs.",
    },
    {
        id: "career-onestop",
        title: "CareerOneStop",
        category: "Employment",
        description:
            "Official U.S. Department of Labor job, training and career resource directory.",
        url: "https://www.careeronestop.org/",
        carRequired: false,
        startupCost: 0,
        speed: "Varies",
        likelihood: "medium",
        reportingNote:
            "Confirm the legitimacy of employers and never pay for a job offer.",
    },
    {
        id: "211",
        title: "211 Local Resource Search",
        category: "Expense reduction",
        description:
            "Find current diaper, food, transportation, housing and emergency-assistance resources.",
        url: "https://www.211.org/",
        carRequired: false,
        startupCost: 0,
        speed: "Same day",
        likelihood: "medium",
        reportingNote:
            "Eligibility and availability must be confirmed with each provider.",
    },
    {
        id: "ny-wic",
        title: "New York WIC",
        category: "Expense reduction",
        description:
            "Nutrition support for eligible pregnant and postpartum people, infants and young children.",
        url: "https://www.health.ny.gov/prevention/nutrition/wic/",
        carRequired: false,
        startupCost: 0,
        speed: "Varies",
        likelihood: "medium",
        reportingNote:
            "This is an eligibility-based program, not guaranteed cash.",
    },
    {
        id: "vita",
        title: "IRS VITA",
        category: "Taxes",
        description:
            "Free tax preparation for qualifying households. Useful for self-employment and dependent questions.",
        url: "https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers",
        carRequired: false,
        startupCost: 0,
        speed: "Tax season",
        likelihood: "high",
        reportingNote:
            "Tax credits depend on actual eligibility and cannot be assumed in advance.",
    },
    {
        id: "hackerone",
        title: "HackerOne",
        category: "Variable income",
        description:
            "Authorized security research inside the exact written scope of participating programs.",
        url: "https://www.hackerone.com/hackers",
        carRequired: false,
        startupCost: 0,
        speed: "Unpredictable",
        likelihood: "low",
        reportingNote:
            "Never test outside program scope. Payouts are taxable income.",
    },
    {
        id: "bugcrowd",
        title: "Bugcrowd",
        category: "Variable income",
        description:
            "Authorized vulnerability-research programs with published testing rules.",
        url: "https://www.bugcrowd.com/hackers/",
        carRequired: false,
        startupCost: 0,
        speed: "Unpredictable",
        likelihood: "low",
        reportingNote:
            "This should not be treated as guaranteed family income.",
    },
    {
        id: "paypal",
        title: "PayPal",
        category: "Money transfer",
        description:
            "Open your official PayPal account to review or transfer funds manually.",
        url: "https://www.paypal.com/myaccount/",
        carRequired: false,
        startupCost: 0,
        speed: "Immediate access",
        likelihood: "high",
        reportingNote:
            "TwinPath does not read your PayPal balance or store PayPal credentials.",
    },
    {
        id: "chime",
        title: "Chime",
        category: "Banking",
        description:
            "Open Chime through its official website or mobile application.",
        url: "https://www.chime.com/",
        carRequired: false,
        startupCost: 0,
        speed: "Immediate access",
        likelihood: "high",
        reportingNote:
            "TwinPath does not read your Chime balance or store banking credentials.",
    },
    {
        id: "treasury",
        title: "TreasuryDirect",
        category: "Long-term saving",
        description:
            "Official U.S. Treasury site for eligible Treasury securities.",
        url: "https://www.treasurydirect.gov/",
        carRequired: false,
        startupCost: 25,
        speed: "Long term",
        likelihood: "high",
        reportingNote:
            "Do not lock up money needed soon for housing, food, healthcare or the babies.",
    },
    {
        id: "fidelity",
        title: "Fidelity",
        category: "Investing",
        description:
            "Official brokerage and retirement-account information.",
        url: "https://www.fidelity.com/",
        carRequired: false,
        startupCost: 0,
        speed: "Long term",
        likelihood: "high",
        reportingNote:
            "A Roth IRA requires eligible taxable compensation. Investments can lose value.",
    },
    {
        id: "schwab",
        title: "Charles Schwab",
        category: "Investing",
        description:
            "Official brokerage and retirement-account information.",
        url: "https://www.schwab.com/",
        carRequired: false,
        startupCost: 0,
        speed: "Long term",
        likelihood: "high",
        reportingNote:
            "Protect near-term emergency cash before investing.",
    },
    {
        id: "nysaves",
        title: "New York 529",
        category: "Education saving",
        description:
            "Official New York 529 college-savings information.",
        url: "https://www.nysaves.org/",
        carRequired: false,
        startupCost: 0,
        speed: "Long term",
        likelihood: "high",
        reportingNote:
            "Emergency savings and immediate family needs generally come first.",
    },
];
