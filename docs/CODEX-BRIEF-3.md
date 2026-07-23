# Codex Brief 3 — approval handoff, share target, live wallpapers, watchers UI

Backend just shipped (v20 profile vault, v21 site watchers — both applied
live; worker tests 50/50). Frontend work, in priority order:

## 1. Approval → guided handoff (the "exchange afterwards")
When a user APPROVES a deposit-routing proposal (payload.source ===
"deposit_watch"): show a success sheet with the routed steps and a
"Complete in Chime" button that deep-links out (https://app.chime.com or
chime:// where supported; fall back to copying the amounts). The app
never moves money — the handoff makes the human tap instant. Track state:
approved proposals get a "completed the transfers" self-check the user
can tick, stored via the existing enrollment-style PATCH patterns.

## 2. Web Share Target ("auto connection" once installed)
Add share_target to manifest.webmanifest (method POST, enctype
multipart/form-data, accepting text/csv and .csv files) + an /import
route in the SW/app shell that receives the shared file and pipes it into
the existing CSV importer with a confirm screen. Result: from the bank
app, Share → TwinPath → imported. iOS Safari share-target support is
limited — degrade to "paste CSV" screen with a hint.

## 3. Real live wallpapers (replaces sucky theme motion)
Self-hosted ambient video loops, licensing-safe pipeline:
- Source 6-8 loops from Pexels/Pixabay ONLY (their licenses permit
  commercial use, no attribution needed): rain-on-window night, slow
  aurora, ocean dusk, defocused city lights, drifting clouds, fireplace.
- Compress: 720p, 5-10s seamless loop, h264+webm, ~1-2MB each, muted.
- Serve from public/wallpapers/; render as <video autoplay muted loop
  playsinline> behind the glass UI, one per theme, poster frame for
  first paint. prefers-reduced-motion OR low-power → static poster.
- themeCatalog entries gain optional wallpaper: "aurora.webm" (validated
  filename only — no URLs, keeps CSP self-only).
- Credit sources in About (good citizenship).

## 4. Watchers UI (Settings → "Watching")
GET /v1/watchers list with label, last-checked, changed badge;
POST /v1/watchers {label,url} add form (https only, max 12);
POST /v1/watchers/:id/deactivate. Changed watchers already file
proposals — the inbox is the alert surface. 5 watchers are pre-seeded
(Nurse Corps, SFS institutions, ISACA NCL, NY child credit, Iona
Innovation Challenge).

## 5. Profile vault UI (Settings → "Family profile")
GET/PUT /v1/profile — editable household profile the autofill system
reads. Show the privacy promise prominently: "This vault refuses SSNs,
IDs, and bank numbers by design — those never leave your hands."
Pre-seeded with the family's data.

Contracts unchanged: tests + build green before commits; no route moves
money; CSP stays self-only (wallpapers self-hosted keeps it intact).
