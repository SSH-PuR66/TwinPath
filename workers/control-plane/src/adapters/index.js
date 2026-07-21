import { runBountyRecon } from "./bounty_recon.js";
import { runContentAffiliate } from "./content_affiliate.js";
import { runDigitalAssets } from "./digital_assets.js";
import { runMicroSaas } from "./micro_saas.js";

const ADAPTERS = Object.freeze({
  micro_saas: runMicroSaas,
  bounty_recon: runBountyRecon,
  digital_assets: runDigitalAssets,
  content_affiliate: runContentAffiliate,
});

export const ADAPTER_NAMES = Object.freeze(Object.keys(ADAPTERS));

export function hasAdapter(name) {
  return typeof name === "string" && Object.hasOwn(ADAPTERS, name);
}

export function executeAdapter(name, input) {
  if (!hasAdapter(name)) {
    throw new Error(`Unknown sandbox adapter: ${name}`);
  }
  return ADAPTERS[name](input);
}
