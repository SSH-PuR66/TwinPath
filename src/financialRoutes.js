export const financialRoutes = [
    {
        id: "unidays",
        title: "UNiDAYS",
        category: "Student discount",
        type: "expense-reduction",
        effort: "low",
        confidence: "high",
        description:
            "Verify student status through UNiDAYS and review current official brand offers before paying full price.",
        url: "https://www.myunidays.com/",
        carRequired: false,
        startupCost: 0,
        speed: "Same day",
        likelihood: "high",
        reportingNote:
            "Offers, regions, and verification rules change. A discount only reduces expenses when the purchase was already necessary.",
    },
    {
        id: "student-beans",
        title: "Student Beans",
        category: "Student discount",
        type: "expense-reduction",
        effort: "low",
        confidence: "high",
        description:
            "Browse current Student Beans offers after verifying student status on the official site.",
        url: "https://www.studentbeans.com/us",
        carRequired: false,
        startupCost: 0,
        speed: "Same day",
        likelihood: "high",
        reportingNote:
            "Eligibility and participating brands change. Confirm the final price on the merchant site.",
    },
    {
        id: "github-student-pack",
        title: "GitHub Student Developer Pack",
        category: "Student discount",
        type: "expense-reduction",
        effort: "low",
        confidence: "high",
        description:
            "Apply for the GitHub Student Developer Pack to access participating developer tools and education offers.",
        url: "https://education.github.com/pack",
        carRequired: false,
        startupCost: 0,
        speed: "1–14 days",
        likelihood: "high",
        reportingNote:
            "GitHub verifies eligibility. Review renewal terms before relying on any included tool.",
    },
    {
        id: "microsoft-education",
        title: "Microsoft Education",
        category: "Student discount",
        type: "expense-reduction",
        effort: "low",
        confidence: "high",
        description:
            "Check official Microsoft student software and device offers through Microsoft Education.",
        url: "https://www.microsoft.com/en-us/education/students",
        carRequired: false,
        startupCost: 0,
        speed: "Same day",
        likelihood: "medium",
        reportingNote:
            "School licensing and product eligibility vary. Use trusted Microsoft pages only.",
    },
    {
        id: "adobe-students",
        title: "Adobe students and teachers",
        category: "Student discount",
        type: "expense-reduction",
        effort: "low",
        confidence: "medium",
        description:
            "Review Adobe's current education pricing before buying a creative subscription.",
        url: "https://www.adobe.com/creativecloud/buy/students.html",
        carRequired: false,
        startupCost: 0,
        speed: "Same day",
        likelihood: "medium",
        reportingNote:
            "Introductory and renewal pricing can differ. Confirm cancellation terms.",
    },
    {
        id: "amazon-prime-student",
        title: "Amazon Prime Student",
        category: "Student discount",
        type: "expense-reduction",
        effort: "low",
        confidence: "medium",
        description:
            "Review current Prime Student eligibility, trial, and membership terms on Amazon.",
        url: "https://www.amazon.com/joinstudent",
        carRequired: false,
        startupCost: 0,
        speed: "Same day",
        likelihood: "medium",
        reportingNote:
            "Trials can become paid memberships. Cancel if it does not reduce necessary spending.",
    },
    {
        id: "spotify-student",
        title: "Spotify Premium Student",
        category: "Student discount",
        type: "expense-reduction",
        effort: "low",
        confidence: "medium",
        description:
            "Review Spotify's current student plan and verification requirements.",
        url: "https://www.spotify.com/us/student/",
        carRequired: false,
        startupCost: 0,
        speed: "Same day",
        likelihood: "medium",
        reportingNote:
            "Entertainment subscriptions are optional expenses. Periodic reverification may apply.",
    },
    {
        id: "mt-bank-official",
        title: "M&T Bank",
        category: "Banking",
        type: "expense-reduction",
        effort: "low",
        confidence: "high",
        description:
            "Open or manage an M&T Bank account through its official website. TwinPath can only read balances through Plaid when available.",
        url: "https://www.mtb.com/",
        carRequired: false,
        startupCost: 0,
        speed: "Immediate access",
        likelihood: "high",
        reportingNote:
            "TwinPath never stores M&T login credentials. Use Financial Connections for read-only sync when Plaid supports the institution.",
    },
    {
        id: "iona-career-development",
        title: "Iona Career Development",
        category: "Campus income",
        type: "earned-income",
        effort: "medium",
        confidence: "high",
        description:
            "Use Iona's official career resources to review student employment, internships, résumé support, and recruiting events.",
        url: "https://www.iona.edu/offices/career-development",
        carRequired: false,
        startupCost: 0,
        speed: "1–8 weeks",
        likelihood: "medium",
        reportingNote:
            "A listing is not a job offer. Verify the employer and record only wages actually received.",
    },
    {
        id: "iona-financial-aid",
        title: "Iona Student Financial Services",
        category: "Education savings",
        type: "expense-reduction",
        effort: "medium",
        confidence: "high",
        description:
            "Review institutional aid, account questions, payment options, and outside scholarship coordination with Iona.",
        url: "https://www.iona.edu/offices/student-financial-services",
        carRequired: false,
        startupCost: 0,
        speed: "1–4 weeks",
        likelihood: "medium",
        reportingNote:
            "Aid and adjustments require written confirmation and may affect other awards.",
    },
    {
        id: "ny-dol-youth",
        title: "New York youth and student employment",
        category: "Employment",
        type: "earned-income",
        effort: "medium",
        confidence: "high",
        description:
            "Use New York State Department of Labor resources for lawful employment and career support.",
        url: "https://dol.ny.gov/youth",
        carRequired: false,
        startupCost: 0,
        speed: "Varies",
        likelihood: "medium",
        reportingNote:
            "Confirm job terms directly with the employer and never pay to receive a job offer.",
    },
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
        type: "expense-reduction",
        effort: "low",
        confidence: "high",
        description:
            "Open Chime through its official website or mobile application. TwinPath can only read balances through Plaid when available.",
        url: "https://www.chime.com/",
        carRequired: false,
        startupCost: 0,
        speed: "Immediate access",
        likelihood: "high",
        reportingNote:
            "TwinPath does not store Chime credentials. Use Financial Connections for read-only sync when Plaid supports the institution.",
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
