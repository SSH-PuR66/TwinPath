/**
 * Webhook Forgery Lab
 * -------------------
 * Adversarial test suite for src/stripeWebhook.js.
 *
 * Every case below is an attack that a real attacker can attempt against a
 * publicly-routable Stripe webhook endpoint. The endpoint URL is not a secret:
 * it is in the Stripe dashboard, it shows up in logs, and it is trivially
 * discoverable. The ONLY thing standing between the internet and a forged
 * revenue row is the signature check. So the signature check gets attacked
 * here, on purpose, with the same techniques that break real ones.
 *
 * Run:  node --test test/webhookForgeryLab.test.js
 *
 * NOTE ON POSITIVE CONTROLS: a forgery suite where every case returns 400 can
 * pass trivially if the handler is simply broken. Cases tagged CONTROL assert
 * that legitimate traffic is ACCEPTED. If a control fails, every rejection
 * above it is meaningless.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { handleStripeWebhook, verifyStripeSignature } from "../src/stripeWebhook.js";

const SECRET = "whsec_lab_secret_do_not_ship";
const ATTACKER_SECRET = "whsec_attacker_guess";
const NOW = 1_800_000_000_000; // fixed clock: these tests must not drift
const NOW_S = Math.floor(NOW / 1000);
const TOLERANCE_S = 300;

const enc = new TextEncoder();

const ENV = {
  STRIPE_WEBHOOK_SECRET: SECRET,
  SUPABASE_SERVICE_ROLE_KEY: "service-role-lab-key",
  SUPABASE_URL: "https://lab.supabase.co",
};

// ---------------------------------------------------------------- attacker kit

async function hmacHex(message, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** A correctly-signed header, exactly as Stripe would produce it. */
async function signGenuine(body, ts = NOW_S, secret = SECRET) {
  return `t=${ts},v1=${await hmacHex(`${ts}.${body}`, secret)}`;
}

function post(body, signature, url = "https://twinpath.test/stripe/webhook") {
  const headers = {};
  if (signature !== null && signature !== undefined) headers["Stripe-Signature"] = signature;
  return new Request(url, { method: "POST", body, headers });
}

