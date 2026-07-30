export const connectorCatalog = [
    {
        id: "iona-student-services",
        title: "Iona Student Services",
        category: "Campus",
        officialUrl: "https://www.iona.edu/students",
        fields: [
            "Iona ID where requested",
            "School email",
            "Program and expected graduation",
            "Specific office or service needed",
        ],
        documents: [
            "Current course schedule if relevant",
            "Award or account notice if relevant",
            "Résumé for employment services",
        ],
        warning:
            "Use only the minimum information requested by the official Iona office. Never place account passwords in this packet.",
    },
    {
        id: "student-discount-verification",
        title: "Student discount verification",
        category: "Student perks",
        officialUrl: "https://www.myunidays.com/",
        fields: [
            "School name",
            "School email",
            "Expected graduation date",
            "Enrollment status if requested",
        ],
        documents: [
            "Current student ID if accepted",
            "Current enrollment document if requested",
        ],
        warning:
            "Verification providers set their own rules. Do not upload identity documents unless the official service requires them.",
    },
    {
        id: "student-beans",
        title: "Student Beans",
        category: "Student perks",
        officialUrl: "https://www.studentbeans.com/us",
        fields: ["School", "School email", "Expected graduation date"],
        documents: ["Current enrollment proof only when officially requested"],
        warning:
            "Offers and eligibility change. Confirm the final merchant price and renewal terms before buying.",
    },
    {
        id: "github-education",
        title: "GitHub Student Developer Pack",
        category: "Student perks",
        officialUrl: "https://education.github.com/pack",
        fields: ["GitHub account", "School", "School email"],
        documents: ["Current enrollment proof accepted by GitHub Education"],
        warning:
            "Review each partner offer separately. Some benefits expire or convert to paid plans.",
    },
    {
        id: "ny-health",
        title: "NY State of Health",
        category: "Healthcare",
        officialUrl: "https://nystateofhealth.ny.gov/",
        fields: [
            "Legal name",
            "Date of birth",
            "Residential county",
            "Mailing address",
            "Current health coverage",
            "Current income",
            "Pregnancy information for the applicant",
        ],
        documents: [
            "Identity document if requested",
            "Residency documentation if requested",
            "Income documentation if requested",
            "Pregnancy documentation if requested",
        ],
        warning:
            "Use the applicant’s accurate residence, income and household information.",
    },
    {
        id: "ny-mybenefits",
        title: "New York myBenefits",
        category: "Food and assistance",
        officialUrl: "https://mybenefits.ny.gov/",
        fields: [
            "Legal name",
            "Residential address",
            "Mailing address",
            "Household members",
            "Income",
            "Rent and utilities",
            "Student status",
        ],
        documents: [
            "Identity",
            "Residency",
            "Income",
            "Housing expenses",
            "Student information if requested",
        ],
        warning:
            "Do not count unborn children or household members contrary to the agency’s rules.",
    },
    {
        id: "fafsa",
        title: "FAFSA",
        category: "Education",
        officialUrl: "https://studentaid.gov/",
        fields: [
            "Legal name",
            "Date of birth",
            "School",
            "Tax information",
            "Household/support answers",
            "Current assets where required",
        ],
        documents: [
            "Federal Student Aid account",
            "Tax information",
            "School code",
            "Dependency/support documentation if requested",
        ],
        warning:
            "Birth of a child does not by itself guarantee independent status. Follow written school guidance.",
    },
    {
        id: "hesc",
        title: "New York HESC",
        category: "Education",
        officialUrl: "https://www.hesc.ny.gov/",
        fields: [
            "Legal name",
            "New York residency",
            "School",
            "Program",
            "Enrollment",
            "Income information",
        ],
        documents: [
            "FAFSA confirmation",
            "Residency information",
            "School/enrollment information",
        ],
        warning:
            "New York dependency rules can differ from federal rules.",
    },
    {
        id: "usajobs",
        title: "USAJOBS",
        category: "Career",
        officialUrl: "https://www.usajobs.gov/",
        fields: [
            "Legal name",
            "Citizenship answer",
            "Education",
            "Employment history",
            "Skills",
            "Veterans preference if applicable",
        ],
        documents: [
            "Federal résumé",
            "Transcript",
            "Cover letter if requested",
            "Supporting eligibility documents if applicable",
        ],
        warning:
            "Every eligibility, citizenship, employment and background answer must be complete and accurate.",
    },
    {
        id: "nsa",
        title: "NSA Student Programs",
        category: "Career",
        officialUrl: "https://www.nsa.gov/Careers/Student-Programs/",
        fields: [
            "Education",
            "Major",
            "Expected graduation date",
            "Citizenship",
            "Technical experience",
            "Employment history",
        ],
        documents: [
            "Résumé",
            "Transcript",
            "Portfolio links where permitted",
        ],
        warning:
            "Do not omit or alter information to influence suitability or clearance review.",
    },
    {
        id: "fbi",
        title: "FBI Students and Graduates",
        category: "Career",
        officialUrl: "https://fbijobs.gov/students-and-graduates",
        fields: [
            "Education",
            "Citizenship",
            "Employment history",
            "Technical experience",
            "Availability",
        ],
        documents: [
            "Federal résumé",
            "Transcript",
            "Eligibility documents requested by the posting",
        ],
        warning:
            "Professional-staff and Special Agent pathways have different requirements.",
    },
];
