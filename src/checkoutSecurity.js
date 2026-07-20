const APPROVED_CHECKOUT_HOSTS = new Set([
    "gumroad.com",
    "www.gumroad.com",
]);

export function validateCheckoutUrl(value) {
    if (typeof value !== "string" || !value.trim()) {
        return {
            valid: false,
            reason: "Missing checkout URL",
            url: null,
        };
    }

    try {
        const url = new URL(value.trim());
        const hostname = url.hostname.toLowerCase();

        const approved =
            APPROVED_CHECKOUT_HOSTS.has(hostname) ||
            hostname.endsWith(".gumroad.com");

        if (url.protocol !== "https:") {
            return {
                valid: false,
                reason: "Checkout must use HTTPS",
                url: null,
            };
        }

        if (!approved) {
            return {
                valid: false,
                reason: "Checkout provider is not approved",
                url: null,
            };
        }

        if (url.username || url.password) {
            return {
                valid: false,
                reason: "Checkout URL contains credentials",
                url: null,
            };
        }

        return {
            valid: true,
            reason: "",
            url: url.toString(),
        };
    } catch {
        return {
            valid: false,
            reason: "Invalid checkout URL",
            url: null,
        };
    }
}