/** Records every outbound Supabase call so we can assert on side effects. */
function recordingFetch(rows = [{ household_id: "hh_1", owner_user_id: "user_1" }]) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), method: init?.method || "GET", body: init?.body });
    const isLookup = String(url).includes("/stripe_customers");
    return new Response(JSON.stringify(isLookup ? rows : [{ id: "rev_1" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  impl.calls = calls;
  impl.inserts = () => calls.filter((c) => c.url.includes("/revenue_events") && c.method === "POST");
  return impl;
}

function paidEvent(overrides = {}) {
  return {
    id: "evt_lab_001",
    object: "event",
    type: "checkout.session.completed",
    livemode: true,
    created: NOW_S,
    data: {
      object: {
        id: "cs_lab_001",
        object: "checkout.session",
        customer: "cus_lab_001",
        amount_total: 4900,
        currency: "usd",
      },
    },
    ...overrides,
  };
}

/** Runs the handler and returns {status, json} without ever throwing. */
async function attack(body, signature, { env = ENV, now = NOW, fetchImpl = recordingFetch() } = {}) {
  try {
    const res = await handleStripeWebhook(post(body, signature), env, { fetchImpl, now });
    let json = null;
    try {
      json = await res.clone().json();
    } catch {
      json = await res.text();
    }
    return { status: res.status, json, threw: null, fetchImpl };
  } catch (error) {
    return { status: null, json: null, threw: error, fetchImpl };
  }
}

/** Asserts a forgery was rejected AND that it produced no database writes. */
function assertRejected(result, expectedStatus, expectedError) {
  assert.equal(result.threw, null, `handler threw instead of rejecting cleanly: ${result.threw}`);
  assert.equal(result.status, expectedStatus);
  if (expectedError) assert.equal(result.json?.error, expectedError);
  assert.equal(
    result.fetchImpl.inserts().length,
    0,
    "REJECTED REQUEST STILL WROTE TO THE DATABASE — this is the finding that matters",
  );
}

// ============================================================ CONTROL GROUP
// If these fail, every rejection below proves nothing.

test("CONTROL: a genuine Stripe event is accepted and written exactly once", async () => {
  const body = JSON.stringify(paidEvent());
  const fetchImpl = recordingFetch();
  const result = await attack(body, await signGenuine(body), { fetchImpl });

  assert.equal(result.threw, null);
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { received: true });
  assert.equal(fetchImpl.inserts().length, 1, "genuine event must produce exactly one insert");

  const written = JSON.parse(fetchImpl.inserts()[0].body);
  assert.equal(written.external_event_id, "evt_lab_001");
  assert.equal(written.amount, 49);
  assert.equal(written.currency, "USD");
  assert.equal(written.mode, "live");
});

test("CONTROL: rolling secret rotation — a valid v1 alongside a stale v1 is accepted", async () => {
  // During secret rotation Stripe sends multiple v1 signatures. Rejecting the
  // whole request because ONE of them is stale would drop live revenue.
  const body = JSON.stringify(paidEvent({ id: "evt_lab_rotate" }));
  const stale = await hmacHex(`${NOW_S}.${body}`, "whsec_previous_secret");
  const fresh = await hmacHex(`${NOW_S}.${body}`, SECRET);

  const result = await attack(body, `t=${NOW_S},v1=${stale},v1=${fresh}`);
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { received: true });
});

test("CONTROL: signature at the exact edge of the tolerance window is accepted", async () => {
  const body = JSON.stringify(paidEvent({ id: "evt_lab_edge" }));
  const ts = NOW_S - TOLERANCE_S; // exactly 300s old, must still pass
  const result = await attack(body, await signGenuine(body, ts));
  assert.equal(result.status, 200);
});

// ============================================================ FORGERY ATTEMPTS

test("A01 no signature header at all", async () => {
  const body = JSON.stringify(paidEvent());
  assertRejected(await attack(body, null), 400, "invalid_signature");
});

test("A02 empty signature header", async () => {
  const body = JSON.stringify(paidEvent());
  assertRejected(await attack(body, ""), 400, "invalid_signature");
});

test("A03 valid signature, single byte flipped in the body", async () => {
  // The attacker intercepts a real webhook and raises the amount.
  const original = JSON.stringify(paidEvent());
  const signature = await signGenuine(original);
  const tampered = original.replace('"amount_total":4900', '"amount_total":4901');
  assert.notEqual(tampered, original, "test setup: body must actually change");
  assertRejected(await attack(tampered, signature), 400, "invalid_signature");
});

test("A04 replay: genuine signature resent 301 seconds later", async () => {
  const body = JSON.stringify(paidEvent());
  const signature = await signGenuine(body, NOW_S);
  const result = await attack(body, signature, { now: NOW + (TOLERANCE_S + 1) * 1000 });
  assertRejected(result, 400, "invalid_signature");
});

test("A05 clock skew forward: timestamp 301 seconds in the future", async () => {
  // Rejecting only OLD timestamps is a classic half-fix. Future-dated
  // signatures must die too, or an attacker with a captured signature can
  // stage it for later.
  const body = JSON.stringify(paidEvent());
  const future = NOW_S + TOLERANCE_S + 1;
  assertRejected(await attack(body, await signGenuine(body, future)), 400, "invalid_signature");
});

test("A06 signature computed over the body only, without the t. prefix", async () => {
  // THE classic implementation bug. If the verifier signs `body` instead of
  // `timestamp.body`, replay protection is decorative: the signature stays
  // valid forever and the t= value can be freely rewritten.
  const body = JSON.stringify(paidEvent());
  const bodyOnly = await hmacHex(body, SECRET);
  assertRejected(await attack(body, `t=${NOW_S},v1=${bodyOnly}`), 400, "invalid_signature");
});

test("A07 signature computed with the attacker's own secret", async () => {
  const body = JSON.stringify(paidEvent());
  assertRejected(await attack(body, await signGenuine(body, NOW_S, ATTACKER_SECRET)), 400, "invalid_signature");
});

test("A08 timestamp rebinding: valid old signature, freshened t= value", async () => {
  // Attacker captures yesterday's signature and swaps in today's timestamp to
  // dodge the tolerance window. Only works if t= is not inside the MAC.
  const body = JSON.stringify(paidEvent());
  const oldTs = NOW_S - 86_400;
  const oldSig = await hmacHex(`${oldTs}.${body}`, SECRET);
  assertRejected(await attack(body, `t=${NOW_S},v1=${oldSig}`), 400, "invalid_signature");
});

test("A09 cross-event splice: valid signature from a different event", async () => {
  const eventA = JSON.stringify(paidEvent({ id: "evt_A" }));
  const eventB = JSON.stringify(paidEvent({ id: "evt_B" }));
  const sigA = await signGenuine(eventA);
  assertRejected(await attack(eventB, sigA), 400, "invalid_signature");
});

test("A10 truncated signature (63 hex chars)", async () => {
  const body = JSON.stringify(paidEvent());
  const full = await hmacHex(`${NOW_S}.${body}`, SECRET);
  assertRejected(await attack(body, `t=${NOW_S},v1=${full.slice(0, 63)}`), 400, "invalid_signature");
});

test("A11 over-long signature (65 hex chars)", async () => {
  const body = JSON.stringify(paidEvent());
  const full = await hmacHex(`${NOW_S}.${body}`, SECRET);
  assertRejected(await attack(body, `t=${NOW_S},v1=${full}0`), 400, "invalid_signature");
});

test("A12 non-hex characters in the signature", async () => {
  const body = JSON.stringify(paidEvent());
  assertRejected(await attack(body, `t=${NOW_S},v1=${"z".repeat(64)}`), 400, "invalid_signature");
});

test("A13 empty v1 value", async () => {
  const body = JSON.stringify(paidEvent());
  assertRejected(await attack(body, `t=${NOW_S},v1=`), 400, "invalid_signature");
});

test("A14 all-zero signature", async () => {
  const body = JSON.stringify(paidEvent());
  assertRejected(await attack(body, `t=${NOW_S},v1=${"0".repeat(64)}`), 400, "invalid_signature");
});

test("A15 scheme downgrade: only the deprecated v0 signature is supplied", async () => {
  const body = JSON.stringify(paidEvent());
  const v0 = await hmacHex(`${NOW_S}.${body}`, SECRET);
  assertRejected(await attack(body, `t=${NOW_S},v0=${v0}`), 400, "invalid_signature");
});

test("A16 missing timestamp field", async () => {
  const body = JSON.stringify(paidEvent());
  const sig = await hmacHex(`${NOW_S}.${body}`, SECRET);
  assertRejected(await attack(body, `v1=${sig}`), 400, "invalid_signature");
});

test("A17 non-numeric timestamp", async () => {
  const body = JSON.stringify(paidEvent());
  const sig = await hmacHex(`${NOW_S}.${body}`, SECRET);
  assertRejected(await attack(body, `t=not-a-number,v1=${sig}`), 400, "invalid_signature");
});

test("A18 several invalid v1 signatures at once (shotgun)", async () => {
  const body = JSON.stringify(paidEvent());
  const noise = Array.from({ length: 12 }, (_, i) => `v1=${String(i).padStart(64, "0")}`).join(",");
  assertRejected(await attack(body, `t=${NOW_S},${noise}`), 400, "invalid_signature");
});

test("A19 GET instead of POST", async () => {
  const request = new Request("https://twinpath.test/stripe/webhook", { method: "GET" });
  const res = await handleStripeWebhook(request, ENV, { fetchImpl: recordingFetch(), now: NOW });
  assert.equal(res.status, 405);
});

test("A20 valid signature, body is not JSON", async () => {
  const body = "not json at all {{{";
  assertRejected(await attack(body, await signGenuine(body)), 400, "invalid_payload");
});

// ============================================================ FAIL-CLOSED

test("A21 fail closed: missing STRIPE_WEBHOOK_SECRET returns 503, never 200", async () => {
  // A misconfigured deploy must refuse traffic, not silently accept unsigned
  // events. Fail-open here means anyone can mint revenue rows.
  const body = JSON.stringify(paidEvent());
  const env = { ...ENV, STRIPE_WEBHOOK_SECRET: "" };
  assertRejected(await attack(body, await signGenuine(body), { env }), 503, "service_not_configured");
});

test("A22 fail closed: missing SUPABASE_SERVICE_ROLE_KEY returns 503", async () => {
  const body = JSON.stringify(paidEvent());
  const env = { ...ENV, SUPABASE_SERVICE_ROLE_KEY: "" };
  assertRejected(await attack(body, await signGenuine(body), { env }), 503, "service_not_configured");
});

test("A23 fail closed: verifyStripeSignature refuses a falsy secret outright", async () => {
  // Defence in depth behind A21: even if the env guard were removed, the
  // verifier itself must never treat an absent secret as "no check required".
  //
  // Note: an attacker cannot even BUILD a zero-length-key HMAC — WebCrypto's
  // importKey throws on an empty raw HMAC key. So this asserts the guard
  // directly with a well-formed header rather than a forged one.
  const body = JSON.stringify(paidEvent());
  const wellFormed = await signGenuine(body);

  for (const secret of ["", null, undefined]) {
    assert.equal(
      await verifyStripeSignature(body, wellFormed, secret, NOW),
      false,
      `falsy secret ${String(secret)} was not rejected`,
    );
  }
});

// ============================================================ IDEMPOTENCY

test("A24 replay of a genuinely signed event routes through on_conflict, not a blind insert", async () => {
  // Stripe legitimately redelivers events. Two deliveries of one payment must
  // not become two revenue rows. The defence is a DB-side unique key, not app
  // logic — so assert the request actually carries it.
  const body = JSON.stringify(paidEvent({ id: "evt_lab_replay" }));
  const signature = await signGenuine(body);
  const fetchImpl = recordingFetch();

  const first = await attack(body, signature, { fetchImpl });
  const second = await attack(body, signature, { fetchImpl });

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);

  const inserts = fetchImpl.inserts();
  assert.equal(inserts.length, 2, "both deliveries reach Postgres — dedupe is the DB's job");
  for (const insert of inserts) {
    assert.match(insert.url, /on_conflict=owner_user_id%2Csource%2Cexternal_event_id/);
    assert.equal(JSON.parse(insert.body).external_event_id, "evt_lab_replay");
  }
});

