export const opportunityCatalog = [
    {
        id: "pregnancy-medicaid",
        group: "Family",
        category: "Healthcare",
        title: "Pregnancy health coverage",
        officialUrl: "https://nystateofhealth.ny.gov/",
        valueType: "expense-reduction",
        description:
            "Review health-coverage eligibility, effective dates, providers and confidential-communications options.",
        warning:
            "Eligibility belongs to the applicant and must be determined by the marketplace or agency.",
    },
    {
        id: "wic",
        group: "Family",
        category: "Food",
        title: "New York WIC",
        officialUrl:
            "https://www.health.ny.gov/prevention/nutrition/wic/",
        valueType: "expense-reduction",
        description:
            "Nutrition assistance for potentially eligible pregnant/postpartum people, infants and children.",
        warning: "Not cash. Confirm enrollment and approved benefits locally.",
    },
    {
        id: "snap",
        group: "Family",
        category: "Food",
        title: "SNAP eligibility review",
        officialUrl: "https://mybenefits.ny.gov/",
        valueType: "expense-reduction",
        description:
            "Apply using accurate household, student and income information.",
        warning:
            "An unborn child is generally not automatically a SNAP household member.",
    },
    {
        id: "ccap",
        group: "Family",
        category: "Childcare",
        title: "Child Care Assistance Program",
        officialUrl:
            "https://ocfs.ny.gov/programs/childcare/assistance/",
        valueType: "expense-reduction",
        description:
            "Potential assistance with eligible childcare costs.",
        warning:
            "School/work eligibility, family share and provider availability require confirmation.",
    },
    {
        id: "early-head-start",
        group: "Family",
        category: "Family support",
        title: "Early Head Start",
        officialUrl:
            "https://eclkc.ohs.acf.hhs.gov/center-locator",
        valueType: "expense-reduction",
        description:
            "Locate participating pregnancy, infant and family programs.",
        warning: "Capacity and enrollment vary by local program.",
    },
    {
        id: "healthy-families",
        group: "Family",
        category: "Family support",
        title: "Healthy Families New York",
        officialUrl: "https://www.healthyfamiliesnewyork.org/",
        valueType: "expense-reduction",
        description:
            "Voluntary home-visiting and family-support services.",
        warning: "Verify local availability and actual services.",
    },
    {
        id: "lifeline",
        group: "Family",
        category: "Utilities",
        title: "Lifeline",
        officialUrl: "https://www.lifelinesupport.org/",
        valueType: "expense-reduction",
        description:
            "Potential phone or internet service discount.",
        warning:
            "ACP ended. Lifeline has separate eligibility and one-benefit-per-household rules.",
    },
    {
        id: "ny-paid-family-leave",
        group: "Family",
        category: "Income protection",
        title: "New York Paid Family Leave",
        officialUrl: "https://paidfamilyleave.ny.gov/",
        valueType: "income-protection",
        description:
            "Potential wage replacement for eligible covered employees bonding with a new child.",
        warning:
            "Requires covered employment and satisfaction of eligibility rules.",
    },
    {
        id: "vita",
        group: "Family",
        category: "Taxes",
        title: "IRS VITA",
        officialUrl:
            "https://www.irs.gov/individuals/free-tax-return-preparation-for-qualifying-taxpayers",
        valueType: "expense-reduction",
        description:
            "Free tax preparation for qualifying households.",
        warning:
            "Credits depend on actual birth date, earned income, support and other tax rules.",
    },
    {
        id: "ny-unclaimed-funds",
        group: "Family",
        category: "Overlooked assets",
        title: "New York Unclaimed Funds",
        officialUrl: "https://www.osc.ny.gov/unclaimed-funds",
        valueType: "asset-recovery",
        description:
            "Search the official Comptroller database for property held in your name.",
        warning:
            "Recovery is not guaranteed and may have reporting implications.",
    },
    {
        id: "federal-student-aid",
        group: "Education",
        category: "Financial aid",
        title: "Federal Student Aid",
        officialUrl: "https://studentaid.gov/",
        valueType: "education-aid",
        description:
            "FAFSA, Pell, Work-Study and federal student-aid information.",
        warning:
            "Parenting and dependency determinations require the applicable support test.",
    },
    {
        id: "ny-hesc",
        group: "Education",
        category: "Financial aid",
        title: "New York HESC",
        officialUrl: "https://www.hesc.ny.gov/",
        valueType: "education-aid",
        description:
            "TAP and other New York student-aid programs.",
        warning:
            "Program and dependency rules can differ from federal rules.",
    },
    {
        id: "github-student",
        group: "Education",
        category: "Student discount",
        title: "GitHub Student Developer Pack",
        officialUrl: "https://education.github.com/pack",
        valueType: "expense-reduction",
        description:
            "Verified student access to participating developer tools.",
        warning:
            "Offers and eligibility change. Avoid unnecessary paid upgrades.",
    },
    {
        id: "sfs",
        group: "Career",
        category: "Scholarship",
        title: "CyberCorps Scholarship for Service",
        officialUrl: "https://sfs.opm.gov/",
        valueType: "education-aid",
        description:
            "Cybersecurity scholarship and public-service pathway at participating institutions.",
        warning:
            "Verify participating institution, eligibility and service obligation.",
    },
    {
        id: "dod-cysp",
        group: "Career",
        category: "Scholarship",
        title: "DoD Cyber Scholarship Program",
        officialUrl: "https://www.dodcyberscholarship.org/",
        valueType: "education-aid",
        description:
            "Cybersecurity scholarship opportunities connected to Department of Defense service.",
        warning:
            "Eligibility, institutions and service obligations must be confirmed.",
    },
    {
        id: "nsa-students",
        group: "Career",
        category: "Federal career",
        title: "NSA Student Programs",
        officialUrl: "https://www.nsa.gov/Careers/Student-Programs/",
        valueType: "earned-income",
        description:
            "Official NSA internship and student-program information.",
        warning:
            "Citizenship, suitability and program-specific requirements apply.",
    },
    {
        id: "cia-students",
        group: "Career",
        category: "Federal career",
        title: "CIA Student Programs",
        officialUrl: "https://www.cia.gov/careers/student-programs/",
        valueType: "earned-income",
        description:
            "Official CIA student and internship opportunities.",
        warning:
            "Applications can have long lead times and strict eligibility requirements.",
    },
    {
        id: "fbi-students",
        group: "Career",
        category: "Federal career",
        title: "FBI Students and Graduates",
        officialUrl: "https://fbijobs.gov/students-and-graduates",
        valueType: "earned-income",
        description:
            "Official FBI student, internship and graduate opportunities.",
        warning:
            "Professional-staff and Special Agent pathways have different requirements.",
    },
    {
        id: "cisa-careers",
        group: "Career",
        category: "Federal career",
        title: "CISA Careers",
        officialUrl: "https://www.cisa.gov/careers",
        valueType: "earned-income",
        description:
            "Civilian federal cybersecurity roles and student opportunities.",
        warning:
            "Use the official posting and verify all eligibility requirements.",
    },
    {
        id: "usajobs-pathways",
        group: "Career",
        category: "Federal career",
        title: "USAJOBS Pathways",
        officialUrl:
            "https://www.usajobs.gov/Help/working-in-government/unique-hiring-paths/students/",
        valueType: "earned-income",
        description:
            "Federal internships and recent-graduate hiring information.",
        warning:
            "Prepare a detailed federal résumé and submit only accurate information.",
    },
];
