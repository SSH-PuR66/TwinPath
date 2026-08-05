# TwinPath .ipa — how to actually rebuild it (and why the old one was stale)

## The honest constraint first

An iOS `.ipa` can only be produced by **Xcode on macOS**. Your dev machine is
Windows and this assistant runs on Linux — **neither can compile an iOS binary.**
So the `TwinPath-unsigned.ipa` in the repo (dated Jul 31) is frozen: it can't be
rebuilt on the hardware you have. Anyone telling you they "rebuilt your .ipa" on
Windows or in a Linux sandbox is not telling you the truth about how iOS builds
work.

The fix is a **free macOS CI runner** (GitHub Actions gives you macOS minutes).
It builds the real thing every time you push. Full workflow below.

## What was actually wrong (fixed in this pass)

1. **The web build was NOT broken.** `build-error.log` is stale — it predates
   `react-day-picker` being added to `package.json`. A clean `vite build` today
   passes: **3034 modules, ~14s, 0 errors.** The bundle that goes *inside* the
   `.ipa` is healthy.

2. **`Info.plist` had a real bug.** `UIRequiredDeviceCapabilities` was `armv7` —
   32-bit, which no device since the iPhone 5s satisfies. On your arm64 iPhone 17
   that can stop the app launching under LiveContainer. Changed to `arm64`. Also
   locked iPhone to portrait (it's a single-column PWA — landscape was rendering
   stretched) and added `ITSAppUsesNonExemptEncryption=false` to kill the export-
   compliance prompt that stalls packaging.

Those are the two things that actually gate a working `.ipa`. Both handled.

## The rebuild pipeline — `.github/workflows/ios-ipa.yml`

Commit this. Every push to `main` produces a fresh **unsigned** `.ipa` as a
downloadable artifact, built from your real source on a real Mac.

```yaml
name: Build unsigned iOS IPA
on:
  push: { branches: [main] }
  workflow_dispatch:

jobs:
  ipa:
    runs-on: macos-14
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }

      - name: Build web bundle
        run: |
          npm ci
          npm run build            # vite build → dist/  (verified green)

      - name: Sync Capacitor iOS
        run: npx cap sync ios

      # Archive WITHOUT code signing. LiveContainer runs the app itself, so a
      # dev signature is not required — it just needs a valid arm64 build.
      - name: Archive (unsigned)
        run: |
          cd ios/App
          xcodebuild \
            -project App.xcodeproj \
            -scheme App \
            -configuration Release \
            -sdk iphoneos \
            -archivePath "$PWD/build/App.xcarchive" \
            archive \
            CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY="" \
            IPHONEOS_DEPLOYMENT_TARGET=15.0

      # Hand-package the .app into a Payload/ and zip → .ipa (the standard
      # unsigned-ipa trick; no exportArchive, which would demand a signature).
      - name: Package .ipa
        run: |
          cd ios/App/build
          mkdir -p Payload
          cp -R App.xcarchive/Products/Applications/App.app Payload/App.app
          zip -qry TwinPath-unsigned.ipa Payload
          ls -la TwinPath-unsigned.ipa

      - uses: actions/upload-artifact@v4
        with:
          name: TwinPath-unsigned-ipa
          path: ios/App/build/TwinPath-unsigned.ipa
```

Notes that save you an hour:
- If `npx cap sync` reports a **CocoaPods** workspace instead of SPM, swap
  `-project App.xcodeproj` for `-workspace App.xcworkspace` and add a
  `pod install` step. Your repo shows `CapApp-SPM`, so the project form above is
  the right default.
- `npm run build` runs your `audit` gate first. If CI ever fails there, it's the
  audit finding a real drift — not the iOS step.

## Installing it — your exact setup (LiveContainer Plus via Sideloadly)

1. **Download the artifact** from the GitHub Actions run → `TwinPath-unsigned.ipa`.
2. **Sideloadly** (on the Windows PC): plug in the iPhone, drag in the `.ipa`,
   sign in with your Apple ID. Sideloadly signs it with your free personal
   certificate and installs. Free certs expire in **7 days** — that's an Apple
   limit, not a bug. This is exactly why LiveContainer helps:
3. **LiveContainer** holds the guest app so you re-sign the *container*, not
   TwinPath, when the 7 days lapse — one refresh keeps everything inside alive.
   Import the `.ipa` into LiveContainer, launch it from there.
4. **First launch check:** it should open straight to the TwinPath shell (portrait
   now). If it still needs sign-in, that's your Supabase auth, not the wrapper.

## What I could not verify from here, and why

- **The live visual/UX pass.** The app hard-requires Supabase env at boot
  (`Missing Supabase configuration`), so in a keyless cloud sandbox it renders
  blank — I won't put your project keys into a throwaway env to work around that.
  The routes themselves are coherent and intact: six app sections
  (`/`, `/import`, `/money`, `/grow`, `/family`, `/settings`) plus `/shop`, the
  legal pages, and product routes, all resolving through `appRoutes.js`.
- To do the "maximum visual appeal" pass properly, point me at the specific
  screens (or give me a way to render the deployed worker) and I'll improve them
  component by component with the build staying green — the same way the Markets
  desk and the phantom-scroll fixes were done, not a blind spray across 48
  components.
