# Profile Reconstruction — @cr3ghost (X) + @greyfox.iix (Instagram)

Built from your **verified** work only — every claim below maps to something that
exists and runs. No invented metrics, no fake ranks. The whole thesis: you don't
present as "student learning security," you present as **"I attack the things I
build, and here's the code."** That's the positioning that beats a wall of badges.

---

## The through-line for both accounts

One sentence you can point every post back to:

> **I build real systems, then I try to break them — and I publish both halves.**

Three proof artifacts carry the entire brand. Everything you post is one of these,
a piece of one, or the road to the next:

1. **The Webhook Forgery Lab** — 25 forged/replayed/malformed requests against your
   own Stripe endpoint, each asserting *zero database writes*; found 2 real bugs
   (a crash→retry-storm and unauthenticated CPU burn). 31/31.
2. **The Job-Radar Scorer Audit** — caught your own tool ranking "Data Entry Typist"
   as the #1 match for a security student; rebuilt the scorer so every score shows
   *why*. Honest before/after.
3. **The Backtest Lie-Detector** — a Deflated Sharpe Ratio harness that rejects a
   strategy you tuned on pure noise to a fake 2.16 Sharpe, and accepts a real one.
   Adversarial in both directions.

---

## X / Twitter — @cr3ghost

**Display name:** `serg · cr3ghost`
**Bio (fits 160 chars):**

> Cybersecurity @ Iona. I attack the things I build — webhook forgery labs, RLS
> bypasses, backtest lie-detectors. Building in public → Summer '27 security intern.

**Location:** `Hudson Valley, NY` · **Link:** `sergrdz.pages.dev`

**Header image concept:** terminal on your CRT-green palette showing the forgery
lab's final line — `# tests 31 · # pass 31 · # fail 0` — over a faded score
histogram. It says "I ship green" before anyone reads a word.

### Pinned thread (ready to post — 7 tweets, each ≤280)

**1/**
I wrote a payment webhook, then I wrote the attacker's half and pointed it at my own endpoint.

25 forged requests. Each one asserts not just a rejection — but that *zero rows* hit the database.

It found 2 bugs my happy-path tests never could. 🧵

**2/**
A webhook URL isn't a secret. It's in the dashboard, the logs, the error reports.

Anyone can POST to it. The only thing between the internet and a fake row in my revenue table is one signature check.

So I attacked that check 25 ways.

**3/**
The forgeries: no signature. Body tampered one byte. Signature replayed at T+301s. Timestamp dated into the *future*. Signed over the body WITHOUT the timestamp prefix (the classic). Attacker's own secret. v0 downgrade. Injection through the customer id.

All rejected. None wrote.

**4/**
The part most people skip: positive controls.

A forgery suite where everything returns 400 passes perfectly against a *broken* handler.

So I also assert a genuine event is accepted and written exactly once. If that fails, every rejection above it is meaningless.

**5/**
Bug 1: one field wasn't validated. A malformed `created` threw a RangeError OUTSIDE the try/catch → 5xx.

Stripe retries 5xx. So one bad event = a self-inflicted retry storm. And `created:null` silently booked the payment in 1970.

**6/**
Bug 2: the handler HMAC'd an unbounded body BEFORE authenticating it.

Public URL → any stranger could make my worker hash megabytes on demand. Capped it at 256KB, checked on byte length (not char length — multibyte would've slipped 3x through).

**7/**
Why this over a wall of badges?

A recruiter can't verify a screenshot. They can run `node --test`.

"Here's the system, here's the attacker code, here are the 2 bugs it found" survives a technical interview — because it is one.

Code + writeup: sergrdz.pages.dev

### First-week cadence (low effort, high signal)

- **Mon:** the pinned thread above.
- **Wed:** one screenshot — the job-radar before/after (`Data Entry Typist #1` →
  rebuilt). Caption: "audited my own tool. it was lying. here's the fix."
- **Fri:** quote-reply into a security thread with one concrete thing you verified
  this week. Reply-with-substance is how small accounts get seen.
- **Ongoing rule:** never post a claim you can't link to running code. That
  constraint *is* the brand.

---

## Instagram — @greyfox.iix (Illynnevere)

Instagram is visual, so the artifacts become **carousels of terminal output and
diagrams**, not paragraphs. Same three proofs, shown instead of told.

**Bio:**

> 🐺 Serg · Cybersecurity @ Iona
> I break the things I build ⚔️
> forensics · appsec · red-team notes
> ↓ the receipts
> sergrdz.pages.dev

**Story highlights (covers in your green/black palette):**
`LABS` · `WRITEUPS` · `BUILDS` · `CERTS` · `STACK`

### Carousel 1 — "I attacked my own payment system" (6 slides)

1. Black slide, green mono: **"I built a payment webhook. Then I tried to forge my way past it. 25 times."**
2. The `assertRejected` snippet — highlight the line `REJECTED REQUEST STILL WROTE TO THE DATABASE`.
3. The attack list as a checklist, all ✅ rejected.
4. Bug 1 — the `created` RangeError probe output (`THREW RangeError`), one line circled.
5. Bug 2 — the 256KB cap, "59KB legit ✅ / 360KB multibyte → 413".
6. `# pass 31 # fail 0` + "code's on my portfolio. link in bio."

### Carousel 2 — "My job radar was lying to me" (5 slides)

1. **"My own tool ranked 'Data Entry Typist' as the #1 job for a security student."**
2. The v1 histogram — 153 of 161 tied at 3.
3. v1 top vs v2 top, side by side.
4. A job card showing the new `why:` reason line.
5. "audit your own work harder than anyone else will. link in bio."

**Grid rule:** every third tile is a diagram/histogram so the profile reads as a
lab notebook, not a feed. Consistency of palette > frequency of posting.

---

## What NOT to do (protects the brand)

- No claimed HTB ranks or solves you didn't earn — one verifiable artifact
  outweighs a fabricated wall, and the fake version dies in the first interview.
- No screenshots without a link to the code behind them.
- No engagement-bait threads. Your edge is that everything is real; don't dilute it.

---

*All three artifacts are real and runnable today. The forgery lab is 31/31 on your
machine; the job-radar rebuild is deployed; the DSR harness passes in both
directions. Post from strength.*
