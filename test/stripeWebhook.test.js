import assert from "node:assert/strict";
import test from "node:test";
import { handleStripeWebhook } from "../src/stripeWebhook.js";

const secret = "whsec_test_webhook_secret";
const now = 1_800_000_000_000;
const env = {
  STRIPE_WEBHOOK_SECRET: secret,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  SUPABASE_URL: "https://example.supabase.co",
};

async function sign(body, timestamp = Math.floor(now / 1000)) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`)));
  return `t=${timestamp},v1=${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function event(overrides = {}) {
  return {
    id: "evt_123",
    object: "event",
    type: "checkout.session.completed",
    livemode: true,
    created: Math.floor(now / 1000),
    data: {
      object: {
        id: "cs_123",
        object: "checkout.session",
        customer: "cus_123",
        amount_total: 12345,
        currency: "usd",
      },
    },
    ...overrides,
  };
}

async function signedRequest(payload, signature = null) {
  const body = JSON.stringify(payload);
  return new Request("https://twinpath.example/api/stripe/webhook", {
    method: "POST",
    headers: { "Stripe-Signature": signature || await sign(body) },
    body,
  });
}

function storageFetch(rows) {
  const inserts = [];
  return {
    inserts,
    rows,
    fetch: async (url, init = {}) => {
      const requestUrl = new URL(url);
      if (requestUrl.pathname.endsWith("/stripe_customers")) {
        return Response.json([{ household_id: "household-1", owner_user_id: "owner-1" }]);
      }
      if (requestUrl.pathname.endsWith("/revenue_events") && init.method === "POST") {
        assert.equal(requestUrl.searchParams.get("on_conflict"), "owner_user_id,source,external_event_id");
        assert.match(init.headers.prefer, /resolution=ignore-duplicates/);
        const row = JSON.parse(init.body);
        if (rows.has(row.external_event_id)) return Response.json([]);
        rows.set(row.external_event_id, row);
        inserts.push(row);
        return Response.json([row]);
      }
      throw new Error(`Unexpected request: ${url}`);
    },
  };
}

test("signature-invalid requests are rejected", async () => {
  const request = await signedRequest(event(), "t=1800000000,v1=00");
  const response = await handleStripeWebhook(request, env, { now });
  assert.equal(response.status, 400);
});

test("stale signatures are rejected", async () => {
  const payload = event();
  const body = JSON.stringify(payload);
  const request = await signedRequest(payload, await sign(body, Math.floor(now / 1000) - 301));
  const response = await handleStripeWebhook(request, env, { now });
  assert.equal(response.status, 400);
});

test("duplicate Stripe event IDs insert one revenue row", async () => {
  const store = storageFetch(new Map());
  const first = await handleStripeWebhook(await signedRequest(event()), env, { fetchImpl: store.fetch, now });
  const second = await handleStripeWebhook(await signedRequest(event()), env, { fetchImpl: store.fetch, now });
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(store.inserts.length, 1);
  assert.equal(store.rows.size, 1);
});

test("test-mode events are stored as sandbox revenue", async () => {
  const store = storageFetch(new Map());
  const response = await handleStripeWebhook(await signedRequest(event({ livemode: false })), env, { fetchImpl: store.fetch, now });
  assert.equal(response.status, 200);
  assert.equal(store.inserts[0].mode, "sandbox");
});

test("oversized Stripe payloads are truncated before insertion", async () => {
  const store = storageFetch(new Map());
  const payload = event();
  payload.data.object.metadata = { oversized: "x".repeat(40_000) };
  const response = await handleStripeWebhook(await signedRequest(payload), env, { fetchImpl: store.fetch, now });
  assert.equal(response.status, 200);
  assert.equal(store.inserts[0].payload.truncated, true);
  assert.ok(new TextEncoder().encode(JSON.stringify(store.inserts[0].payload)).byteLength <= 32 * 1024);
});
