import test from "node:test";
import assert from "node:assert/strict";

import { decryptToken, encryptToken } from "../src/crypto.js";
import { webhookDedupeKey } from "../src/provider-persistence-v15.js";
import {
  plaidAdditionalConsentedProducts,
  plaidCountryCodes,
  providerMode,
  providerReadiness,
  requireProvider,
} from "../src/provider-mode.js";
import { stripeSignature, verifyStripeSignature } from "../src/stripe.js";
import { resolveTableName } from "../src/supabase.js";
import { enforceOrigin } from "../src/http.js";

test("Supabase table bindings fall back to v15 names", () => {
  assert.equal(resolveTableName({}, "HOUSEHOLD_MEMBERS_TABLE"), "household_members");
  assert.equal(resolveTableName({}, "PLAID_ITEMS_TABLE"), "plaid_items");
  assert.equal(resolveTableName({}, "agent_runs"), "agent_runs");
  assert.equal(resolveTableName({ PLAID_ITEMS_TABLE: "custom_plaid_items" }, "PLAID_ITEMS_TABLE"), "custom_plaid_items");
});

test("provider mode defaults disabled and fails closed", () => {
  assert.equal(providerMode({}), "disabled");
  assert.equal(providerMode({ PROVIDER_MODE: "unexpected" }), "disabled");
  assert.equal(providerReadiness({}).enabled, false);
  assert.throws(() => requireProvider({}, "plaid"), /External providers are disabled/);
});

test("Plaid country and consented product configuration is constrained", () => {
  assert.deepEqual(plaidCountryCodes({}), ["US"]);
  assert.deepEqual(plaidCountryCodes({ PLAID_COUNTRY_CODES: "us, CA, invalid, GB, us" }), ["US", "CA", "GB"]);
  assert.deepEqual(
    plaidAdditionalConsentedProducts({ PLAID_ADDITIONAL_CONSENTED_PRODUCTS: "liabilities,identity,investments,liabilities" }),
    ["liabilities"],
  );
});

test("cross-origin requests are denied exactly", () => {
  const env = { ALLOWED_ORIGINS: "https://app.example" };
  assert.doesNotThrow(() => enforceOrigin(
    new Request("https://api.example/v1", {
      headers: { origin: "https://app.example" },
    }),
    env,
  ));
  assert.throws(() => enforceOrigin(
    new Request("https://api.example/v1", {
      headers: { origin: "https://evil.example" },
    }),
    env,
  ), /Origin is not allowed/);
});

test("production Plaid is never inferred from credentials", () => {
  const env = {
    PROVIDER_MODE: "sandbox",
    PLAID_ENV: "production",
    PLAID_CLIENT_ID: "client",
    PLAID_SECRET: "secret",
    TOKEN_ENCRYPTION_KEY: "11".repeat(32),
  };
  assert.equal(providerReadiness(env).plaid.ready, true);
  assert.equal(providerReadiness(env).plaid.environment, "sandbox");
});

test("Stripe credentials must match provider mode", () => {
  const common = {
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    STRIPE_ALLOWED_PRICE_IDS: "price_123",
    STRIPE_CHECKOUT_SUCCESS_URL: "https://app.example/success",
    STRIPE_CHECKOUT_CANCEL_URL: "https://app.example/cancel",
    STRIPE_PORTAL_RETURN_URL: "https://app.example/account",
  };
  assert.equal(providerReadiness({
    ...common,
    PROVIDER_MODE: "sandbox",
    STRIPE_SECRET_KEY: "sk_live_wrong",
  }).stripe.ready, false);
  assert.equal(providerReadiness({
    ...common,
    PROVIDER_MODE: "sandbox",
    STRIPE_SECRET_KEY: "sk_test_valid",
  }).stripe.ready, true);
  assert.equal(providerReadiness({
    ...common,
    PROVIDER_MODE: "production",
    STRIPE_SECRET_KEY: "sk_test_wrong",
  }).stripe.ready, false);
});

test("AES-GCM token envelope roundtrips and binds context", async () => {
  const key = "01".repeat(32);
  const encrypted = await encryptToken("access-sandbox-token", key, "owner:item");
  assert.notEqual(encrypted, "access-sandbox-token");
  assert.equal(await decryptToken(encrypted, key, "owner:item"), "access-sandbox-token");
  await assert.rejects(() => decryptToken(encrypted, key, "other:item"), /could not be decrypted/);
});

test("Stripe signature validation accepts exact fresh raw body", async () => {
  const body = new TextEncoder().encode('{"id":"evt_test","value":1}');
  const timestamp = 1_700_000_000;
  const signature = await stripeSignature("whsec_test", timestamp, body);
  assert.equal(
    await verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, "whsec_test", timestamp),
    true,
  );
  await assert.rejects(
    () => verifyStripeSignature(new TextEncoder().encode('{"id":"evt_test","value":2}'), `t=${timestamp},v1=${signature}`, "whsec_test", timestamp),
    /signature is invalid/,
  );
  await assert.rejects(
    () => verifyStripeSignature(body, `t=${timestamp},v1=${signature}`, "whsec_test", timestamp + 301),
    /stale/,
  );
});

test("webhook dedupe keys are deterministic and namespaced", () => {
  assert.equal(webhookDedupeKey("stripe", "evt_123"), "stripe:evt_123");
  assert.equal(webhookDedupeKey("stripe", "evt_123"), webhookDedupeKey("stripe", "evt_123"));
  assert.notEqual(webhookDedupeKey("plaid", "evt_123"), webhookDedupeKey("stripe", "evt_123"));
  assert.throws(() => webhookDedupeKey("!", ""));
});
