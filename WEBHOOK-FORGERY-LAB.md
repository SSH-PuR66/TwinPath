# Webhook Forgery Lab

**Target:** `src/stripeWebhook.js` — the Stripe webhook handler behind TwinPath's revenue ledger.
**Scope:** my own code, my own infrastructure. Nothing external was touched.
**Run:** `npm run test:forgery-lab`
**Result:** 31/31. 25 forgery attempts rejected, 3 positive controls accepted, 2 real bugs found and fixed.

---

## Why bother

A Stripe webhook URL is not a secret. It sits in the Stripe dashboard, it shows
up in request logs, it leaks in error reports. Anyone who learns it can POST to
it all day. The only thing between the open internet and a fabricated row in my
`revenue_events` table is the signature check.

So I wrote the attacker's side of that check and pointed it at my own endpoint.

## What the lab does

Every case constructs a request the way an attacker would and asserts two
things: the correct rejection status, **and** that zero rows reached the
database. The second assertion is the one that matters. A handler that returns
400 while still writing is worse than one that returns 200.

```js
function assertRejected(result, expectedStatus, expectedError) {
  assert.equal(result.threw, null, "handler threw instead of rejecting cleanly");
  assert.equal(result.status, expectedStatus);
  if (expectedError) assert.equal(result.json?.error, expectedError);
  assert.equal(result.fetchImpl.inserts().length, 0,
    "REJECTED REQUEST STILL WROTE TO THE DATABASE — this is the finding that matters");
}
```

### The 25 attacks

Missing header, empty header, single-byte body tamper, replay at T+301s,
future-dated timestamp at T−301s, signature over the body without the `t.`
prefix, signature under the attacker's own secret, timestamp rebinding, cross
-event signature splice, truncated hex, over-long hex, non-hex characters,
empty `v1`, all-zero signature, `v0` scheme downgrade, missing timestamp,
non-numeric timestamp, twelve-signature shotgun, wrong HTTP method, valid
signature over non-JSON, two fail-closed misconfiguration cases, a falsy-secret
guard, an idempotency replay, and a PostgREST filter injection through the
customer id.

Three of these deserve a note.

**Signature over the body only** (A06) is the bug I was most worried about
finding in my own code. If you HMAC `body` instead of `timestamp.body`, replay
protection becomes decorative — the signature never expires and the attacker
rewrites `t=` freely. My handler signs `${parsed.timestamp}.${rawBody}`, and
A06 and A08 exist to keep it that way.

**Future-dated timestamps** (A05) are the half-fix I see most often. Plenty of
implementations reject old timestamps and wave through timestamps from next
week, which lets an attacker stage a captured signature for later. The check
has to be `Math.abs(...)`.

**Fail-closed** (A21/A22) matters more than any single forgery. If a deploy
loses `STRIPE_WEBHOOK_SECRET` and the handler responds 200 to unsigned events,
anyone on the internet can mint revenue. It returns 503.

### The positive controls

A forgery suite where every case returns 400 passes perfectly against a handler
that is simply broken. Three cases assert the opposite direction:

- a genuine event is accepted and written **exactly once**, with the amount,
  currency and mode verified in the outbound insert;
- during secret rotation, a stale `v1` alongside a valid `v1` is **accepted** —
  rejecting the whole request there would drop live payments;
- a signature at exactly 300s, the boundary of the tolerance window, passes.

If those three fail, nothing above them means anything.

---

## Findings

### F1 — Unhandled `RangeError` on malformed `created` (crash → retry storm)

`stripeDetails()` fed the event's `created` field straight into a `Date`:

```js
occurredAt: new Date(Number(event.created) * 1000).toISOString(),
```

Every other field was validated. `created` was not. `new Date(NaN).toISOString()`
throws a `RangeError`, and this call sat **outside** the caller's `try/catch`,
so the exception escaped `handleStripeWebhook` entirely.

Probe results before the fix:

