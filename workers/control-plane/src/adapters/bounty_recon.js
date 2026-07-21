import { fixture } from "./fixtures.js";

export function runBountyRecon(input = {}) {
  const target = typeof input.target === "string" && input.target.trim() ? input.target.trim() : "example.invalid";
  return fixture(
    "bounty_recon",
    input,
    [
      { type: "passive_target_profile", target, source: "fixture", network_requests: 0 },
      { type: "scope_check", title: "Review current program boundaries", authorized: false, requires_human_verification: true },
      { type: "evidence_pack", title: "Confidential candidate report", severity: "unknown", proof_of_concept: "redacted", submitted: false },
      { type: "redaction_checklist", title: "Disclosure redaction checklist", complete: false },
    ],
    ["analyze", "evaluate", "summarize"],
  );
}
