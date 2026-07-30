import { fixture } from "./fixtures.js";

export function runMicroSaas(input = {}) {
  const niche = typeof input.niche === "string" && input.niche.trim() ? input.niche.trim() : "household operations";
  return fixture(
    "micro_saas",
    input,
    [
      { type: "problem_brief", title: `${niche} workflow brief`, confidence: 0.74 },
      { type: "architecture_spec", title: `${niche} serverless architecture`, runtime: "cloudflare_workers", database: "supabase" },
      { type: "test_report", title: "Deterministic sandbox verification", passed: true, executed_code: false },
      { type: "deployment_draft", title: "Cloudflare deployment manifest", deployed: false, ssl_verified: false },
      { type: "connector_listing", title: `${niche} utility`, status: "draft", public_url: null },
      { type: "subscription_event", title: "Simulated subscription", amount: 9, currency: "USD", charged: false, ledger_posted: false },
    ],
    ["analyze", "simulate", "draft"],
  );
}
