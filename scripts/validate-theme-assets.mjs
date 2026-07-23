import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetRoot = path.resolve(root, "theme-assets");
const manifestPath = path.join(assetRoot, "manifest.json");
const maxBytes = 1_500_000;
const idPattern = /^[a-z0-9][a-z0-9-]{1,39}$/;
const urlPattern = /^https:\/\/(?:www\.)?lottiefiles\.com\//i;
const remotePattern = /^(?:https?:)?\/\//i;
const forbiddenKey = /(?:script|javascript|iframe|html|href|url|link)/i;

function fail(message) {
  throw new Error(`Theme asset validation failed: ${message}`);
}

function assertNoRemoteData(value, location = "animation") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoRemoteData(entry, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (forbiddenKey.test(key) || key === "x") fail(`${location}.${key} is not permitted`);
    if (typeof entry === "string" && remotePattern.test(entry)) fail(`${location}.${key} contains a remote URL`);
    assertNoRemoteData(entry, `${location}.${key}`);
  }
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest?.version !== 1 || !Array.isArray(manifest.assets)) fail("manifest must contain version 1 and an assets array");
const ids = new Set();
for (const entry of manifest.assets) {
  if (!entry || typeof entry !== "object" || !idPattern.test(entry.id || "") || ids.has(entry.id)) fail("asset ids must be unique, safe slugs");
  ids.add(entry.id);
  if (typeof entry.enabled !== "boolean") fail(`${entry.id} must declare enabled`);
  if (!entry.enabled) continue;
  for (const field of ["name", "category", "creator", "license", "attribution", "assetFile", "sha256"]) {
    if (typeof entry[field] !== "string" || !entry[field].trim()) fail(`${entry.id}.${field} is required when enabled`);
  }
  if (!urlPattern.test(entry.sourceUrl || "")) fail(`${entry.id}.sourceUrl must be an HTTPS LottieFiles page URL`);
  if (!/^[a-f0-9]{64}$/i.test(entry.sha256)) fail(`${entry.id}.sha256 must be SHA-256`);
  if (path.extname(entry.assetFile).toLowerCase() !== ".json") fail(`${entry.id} must use a local .json Lottie asset`);
  const assetPath = path.resolve(assetRoot, entry.assetFile);
  if (!assetPath.startsWith(`${assetRoot}${path.sep}`)) fail(`${entry.id}.assetFile escapes the local inbox`);
  const info = await stat(assetPath);
  if (!info.isFile() || info.size > maxBytes) fail(`${entry.id} is missing or exceeds ${maxBytes} bytes`);
  const bytes = await readFile(assetPath);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== entry.sha256.toLowerCase()) fail(`${entry.id}.sha256 does not match the local file`);
  let animation;
  try { animation = JSON.parse(bytes.toString("utf8")); }
  catch { fail(`${entry.id} is not valid JSON`); }
  if (!animation || typeof animation !== "object" || !Array.isArray(animation.layers) || !Number.isFinite(animation.v ? Number.parseFloat(animation.v) : NaN)) {
    fail(`${entry.id} is not a supported Lottie JSON animation`);
  }
  assertNoRemoteData(animation);
}
console.log(`Validated ${manifest.assets.filter((entry) => entry.enabled).length} locally packaged theme asset(s).`);
