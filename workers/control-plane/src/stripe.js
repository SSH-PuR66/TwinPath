import { assertObject, HttpError, readBytes, readJson } from "./http.js";
import {
  claimProviderWebhook,
  getStripeCustomer,
  getStripeCustomerById,
  insertVerifiedStripeRevenue,
  releaseProviderWebhook,
  saveStripeCustomer,
  saveStripeLifecycleEvent,
  writeProviderAudit,
} from "./provider-persistence-v15.js";
import { providerMode, requireProvider } from "./provider-mode.js";

function encodeForm(values) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) form.set(key, String(value));
  }
  return form;
}

async function stripeRequest(env, path, values) {
  requireProvider(env, "stripe");
  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: encodeForm(values),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new HttpError(502, "stripe_error", "Stripe request failed", {
      type: result?.error?.type,
      code: result?.error?.code,
    });
  }
  return result;
}

function allowedPrices(env) {
  return new Set(String(env.STRIPE_ALLOWED_PRICE_IDS || "").split(",").map((value) => value.trim()).filter(Boolean));
}

function configuredUrl(env, name) {
  const value = env[name];
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new HttpError(503, "service_not_configured", `${name} must be an absolute HTTPS URL`);
  }
}

async function ensureStripeCustomer(env, auth) {
  const existing = await getStripeCustomer(env, auth);
  if (existing) return existing;
  const customer = await stripeRequest(env, "/customers", {
    email: auth.user.email,
    "metadata[owner_user_id]": auth.user.id,
    "metadata[household_id]": auth.household.id,
  });
  return saveStripeCustomer(env, auth, customer.id);
}

export async function createCheckoutSession(request, env, auth) {
  const body = assertObject(await readJson(request, 8_192));
  const prices = allowedPrices(env);
  const priceId = typeof body.price_id === "string"
    ? body.price_id
    : prices.size === 1
      ? [...prices][0]
      : "";
  if (!prices.has(priceId)) {
    throw new HttpError(400, "price_not_allowed", "The requested Stripe price is not allowlisted");
  }
  const quantity = body.quantity === undefined ? 1 : Number(body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new HttpError(400, "invalid_quantity", "quantity must be an integer from 1 through 10");
  }
  const customer = await ensureStripeCustomer(env, auth);
  const session = await stripeRequest(env, "/checkout/sessions", {
    mode: "subscription",
    customer: customer.stripe_customer_id,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": quantity,
    success_url: configuredUrl(env, "STRIPE_CHECKOUT_SUCCESS_URL"),
    cancel_url: configuredUrl(env, "STRIPE_CHECKOUT_CANCEL_URL"),
    client_reference_id: auth.user.id,
    "metadata[owner_user_id]": auth.user.id,
    "metadata[household_id]": auth.household.id,
  });
  await writeProviderAudit(env, {
    householdId: auth.household.id,
    ownerUserId: auth.user.id,
    eventType: "stripe.checkout_session_created",
    eventData: { session_id: session.id, price_id: priceId, quantity },
  });
  return { id: session.id, url: session.url };
}

export async function createBillingPortalSession(request, env, auth) {
  if (request.body) assertObject(await readJson(request, 1_024));
  const customer = await getStripeCustomer(env, auth);
  if (!customer) throw new HttpError(404, "stripe_customer_not_found", "No Stripe customer was found");
  const session = await stripeRequest(env, "/billing_portal/sessions", {
    customer: customer.stripe_customer_id,
    return_url: configuredUrl(env, "STRIPE_PORTAL_RETURN_URL"),
  });
  await writeProviderAudit(env, {
    householdId: auth.household.id,
    ownerUserId: auth.user.id,
    eventType: "stripe.billing_portal_created",
    eventData: { session_id: session.id },
  });
  return { url: session.url };
}

function parseStripeSignature(header) {
  const parsed = { timestamps: [], signatures: [] };
  for (const part of String(header || "").split(",")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key === "t" && /^\d+$/.test(value)) parsed.timestamps.push(Number(value));
    if (key === "v1" && /^[0-9a-f]{64}$/i.test(value)) parsed.signatures.push(value.toLowerCase());
  }
  return parsed;
}

function bytesToHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function constantTimeHexEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

export async function stripeSignature(secret, timestamp, rawBody) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const prefix = new TextEncoder().encode(`${timestamp}.`);
  const signedPayload = new Uint8Array(prefix.length + rawBody.length);
  signedPayload.set(prefix);
  signedPayload.set(rawBody, prefix.length);
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, signedPayload)));
}

