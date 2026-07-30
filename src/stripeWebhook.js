const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const MAX_REVENUE_PAYLOAD_BYTES = 32 * 1024;
const encoder = new TextEncoder();

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function parseSignature(header) {
  if (!header) return null;
  const values = header.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = values.find(([key]) => key === "t")?.[1];
  const signatures = values
    .filter(([key]) => key === "v1")
    .map(([, value]) => value)
    .filter(Boolean);
  const parsedTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(parsedTimestamp) || !signatures.length) return null;
  return { timestamp: parsedTimestamp, signatures };
}

function hexBytes(value) {
  if (!/^[0-9a-f]{64}$/i.test(value || "")) return new Uint8Array(0);
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(expected, candidate) {
  let mismatch = expected.length ^ candidate.length;
  const length = Math.max(expected.length, candidate.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (expected[index] || 0) ^ (candidate[index] || 0);
  }
  return mismatch === 0;
}

export async function verifyStripeSignature(rawBody, signatureHeader, secret, now = Date.now()) {
  const parsed = parseSignature(signatureHeader);
  if (!parsed || !secret) return false;
  if (Math.abs(Math.floor(now / 1000) - parsed.timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${parsed.timestamp}.${rawBody}`),
  ));
  let matched = false;
  for (const signature of parsed.signatures) {
    matched = constantTimeEqual(expected, hexBytes(signature)) || matched;
  }
  return matched;
}

function byteLength(value) {
  return encoder.encode(JSON.stringify(value)).byteLength;
}

function boundedString(value, limit = 1024) {
  return typeof value === "string" ? value.slice(0, limit) : value;
}

function compactEvent(event) {
  const object = event?.data?.object || {};
  return {
    id: boundedString(event.id),
    object: boundedString(event.object),
    type: boundedString(event.type),
    livemode: Boolean(event.livemode),
    created: event.created,
    data: {
      object: {
        id: boundedString(object.id),
        object: boundedString(object.object),
        customer: boundedString(object.customer),
        amount_total: object.amount_total,
        amount_received: object.amount_received,
        currency: object.currency,
      },
    },
    truncated: true,
  };
}

export function truncateStripeEvent(event) {
  if (byteLength(event) <= MAX_REVENUE_PAYLOAD_BYTES) return event;
  return compactEvent(event);
}

function stripeDetails(event) {
  const object = event?.data?.object;
  if (!object || !["checkout.session.completed", "payment_intent.succeeded"].includes(event.type)) return null;
  const amountCents = event.type === "checkout.session.completed"
    ? object.amount_total
    : object.amount_received;
  const amount = Number(amountCents) / 100;
  const currency = typeof object.currency === "string" ? object.currency.toUpperCase() : "";
  if (!event.id || !object.customer || !Number.isFinite(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) return null;
  return {
    customerId: String(object.customer),
    amount,
    currency,
    occurredAt: new Date(Number(event.created) * 1000).toISOString(),
  };
}

function supabaseHeaders(serviceRoleKey, extra = {}) {
  return {
    apikey: serviceRoleKey,
    authorization: `Bearer ${serviceRoleKey}`,
    accept: "application/json",
    ...extra,
  };
}

async function supabaseRequest(env, path, init, fetchImpl) {
  const response = await fetchImpl(`${env.SUPABASE_URL.replace(/\/+$/, "")}${path}`, {
    ...init,
    headers: supabaseHeaders(env.SUPABASE_SERVICE_ROLE_KEY, init.headers),
  });
  if (!response.ok) throw new Error("Supabase request failed");
  return response.status === 204 ? null : response.json();
}

async function resolveStripeCustomer(env, customerId, fetchImpl) {
  const query = new URLSearchParams({
    select: "household_id,owner_user_id",
    stripe_customer_id: `eq.${customerId}`,
    limit: "1",
  });
  const rows = await supabaseRequest(env, `/rest/v1/stripe_customers?${query}`, { method: "GET" }, fetchImpl);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function insertRevenueEvent(env, customer, event, details, fetchImpl) {
  const query = new URLSearchParams({ on_conflict: "owner_user_id,source,external_event_id" });
  return supabaseRequest(env, `/rest/v1/revenue_events?${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify({
      household_id: customer.household_id,
      owner_user_id: customer.owner_user_id,
      visibility: "private",
      source: "stripe",
      mode: event.livemode ? "live" : "sandbox",
      verification_status: "verified",
      external_event_id: event.id,
      amount: details.amount,
      currency: details.currency,
      occurred_at: details.occurredAt,
      payload: truncateStripeEvent(event),
    }),
  }, fetchImpl);
}

export async function handleStripeWebhook(request, env, { fetchImpl = fetch, now = Date.now() } = {}) {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (!env.STRIPE_WEBHOOK_SECRET || !env.SUPABASE_SERVICE_ROLE_KEY || !env.SUPABASE_URL) {
    return jsonResponse(503, { error: "service_not_configured" });
  }

  const rawBody = await request.text();
  const validSignature = await verifyStripeSignature(
    rawBody,
    request.headers.get("Stripe-Signature"),
    env.STRIPE_WEBHOOK_SECRET,
    now,
  );
  if (!validSignature) return jsonResponse(400, { error: "invalid_signature" });

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400, { error: "invalid_payload" });
  }

  const details = stripeDetails(event);
  if (!details) return jsonResponse(200, { received: true, ignored: true });

  try {
    const customer = await resolveStripeCustomer(env, details.customerId, fetchImpl);
    if (!customer) return jsonResponse(200, { received: true, ignored: true });
    await insertRevenueEvent(env, customer, event, details, fetchImpl);
    return jsonResponse(200, { received: true });
  } catch {
    return jsonResponse(500, { error: "persistence_failed" });
  }
}
