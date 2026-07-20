// Defense-in-depth: never render a stored/user URL in an href without
// re-validating it, even if it was validated at insert time. Blocks
// javascript:, data:, and other non-http(s) schemes and embedded creds.
export function safeExternalUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;

    try {
        const url = new URL(value.trim());

        if (url.protocol !== "https:" && url.protocol !== "http:") {
            return null;
        }

        if (url.username || url.password) return null;

        return url.toString();
    } catch {
        return null;
    }
}
