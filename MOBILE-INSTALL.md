# TwinPath on your phone & iPad — the honest best path

## TL;DR
**Skip the .ipa for daily use. Install the PWA instead:** open your TwinPath URL in
**Safari → Share → Add to Home Screen**. You get a full-screen app that
**auto-updates forever** — no 7-day refresh, no LiveContainer, no VPN, no signing
slots, no computer. It even supports push notifications. I verified the live site
serves everything an install needs (manifest, icons, service worker — all HTTP 200).

---

## First, the honest correction about "the version I made"

I did **not** compile a new `.ipa`. I can't — an iOS binary can only be built by
Xcode on macOS, and neither your Windows PC nor my Linux sandbox can do that.

What I actually improved is the **source**:
- Fixed the real launch bug: `Info.plist` required `armv7` (32-bit, dead since
  2013). On your arm64 iPhone 17 that can stop the app launching outright. Now
  `arm64`, portrait-locked.
- The web bundle builds green (3034 modules, 0 errors) and I fixed a text bug.

That fix becomes an **installable** `.ipa` only after the CI build runs (see
`IOS-IPA-PIPELINE.md`). **So the old `TwinPath-unsigned.ipa` (Jul 31) is the
broken one — don't re-import it anywhere.**

The bigger point: for a phone/iPad, the PWA is more capable than the `.ipa` route
*and* far less hassle. That's the "better than ever" answer.

---

## Do you need to delete the old .ipa on your iPad?

- **The `.ipa` file sitting in Files:** harmless. Delete it to declutter — that's
  all it is, a package file.
- **If you installed it as a standalone sideloaded app:** yes, delete that app. It's
  the buggy `armv7` build, it burns one of your 3 free signing slots, and it needs
  weekly refreshing. Your data lives in **Supabase (the cloud)**, so deleting the
  app loses nothing.
- **Do NOT delete LiveContainer or SideStore themselves** — those are the tools, not
  the app.
- Bottom line: don't reinstall *any* TwinPath `.ipa` until a **new** one is built.
  If you go the PWA route (recommended), you never need one.

---

## Why the PWA is the right call for you and Brianna

TwinPath was **built as a PWA** — this isn't a workaround, it's the intended path:
- Proper manifest, offline service worker, portrait lock, home-screen icons.
- A CSV **share-target**: share a file from any app → it lands in TwinPath's import.
- **Auto-updates on every deploy.** You never refresh, never re-sign, never hit the
  7-day wall. Push a change, reopen the app, it's current.
- **Push notifications work** on iOS/iPadOS 16.4+ for home-screen PWAs — so your
  "Stripe $ notifications on my phone" is achievable here, no `.ipa` required.

### Install — 20 seconds, do it on both devices
1. Open **Safari** (must be Safari — not Chrome) and go to your TwinPath URL.
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Launch it from the new icon. It opens full-screen, no browser bars. (The app even
   shows its own hint walking you through this.)

---

## If you still want the native .ipa + LiveContainer route

The real refresh mechanics (2026), accurately:
- **Free Apple ID = 7-day expiry.** Apps must be refreshed weekly or they show
  "no longer available."
- **The reliable auto-refresh is SideStore's on-device refresh**, which needs a small
  VPN helper (StikDebug / StosVPN / LocalDevVPN) enabled. After setup it refreshes
  **on the device, no computer needed.**
- **LiveContainer's advantage:** it runs apps inside one container, so you use a
  single app slot and **refresh the container, not each app** — that's the whole
  point of it.
- **The iOS Shortcuts auto-refresh you read about:** it works for some people and
  fails for others (common `could not determine this device's UDID` errors). Don't
  make it your primary mechanism — use SideStore's VPN refresh, and *optionally*
  trigger it from a Shortcut. Test manually before trusting any automation.
- **To get a working `.ipa` first:** run the GitHub Action in `IOS-IPA-PIPELINE.md` →
  download `TwinPath-unsigned.ipa` → import into LiveContainer via SideStore.

---

## My recommendation, plainly
Use the **PWA** for daily use — it's live, verified, auto-updating, and it's what
the app was built for. Keep the `.ipa`/LiveContainer path as an optional extra only
if you specifically want it. And if you want the Stripe push notifications on your
phone, say the word and I'll wire **web push** into the PWA — that's the clean way to
get "$ notifications" without ever touching the sideload-and-refresh treadmill again.
