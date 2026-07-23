const CACHE = "twinpath-shell-v8";
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

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // Never cache API responses, provider responses, or authenticated data.
    if (url.origin !== self.location.origin) return;
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