// ============================================================ INJECTION

test("A25 PostgREST filter injection via the customer id is neutralised by encoding", async () => {
  const hostile = "cus_1&select=*&household_id=neq.null";
  const body = JSON.stringify(paidEvent({
    id: "evt_lab_inject",
    data: { object: { ...paidEvent().data.object, customer: hostile } },
  }));
  const fetchImpl = recordingFetch([]);
  await attack(body, await signGenuine(body), { fetchImpl });

  const lookup = fetchImpl.calls.find((c) => c.url.includes("/stripe_customers"));
  assert.ok(lookup, "lookup should have been attempted");
  // The hostile & and = must be percent-encoded, leaving exactly one filter.
  assert.ok(!lookup.url.includes("&select=*"), "injected select= survived encoding");
  assert.equal((lookup.url.match(/select=/g) || []).length, 1, "extra select= parameter injected");
  assert.ok(lookup.url.includes("%26select"), "hostile ampersand should be percent-encoded");
});

// ============================================================ REGRESSIONS
// These two were found BY this lab. See WEBHOOK-FORGERY-LAB.md.

test("F1 malformed `created` must not throw an uncaught RangeError", async () => {
  // Found 2026-08-04. `new Date(Number(event.created) * 1000).toISOString()`
  // sat OUTSIDE the try/catch. A signed event with created missing, non-numeric
  // or out of Date range crashed the isolate instead of returning a clean 4xx.
  // Stripe retries 5xx — so this was also a self-inflicted retry storm.
  for (const created of [undefined, "abc", 1e15, -1e15, Number.NaN, null]) {
    const event = paidEvent({ id: `evt_created_${String(created)}` });
    if (created === undefined) delete event.created;
    else event.created = created;

    const body = JSON.stringify(event);
    const result = await attack(body, await signGenuine(body));

    assert.equal(result.threw, null, `created=${String(created)} threw ${result.threw}`);
    assert.ok(
      result.status === 200 || result.status === 400,
      `created=${String(created)} produced unexpected status ${result.status}`,
    );
    if (result.status === 200) {
      assert.equal(result.json.ignored, true, `created=${String(created)} must be ignored, not recorded`);
    }
  }
});