export async function verifyStripeSignature(
  rawBody,
  header,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
) {
  const parsed = parseStripeSignature(header);
  for (const timestamp of parsed.timestamps) {
    if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) continue;
    const expected = await stripeSignature(secret, timestamp, rawBody);
    if (parsed.signatures.some((candidate) => constantTimeHexEqual(candidate, expected))) return true;
  }
  throw new HttpError(401, "invalid_stripe_signature", "Stripe webhook signature is invalid or stale");
}

function revenueFromStripeEvent(event) {
  const object = event.data?.object;
  if (!object || typeof object !== "object") return null;
  if (event.type === "invoice.paid" && Number(object.amount_paid) > 0) {
    return {
      amount: Number(object.amount_paid) / 100,
      currency: String(object.currency || "").toUpperCase(),
      customerId: object.customer,
    };
  }
  if (
    event.type === "checkout.session.completed"
    && object.mode === "payment"
    && object.payment_status === "paid"
    && Number(object.amount_total) > 0
  ) {
    return {
      amount: Number(object.amount_total) / 100,
      currency: String(object.currency || "").toUpperCase(),
      customerId: object.customer,
    };
  }
  return null;
}

function lifecycleFromStripeEvent(event) {
  const supported = new Set([
    "charge.refunded",
    "charge.dispute.created",
    "charge.dispute.closed",
    "refund.created",
    "refund.updated",
  ]);
  const object = event.data?.object;
  if (!supported.has(event.type) || !object || typeof object !== "object") {
    return null;
  }
  return {
    customerId: object.customer,
    amount: Number(object.amount_refunded ?? object.amount ?? 0) / 100,
    currency: String(object.currency || "").toUpperCase(),
    status: object.status || event.type.split(".").at(-1),
  };
}

export async function handleStripeWebhook(request, env) {
  requireProvider(env, "stripe");
  const rawBody = await readBytes(request, 262_144);
  await verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
  let event;
  try {
    event = assertObject(JSON.parse(new TextDecoder().decode(rawBody)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid_json", "Stripe webhook body must be valid JSON");
  }
  if (typeof event.id !== "string" || event.id.length > 500 || typeof event.type !== "string") {
    throw new HttpError(400, "invalid_stripe_event", "Stripe event is missing its id or type");
  }
  const claim = await claimProviderWebhook(env, "stripe", event.id, event);
  if (!claim.claimed) return { received: true, duplicate: true };
  try {
    const occurredAt = new Date(Number(event.created) * 1000);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new HttpError(400, "invalid_stripe_event", "Stripe event has an invalid created timestamp");
    }
    const revenue = revenueFromStripeEvent(event);
    if (
      revenue
      && providerMode(env) === "production"
      && event.livemode === true
      && typeof revenue.customerId === "string"
      && revenue.currency === "USD"
    ) {
      const customer = await getStripeCustomerById(env, revenue.customerId);
      if (customer) {
        await insertVerifiedStripeRevenue(env, customer, {
          provider: "stripe",
          verificationStatus: "verified",
          id: event.id,
          amount: revenue.amount,
          currency: revenue.currency,
          occurredAt: occurredAt.toISOString(),
          payload: { stripe_event_id: event.id, stripe_event_type: event.type },
        });
        await writeProviderAudit(env, {
          householdId: customer.household_id,
          ownerUserId: customer.owner_user_id,
          eventType: "stripe.revenue_event_verified",
          eventData: { stripe_event_id: event.id, stripe_event_type: event.type },
        });
      }
    }
    const lifecycle = lifecycleFromStripeEvent(event);
    if (
      lifecycle
      && typeof lifecycle.customerId === "string"
      && /^[A-Z]{3}$/.test(lifecycle.currency)
    ) {
      const customer = await getStripeCustomerById(env, lifecycle.customerId);
      if (customer) {
        await saveStripeLifecycleEvent(env, customer, {
          id: event.id,
          type: event.type,
          status: lifecycle.status,
          amount: lifecycle.amount,
          currency: lifecycle.currency,
          occurredAt: occurredAt.toISOString(),
        });
      }
    }
  } catch (error) {
    await releaseProviderWebhook(env, claim.key);
    throw error;
  }
  return { received: true, duplicate: false };
}