```
created=missing        -> THREW RangeError: Invalid time value
created=null           -> HTTP 200  (recorded with a 1970-01-01 timestamp)
created=string-abc     -> THREW RangeError: Invalid time value
created=huge (1e15)    -> THREW RangeError: Invalid time value
created=negative-huge  -> THREW RangeError: Invalid time value
```

Two problems in one. The throws crash the isolate into a 5xx — and Stripe
**retries 5xx**, so a single malformed event becomes a self-inflicted retry
storm. And `created: null` didn't throw at all; it quietly coerced to `0` and
recorded the payment as having occurred in 1970.

Reachability is honest: this needs a validly-signed payload, so it isn't a path
an unauthenticated attacker can drive. It's a robustness and data-integrity
bug, not an authentication bypass. It's still a crash with no test, on the code
path that handles money.

Fix — validate `created` like every other field:

```js
const created = Number(event.created);
if (!Number.isSafeInteger(created) || created <= 0 || created > MAX_EPOCH_SECONDS) return null;
```

`MAX_EPOCH_SECONDS` is `8_640_000_000_000` — past that, `toISOString()` throws
regardless. A bad `created` now returns `{received: true, ignored: true}`
instead of crashing.

### F2 — Unauthenticated CPU consumption before the signature check

The handler read an unbounded request body and HMAC'd all of it *before*
authenticating anything:

```js
const rawBody = await request.text();
const validSignature = await verifyStripeSignature(rawBody, ...);
```

The URL is public. So any unauthenticated caller could POST megabytes with a
garbage signature and make the worker hash every byte before rejecting it —
attacker-controlled work, at my expense, on a metered platform.

Fix — check the declared length first (cheapest), then the actual length,
because `content-length` may be absent or lying:

```js
const declaredLength = Number(request.headers.get("content-length"));
if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) {
  return jsonResponse(413, { error: "payload_too_large" });
}

const rawBody = await request.text();
if (encoder.encode(rawBody).byteLength > MAX_WEBHOOK_BODY_BYTES) {
  return jsonResponse(413, { error: "payload_too_large" });
}
```

That second check is `byteLength`, not `.length`. A UTF-16 character count
would have let a multibyte body through at up to 3× the intended limit —
verified:

```
legit 59KB event                     -> HTTP 200 {"received":true}
multibyte 360KB, no content-length   -> HTTP 413 {"error":"payload_too_large"}
```

Limit is 256KB. Real Stripe events are a few KB; a legitimate 59KB event still
passes.

---

## What this lab does *not* prove

The timing case is reported, not asserted, and that's deliberate.

A 32-byte branch-free comparison is orders of magnitude below both the
surrounding HMAC and the JavaScript timer floor. Any number I produced here
would be measuring the HMAC, not the compare. Asserting on it would be
theatre — a green check that means nothing.

The real guarantee is structural, and it's visible in the source. The compare
accumulates into a single `mismatch` accumulator with no early return:

```js
function constantTimeEqual(expected, candidate) {
  let mismatch = expected.length ^ candidate.length;
  const length = Math.max(expected.length, candidate.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (expected[index] || 0) ^ (candidate[index] || 0);
  }
  return mismatch === 0;
}
```

And the multi-signature loop is written `matched = constantTimeEqual(...) || matched`
rather than breaking on the first hit, specifically so the number of valid
signatures in a header isn't observable from response time.

Constant-time behaviour in a JIT-compiled language is best-effort regardless —
the engine can undo your intent. Saying so is more useful than a fabricated
proof.

---

## Bugs found by writing this

Two in the handler (above) — and one in the lab itself. `A23` originally tried
to forge a signature using an empty secret, which failed because WebCrypto's
`importKey` refuses a zero-length HMAC key outright. My test threw before it
ever reached its assertion. That's a test bug, not a source bug, and I fixed
the test rather than the code. Worth stating plainly: a red-team harness that
"finds" something is worthless until you've ruled out that the harness is what
broke.

---

*Serg Rodriguez — B.S. Cybersecurity (Threat Analysis) @ Iona.
Building in public, hunting Summer 2027 security internships.*
