import {
  ArrowLeft,
  FileCheck2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

const sections = {
  privacy: {
    icon: ShieldCheck,
    eyebrow: "PRIVACY",
    title: "Privacy information",
    updated: "July 2026",
    paragraphs: [
      {
        heading: "Private TwinPath data",
        body:
          "The private TwinPath family application and the public storefront are separate. No private family, household, health or financial information from the private application is displayed on, or shared with, this public store.",
      },
      {
        heading: "Checkout information",
        body:
          "Purchases are completed through the external checkout provider. This storefront does not collect, process or store payment card numbers, billing addresses or checkout account passwords.",
      },
      {
        heading: "Information held by the checkout provider",
        body:
          "The checkout provider may process customer names, email addresses and payment details under its own privacy policy in order to complete purchases and deliver files. Review the provider's privacy policy for details.",
      },
      {
        heading: "Storefront hosting",
        body:
          "The storefront is hosted through Cloudflare. Standard technical information, such as IP addresses and request logs, may be processed by the hosting provider to serve and protect the site.",
      },
      {
        heading: "Contact",
        body:
          "Add a dedicated customer-support email before publishing products, and direct privacy questions to that address rather than any personal, school or financial account email.",
      },
    ],
  },

  terms: {
    icon: FileCheck2,
    eyebrow: "TERMS",
    title: "Store terms",
    updated: "July 2026",
    paragraphs: [
      {
        heading: "Educational products",
        body:
          "Products sold through TwinPath Studio are educational templates, checklists and organizational tools. They are not professional legal, financial, medical or cybersecurity advice.",
      },
      {
        heading: "No guarantees",
        body:
          "Products do not guarantee income, employment, certification, complete security or any specific outcome. Results depend on how the materials are used.",
      },
      {
        heading: "License",
        body:
          "Unless a product states otherwise, one purchase grants the buyer a personal, non-transferable license for individual use. Reselling, redistributing or republishing the files is not permitted.",
      },
      {
        heading: "Acceptable use",
        body:
          "Products may not be used for unauthorized system access, credential theft, harassment or any unlawful activity. Security-related templates are intended for authorized, lawful use only.",
      },
      {
        heading: "Original material",
        body:
          "Products should contain original or properly licensed material and must not include stolen, confidential or copyrighted content such as certification exam questions.",
      },
    ],
  },

  refunds: {
    icon: RotateCcw,
    eyebrow: "REFUNDS",
    title: "Refund information",
    updated: "July 2026",
    paragraphs: [
      {
        heading: "Digital products",
        body:
          "Because files may be delivered immediately, digital-product refunds are handled according to the checkout provider's current refund rules and the policy shown on each product page.",
      },
      {
        heading: "Technical problems",
        body:
          "If a purchased file cannot be opened or is materially different from its description, contact customer support with your receipt and a description of the problem so it can be corrected or refunded.",
      },
      {
        heading: "Processing",
        body:
          "Approved refunds are processed through the original checkout provider back to the original payment method, on that provider's schedule.",
      },
      {
        heading: "Abuse",
        body:
          "Refund requests may be declined where permitted if there is evidence of repeated refund abuse, such as downloading and keeping files across multiple refunded purchases.",
      },
    ],
  },
};

export default function StoreLegal({ page = "privacy" }) {
  const content = sections[page] || sections.privacy;
  const Icon = content.icon;

  return (
    <main className="store-legal-page">
      <div className="store-legal-shell">
        <a className="store-back-link" href="/shop">
          <ArrowLeft size={17} />
          Back to shop
        </a>

        <section className="store-legal-card">
          <div className="store-legal-icon">
            <Icon size={26} />
          </div>

          <span className="store-kicker">{content.eyebrow}</span>
          <h1>{content.title}</h1>
          <p className="store-legal-updated">
            Last updated: {content.updated}
          </p>

          <div className="store-legal-sections">
            {content.paragraphs.map((section) => (
              <article key={section.heading}>
                <h2>{section.heading}</h2>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
