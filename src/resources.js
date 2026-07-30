export const legalResources = [
    {
        id: "medicaid",
        category: "Healthcare",
        title: "NY State of Health",
        description:
            "Apply for or review Medicaid and other health coverage. Pregnancy may affect eligibility for the pregnant applicant.",
        url: "https://nystateofhealth.ny.gov/",
        phone: "1-855-355-5777",
        warning:
            "Use your real residential address when requested. A P.O. Box may be used only as a mailing address when the application permits it.",
    },
    {
        id: "wic",
        category: "Food and nutrition",
        title: "New York WIC",
        description:
            "Nutrition support for eligible pregnant and postpartum people, infants, and young children.",
        url: "https://www.health.ny.gov/prevention/nutrition/wic/",
        phone: "1-800-522-5006",
        warning:
            "Benefits and approved foods vary. Confirm eligibility directly with WIC.",
    },
    {
        id: "snap",
        category: "Food and nutrition",
        title: "SNAP through myBenefits",
        description:
            "Apply for food assistance using the household composition rules supplied by the agency.",
        url: "https://mybenefits.ny.gov/",
        phone: "1-800-342-3009",
        warning:
            "An unborn child generally is not automatically counted as a SNAP household member. Report income and who buys and prepares food together accurately.",
    },
    {
        id: "temporary-assistance",
        category: "Cash assistance",
        title: "Temporary Assistance",
        description:
            "Request an eligibility determination for temporary cash assistance through the county.",
        url: "https://otda.ny.gov/programs/temporary-assistance/",
        phone: "1-800-342-3009",
        warning:
            "Do not budget for an award until the agency issues a written approval.",
    },
    {
        id: "ccap",
        category: "Childcare",
        title: "Child Care Assistance Program",
        description:
            "Potential childcare help for eligible working families and, in some cases, qualifying education or training activities.",
        url: "https://ocfs.ny.gov/programs/childcare/assistance/",
        phone: "",
        warning:
            "Student eligibility, family share, provider availability, and waitlists must be confirmed locally.",
    },
    {
        id: "healthy-families",
        category: "Family support",
        title: "Healthy Families New York",
        description:
            "Voluntary home-visiting and family-support services in participating areas.",
        url: "https://www.healthyfamiliesnewyork.org/",
        phone: "",
        warning:
            "Available services and supplies differ by local program.",
    },
    {
        id: "early-head-start",
        category: "Childcare",
        title: "Early Head Start",
        description:
            "Early learning and family services for qualifying pregnant people and families with young children.",
        url: "https://eclkc.ohs.acf.hhs.gov/center-locator",
        phone: "",
        warning:
            "Availability depends on local programs and open slots.",
    },
    {
        id: "heap",
        category: "Utilities",
        title: "Home Energy Assistance Program",
        description:
            "Seasonal assistance with eligible heating and utility expenses.",
        url: "https://otda.ny.gov/programs/heap/",
        phone: "1-800-342-3009",
        warning:
            "Opening dates and benefit amounts change each program year.",
    },
    {
        id: "housing",
        category: "Housing",
        title: "HUD Resource Locator",
        description:
            "Find local housing authorities, subsidized properties, and housing counseling.",
        url: "https://resources.hud.gov/",
        phone: "1-800-569-4287",
        warning:
            "Voucher lists may be closed. Twins do not automatically guarantee priority.",
    },
    {
        id: "211",
        category: "Local support",
        title: "211",
        description:
            "Request current referrals for food, diapers, housing, transportation, healthcare, and emergency assistance.",
        url: "https://www.211.org/",
        phone: "211",
        warning:
            "Confirm every referral directly because availability changes.",
    },
    {
        id: "fafsa",
        category: "Education",
        title: "Federal Student Aid",
        description:
            "File the FAFSA and review dependency, dependent-support, and financial-aid rules.",
        url: "https://studentaid.gov/",
        phone: "1-800-433-3243",
        warning:
            "A child's birth does not by itself guarantee independent status. The applicable support test and school documentation requirements still matter.",
    },
    {
        id: "hesc",
        category: "Education",
        title: "New York HESC",
        description:
            "Review TAP and other New York financial-aid programs.",
        url: "https://www.hesc.ny.gov/",
        phone: "1-888-697-4372",
        warning:
            "New York dependency and eligibility rules may differ from federal FAFSA rules.",
    },
    {
        id: "vita",
        category: "Taxes",
        title: "IRS VITA",
        description:
            "Free tax-return preparation for qualifying households.",
        url: "https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers",
        phone: "1-800-906-9887",
        warning:
            "Refundable credits depend on filing status, earned income, residency, support, and other rules. Never assume a refund amount in advance.",
    },
    {
        id: "work-study",
        category: "Income",
        title: "Federal Work-Study",
        description:
            "Ask your school's financial-aid and student-employment offices about available campus positions.",
        url: "https://studentaid.gov/understand-aid/types/work-study",
        phone: "",
        warning:
            "An award does not guarantee a position or a fixed amount of earnings.",
    },
    {
        id: "bug-bounty",
        category: "Income",
        title: "Authorized bug-bounty work",
        description:
            "Security research performed strictly inside a program's written scope.",
        url: "https://www.hackerone.com/",
        phone: "",
        warning:
            "Never scan, access, or test a system without explicit authorization. Follow every scope, rate-limit, disclosure, and data-handling rule.",
    },
];

