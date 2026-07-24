import { HttpError } from "./http.js";

const MODES = new Set(["disabled", "sandbox", "production"]);
// This is an explicit server-side allowlist, not a client choice. Leave the
// environment value blank until Plaid has enabled Liabilities for production.
const PLAID_ADDITIONAL_CONSENTED_PRODUCTS = new Set(["liabilities"]);

function commaSeparated(env, name, fallback = []) {
  const value = String(env[name] || "").trim();
  if (!value) return fallback;
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

export function plaidCountryCodes(env) {
  const countries = commaSeparated(env, "PLAID_COUNTRY_CODES", ["US"])
    .map((code) => code.toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code))
    .slice(0, 8);
  return countries.length ? countries : ["US"];
}

export function plaidAdditionalConsentedProducts(env) {
  return commaSeparated(env, "PLAID_ADDITIONAL_CONSENTED_PRODUCTS")
    .map((product) => product.toLowerCase())
    .filter((product) => PLAID_ADDITIONAL_CONSENTED_PRODUCTS.has(product));
}

export function providerMode(env) {
  const mode = String(env.PROVIDER_MODE || "disabled").trim().toLowerCase();
  return MODES.has(mode) ? mode : "disabled";
}

function configured(env, names) {
  return names.every((name) => {
    const value = env[name];
    return typeof value === "string" && value.length > 0 && !/YOUR_|replace_with/i.test(value);
  });
}

export function providerReadiness(env) {
  const mode = providerMode(env);
  const plaidEnvironment = String(env.PLAID_ENV || "sandbox").toLowerCase();
  const effectivePlaidEnvironment = mode === "production" && plaidEnvironment === "production"
    ? "production"
    : "sandbox";
  const plaidSafe = mode !== "production" || plaidEnvironment === "production";
  const stripeSecret = String(env.STRIPE_SECRET_KEY || "");
  const stripeSecretMatchesMode = mode === "production"
    ? stripeSecret.startsWith("sk_live_")
    : stripeSecret.startsWith("sk_test_");
  const stripeWebhookReady = String(env.STRIPE_WEBHOOK_SECRET || "")
    .startsWith("whsec_");
  const stripePrices = String(env.STRIPE_ALLOWED_PRICE_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const stripePricesSafe = stripePrices.length > 0
    && stripePrices.every((value) => /^price_[A-Za-z0-9]+$/.test(value));
  return {
    mode,
    enabled: mode !== "disabled",
    autonomous_runs: "sandbox_only",
    plaid: {
      ready: mode !== "disabled"
        && configured(env, ["PLAID_CLIENT_ID", "PLAID_SECRET", "TOKEN_ENCRYPTION_KEY"])
        && plaidSafe,
      environment: effectivePlaidEnvironment,
      countries: plaidCountryCodes(env),
      additional_consented_products: plaidAdditionalConsentedProducts(env),
    },
    stripe: {
      ready: mode !== "disabled"
        && configured(env, [
          "STRIPE_SECRET_KEY",
          "STRIPE_WEBHOOK_SECRET",
          "STRIPE_ALLOWED_PRICE_IDS",
          "STRIPE_CHECKOUT_SUCCESS_URL",
          "STRIPE_CHECKOUT_CANCEL_URL",
          "STRIPE_PORTAL_RETURN_URL",
        ])
        && stripeSecretMatchesMode
        && stripeWebhookReady
        && stripePricesSafe,
      // Booleans only — never echo secret material. Lets us tell which
      // single requirement is blocking readiness without guessing.
      checks: {
        secret_key_present: configured(env, ["STRIPE_SECRET_KEY"]),
        secret_key_matches_mode: stripeSecretMatchesMode,
        webhook_secret_present: configured(env, ["STRIPE_WEBHOOK_SECRET"]),
        webhook_secret_prefix_ok: stripeWebhookReady,
        price_ids_valid: stripePricesSafe,
        success_url_set: configured(env, ["STRIPE_CHECKOUT_SUCCESS_URL"]),
        cancel_url_set: configured(env, ["STRIPE_CHECKOUT_CANCEL_URL"]),
        portal_return_url_set: configured(env, ["STRIPE_PORTAL_RETURN_URL"]),
      },
    },
  };
}

export function requireProvider(env, provider) {
  const readiness = providerReadiness(env);
  if (readiness.mode === "disabled") {
    throw new HttpError(503, "providers_disabled", "External providers are disabled");
  }
  const state = readiness[provider];
  if (!state?.ready) {
    throw new HttpError(503, "provider_not_ready", `${provider} is not configured`);
  }
  return readiness;
}
