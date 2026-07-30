import { fixture } from "./fixtures.js";

export function runContentAffiliate(input = {}) {
  const topic = typeof input.topic === "string" && input.topic.trim() ? input.topic.trim() : "intentional planning";
  return fixture(
    "content_affiliate",
    input,
    [
      { type: "content_brief", title: `A practical guide to ${topic}`, disclosure: "fixture only" },
      { type: "interactive_tool_spec", title: `${topic} comparison tool`, executable_code: false },
      { type: "affiliate_link_plan", title: "Validated referral link plan", links: [], published: false },
      { type: "ab_variants", title: "Copy and CTA variants", variants: ["A", "B"], traffic_sent: 0 },
      { type: "optimization_proposal", title: "Simulated conversion improvement", measured_conversion: null, auto_published: false },
    ],
    ["analyze", "draft", "summarize"],
  );
}
