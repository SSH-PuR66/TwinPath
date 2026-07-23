import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const distRoot = fileURLToPath(new URL("../dist/", import.meta.url));
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const assetsDir = fileURLToPath(new URL("../dist/assets/", import.meta.url));

const REQUIRED = [
    {
        needle: "twinpath-control-plane.srodriguez46.workers.dev",
        label: "control-plane Worker URL",
    },
    {
        needle: "wtdmjybpfimmsojsdobx.supabase.co",
        label: "Supabase project URL",
    },
];

const files = (await readdir(assetsDir)).filter((name) =>
    name.endsWith(".js")
);

if (files.length === 0) {
    throw new Error("dist/assets contains no JavaScript bundles.");
}

const found = new Map(REQUIRED.map((item) => [item.needle, false]));

for (const name of files) {
    const content = await readFile(join(assetsDir, name), "utf8");
    for (const { needle } of REQUIRED) {
        if (content.includes(needle)) {
            found.set(needle, true);
        }
    }
}

const missing = REQUIRED.filter(({ needle }) => !found.get(needle));

if (missing.length > 0) {
    throw new Error(
        `Production build is missing required configuration: ${missing
            .map(({ label }) => label)
            .join(", ")}. Refusing to ship a build that cannot reach its backends.`
    );
}

async function requiredPublicFile(relativePath, label) {
    try {
        return await readFile(join(distRoot, relativePath), "utf8");
    } catch {
        throw new Error(`Production build is missing ${label}: ${relativePath}`);
    }
}

const document = await requiredPublicFile("index.html", "the app document");
if (!document.includes('rel="manifest" href="/manifest.webmanifest"')) {
    throw new Error("Production app document does not link to the web app manifest.");
}
if (!document.includes('rel="apple-touch-icon"')) {
    throw new Error("Production app document is missing the Apple touch icon.");
}

const splashPaths = [...document.matchAll(/rel="apple-touch-startup-image"\s+href="([^"?]+)/g)]
    .map((match) => match[1].replace(/^\/+/, ""));
if (splashPaths.length === 0) {
    throw new Error("Production app document is missing iOS startup images.");
}
for (const path of splashPaths) {
    await requiredPublicFile(path, "an iOS startup image");
}

const manifest = JSON.parse(await requiredPublicFile("manifest.webmanifest", "the web app manifest"));
if (manifest.display !== "standalone" || manifest.start_url !== "/" || manifest.scope !== "/") {
    throw new Error("Web app manifest must keep the standalone root-scoped PWA configuration.");
}
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
    throw new Error("Web app manifest must provide install icons.");
}
if (
    manifest?.share_target?.action !== "/import"
    || manifest.share_target.method !== "POST"
    || manifest.share_target.enctype !== "multipart/form-data"
) {
    throw new Error("Web app manifest must keep the installed-app share target.");
}

for (const icon of manifest.icons) {
    const path = typeof icon?.src === "string" ? icon.src.replace(/^\/+/, "") : "";
    if (!path) throw new Error("Web app manifest contains an icon without a local src path.");
    await requiredPublicFile(path, "a manifest icon");
}

const serviceWorker = await requiredPublicFile("sw.js", "the service worker");
for (const requiredShellAsset of ["offline.html", "manifest.webmanifest", "icon.svg", "themes/manifest.json"]) {
    await requiredPublicFile(requiredShellAsset, "a service-worker shell asset");
}
for (const requiredWorkerFeature of ["SKIP_WAITING", "self.clients.claim()", "/offline.html", "/splash/", "receiveSharedImport", "consumeSharedImport"]) {
    if (!serviceWorker.includes(requiredWorkerFeature)) {
        throw new Error(`Service worker is missing required PWA behavior: ${requiredWorkerFeature}`);
    }
}

const workerConfig = JSON.parse(await readFile(join(projectRoot, "wrangler.jsonc"), "utf8"));
if (workerConfig?.assets?.html_handling !== "none") {
    throw new Error("Cloudflare asset HTML handling must remain disabled so /offline.html is served without a redirect.");
}

console.log(
    `Verified ${files.length} bundles and PWA assets: control-plane and Supabase URLs are baked in.`
);