export const starterTasks = [
    {
        title: "Confirm prenatal care with a twin-capable OB team",
        category: "Healthcare",
        priority: "urgent",
    },
    {
        title: "Ask insurer about confidential communications and paper notices",
        category: "Privacy",
        priority: "high",
    },
    {
        title: "Request written financial-aid guidance from the university",
        category: "Education",
        priority: "high",
    },
    {
        title: "Create transportation plans A, B, and C for delivery",
        category: "Transportation",
        priority: "high",
    },
    {
        title: "Build one month of essential cash reserves",
        category: "Money",
        priority: "high",
    },
    {
        title: "Apply for campus IT, work-study, and remote support roles",
        category: "Income",
        priority: "medium",
    },
    {
        title: "Ask 211 about current diaper and family-support programs",
        category: "Family",
        priority: "medium",
    },
];

export const wealthSteps = [
    {
        stage: "Protect",
        title: "Protect the starting \$2,000",
        body:
            "Keep most of it liquid in an insured savings account. Do not risk birth, housing, food, or emergency money in options, crypto, leverage, or speculative inventory.",
    },
    {
        stage: "Income 1",
        title: "Obtain predictable income",
        body:
            "Prioritize campus IT, work-study, remote support, tutoring, and legitimate performance bookings before less predictable bug-bounty or marketplace income.",
    },
    {
        stage: "Income 2",
        title: "Create one productized service",
        body:
            "Offer authorized security-hygiene setup: MFA, password managers, backups, device inventory, and written remediation guidance. Use written scope and permission.",
    },
    {
        stage: "Career",
        title: "Build proof instead of collecting endless certificates",
        body:
            "Complete three excellent portfolio projects: one detection project, one cloud-security project, and one polished technical investigation.",
    },
    {
        stage: "Scale",
        title: "Increase hourly value",
        body:
            "Move from general IT to a paid security internship, then specialize in identity, cloud, detection engineering, or application security.",
    },
    {
        stage: "Invest",
        title: "Invest only after reserves exist",
        body:
            "Take an employer match first. If eligible, consider a Roth IRA invested in a diversified low-cost index fund. Avoid locking up cash needed within the next year.",
    },
];

export const initialAllocation = [
    { name: "Emergency reserve", amount: 1200 },
    { name: "Medical, baby and transportation reserve", amount: 400 },
    { name: "Career and income tools", amount: 250 },
    { name: "Controlled business experiments", amount: 100 },
    { name: "Long-term investing", amount: 50 },
];