test("F2 oversized bodies are refused before any HMAC work is done", async () => {
  // Found 2026-08-04. The handler read an unbounded request body and HMAC'd it
  // before authenticating anything, so an unauthenticated attacker could spend
  // the worker's CPU at will. Cheap fix: reject on declared length first.
  const huge = "x".repeat(2 * 1024 * 1024);
  const request = new Request("https://twinpath.test/stripe/webhook", {
    method: "POST",
    body: huge,
    headers: { "Stripe-Signature": `t=${NOW_S},v1=${"0".repeat(64)}`, "content-length": String(huge.length) },
  });
  const fetchImpl = recordingFetch();
  const res = await handleStripeWebhook(request, ENV, { fetchImpl, now: NOW });

  assert.equal(res.status, 413);
  assert.equal((await res.json()).error, "payload_too_large");
  assert.equal(fetchImpl.inserts().length, 0);
});

// ============================================================ OBSERVATION
// Deliberately NOT an assertion. See the writeup for why.

test("OBSERVATION: comparison timing across mismatch positions", async () => {
  const body = JSON.stringify(paidEvent());
  const good = await hmacHex(`${NOW_S}.${body}`, SECRET);
  const firstByteWrong = `f${good.slice(1)}` === good ? `0${good.slice(1)}` : `${good[0] === "f" ? "0" : "f"}${good.slice(1)}`;
  const lastByteWrong = `${good.slice(0, 63)}${good[63] === "f" ? "0" : "f"}`;

  const sample = async (sig) => {
    const runs = [];
    for (let i = 0; i < 400; i += 1) {
      const start = process.hrtime.bigint();
      await verifyStripeSignature(body, `t=${NOW_S},v1=${sig}`, SECRET, NOW);
      runs.push(Number(process.hrtime.bigint() - start));
    }
    runs.sort((a, b) => a - b);
    return runs[Math.floor(runs.length / 2)];
  };

  const early = await sample(firstByteWrong);
  const late = await sample(lastByteWrong);

  // Reported, not asserted. A 32-byte branch-free compare is orders of
  // magnitude below the surrounding HMAC and the JS timer floor, so a passing
  // number here would prove nothing. The real guarantee is structural: the
  // compare accumulates into `mismatch` with no early return, and the
  // multi-signature loop uses `... || matched` specifically so it cannot
  // short-circuit on the first hit. Claiming a timing proof from this
  // measurement would be dishonest.
  console.log(`    median ns — mismatch@byte0: ${early}, mismatch@byte31: ${late} (indicative only)`);
  assert.ok(early > 0 && late > 0);
});
