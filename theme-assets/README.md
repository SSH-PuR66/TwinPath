# Theme asset intake

Place manually downloaded, approved Lottie JSON files in `inbox/`. Do not put
remote URLs, provider embeds, JavaScript, or `.lottie` archives in the app.

For each approved file, complete its record in `manifest.json` with its exact
LottieFiles source URL, creator, license, attribution, SHA-256 hash, and a
relative `assetFile` such as `inbox/cozy-moon.json`. Set `enabled` to `true`
only after `npm run themes:validate` passes. The validation step checks size,
hash, JSON/Lottie shape, permitted local path, and rejects all remote URLs and
script-like fields inside animation data.

The eight Cozy baby records are intentionally disabled placeholders until the
approved downloads are supplied. Packaging is local-only; the browser never
contacts LottieFiles to render a theme.

Use the matching TwinPath theme key as the asset id (or add the same key to
`src/themeCatalog.js`) so the existing CSS depth layers can place its local
animation above the static scene.
