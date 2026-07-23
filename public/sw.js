const CACHE = "twinpath-shell-v9";
const SHARE_CACHE = "twinpath-share-inbox-v1";
const SHARE_PATH = "/__twinpath-share/";
const MAX_SHARED_TEXT_BYTES = 512 * 1024;
const SHELL = ["/", "/offline.html", "/manifest.webmanifest", "/icon.svg", "/themes/manifest.json"];

function assetUrlsFromDocument(html) {
    const urls = new Set(SHELL);
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        const value = match[1];
        if (value.startsWith("/assets/") || value.startsWith("/icons/") || value.startsWith("/splash/")) {
            urls.add(value);
        }
    }
    return [...urls];
}

async function precacheAppShell() {
    const cache = await caches.open(CACHE);
    const response = await fetch("/", { cache: "reload" });
    if (!response.ok) throw new Error("Unable to cache the application shell.");
    const html = await response.clone().text();
    await cache.put("/", response);
    await cache.addAll(assetUrlsFromDocument(html).filter((url) => url !== "/"));
    const themeManifest = await fetch("/themes/manifest.json", { cache: "reload" })
        .then((manifestResponse) => manifestResponse.ok ? manifestResponse.json() : null)
        .catch(() => null);
    const localThemeAssets = Array.isArray(themeManifest?.assets)
        ? themeManifest.assets
            .filter((asset) => asset?.enabled && /^\/themes\/assets\/[a-z0-9][a-z0-9-]*\.json$/i.test(asset.path || ""))
            .map((asset) => asset.path)
        : [];
    await Promise.allSettled(localThemeAssets.map((path) => cache.add(path)));
}

self.addEventListener("install", (event) => {
    event.waitUntil(precacheAppShell());
});

self.addEventListener("message", (event) => {
    if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        Promise.all([
            caches
                .keys()
                .then((keys) =>
                    Promise.all(
                        keys
                            .filter((key) => key !== CACHE)
                            .map((key) => caches.delete(key))
                    )
                ),
            self.clients.claim(),
        ])
    );
});

async function cacheResponse(request, response) {
    if (response.ok && response.type === "basic" && response.status === 200) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
    }
    return response;
}

async function navigationResponse(request) {
    try {
        return await cacheResponse(request, await fetch(request));
    } catch {
        return (await caches.match(request))
            || (await caches.match("/"))
            || (await caches.match("/offline.html"));
    }
}

async function staticResponse(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return cacheResponse(request, await fetch(request));
}

function sharedText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function looksLikeCsv(value) {
    const firstLine = value.split(/\r?\n/, 1)[0] || "";
    return /\r?\n/.test(value) && firstLine.includes(",");
}

async function receiveSharedImport(request) {
    try {
        const form = await request.formData();
        const file = form.get("file");
        const sharedUrl = sharedText(form.get("url"));
        const plainText = sharedText(form.get("text"));
        let payload;

        if (file && typeof file.text === "function") {
            if (file.size > MAX_SHARED_TEXT_BYTES) {
                return Response.redirect("/?share-error=file-too-large", 303);
            }
            payload = {
                kind: "csv",
                text: (await file.text()).slice(0, MAX_SHARED_TEXT_BYTES),
                label: sharedText(file.name) || "shared-import.csv",
            };
        } else if (looksLikeCsv(plainText)) {
            payload = { kind: "csv", text: plainText, label: "shared-import.csv" };
        } else if (sharedUrl || plainText) {
            payload = {
                kind: "link",
                url: sharedUrl || plainText,
                title: sharedText(form.get("title")).slice(0, 160),
            };
        } else {
            return Response.redirect("/?share-error=nothing-shared", 303);
        }

        const id = crypto.randomUUID();
        const cache = await caches.open(SHARE_CACHE);
        await cache.put(
            `${SHARE_PATH}${id}`,
            new Response(JSON.stringify(payload), {
                headers: { "content-type": "application/json", "cache-control": "no-store" },
            })
        );
        return Response.redirect(`/?shared-import=${encodeURIComponent(id)}`, 303);
    } catch {
        return Response.redirect("/?share-error=import-unavailable", 303);
    }
}

async function consumeSharedImport(request) {
    const cache = await caches.open(SHARE_CACHE);
    const response = await cache.match(request);
    if (!response) return new Response(null, { status: 404 });
    await cache.delete(request);
    return response;
}

self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (url.origin !== self.location.origin) return;

    if (request.method === "POST" && url.pathname === "/import") {
        event.respondWith(receiveSharedImport(request));
        return;
    }

    if (request.method !== "GET") return;

    if (url.pathname.startsWith(SHARE_PATH)) {
        event.respondWith(consumeSharedImport(request));
        return;
    }

    // Never cache API responses, provider responses, or authenticated data.
    if (
        url.pathname.startsWith("/api/")
        || url.pathname.startsWith("/v1/")
        || url.pathname.startsWith("/webhooks")
    ) {
        return;
    }

    if (request.mode === "navigate") {
        event.respondWith(navigationResponse(request));
        return;
    }

    if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/splash/") || url.pathname.startsWith("/themes/")) {
        event.respondWith(staticResponse(request));
    }
});
