import { fixture } from "./fixtures.js";

export function runDigitalAssets(input = {}) {
  const theme = typeof input.theme === "string" && input.theme.trim() ? input.theme.trim() : "planning";
  return fixture(
    "digital_assets",
    input,
    [
      { type: "asset_candidate", title: `${theme} digital asset candidate`, acquisition_price: 8, source: "fixture" },
      { type: "valuation", title: "Explainable sandbox valuation", liquidation_value: 40, confidence: 0.61 },
      { type: "purchase_proposal", title: "Purchase approval required", purchased: false, wallet_connected: false },
      { type: "listing_draft", title: `${theme} optimized listing`, status: "unpublished", price: 75 },
    ],
    ["draft", "generate_fixture", "evaluate"],
  );
}
