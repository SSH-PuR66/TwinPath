
## v4.7 (2026-09-03): home-screen icons carry the mark

`python patch_v47.py` re-embeds `assets/icon-{32,192,512}.png` and `apple-touch-icon.png` (rendered from `assets/icon.svg`
by `scratchpad/icons.mjs`, Playwright) into the `PWA_ICONS` constant the Worker serves. Run it after any change to the mark.
