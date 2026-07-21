const MAX_URL_LENGTH = 2048;

const LOCAL_DEVELOPMENT_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

const APPROVED_CHECKOUT_HOSTS = new Set([
  "gumroad.com",
  "www.gumroad.com",
  "checkout.stripe.com",
  "billing.stripe.com",
]);

function containsControlCharacters(value) {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function hostnameMatches(hostname, allowedHostname) {
  const normalizedHost = hostname.toLowerCase();
  const normalizedAllowed =
    allowedHostname.toLowerCase();

  return (
    normalizedHost === normalizedAllowed ||
    normalizedHost.endsWith(
      `.${normalizedAllowed}`
    )
  );
}

export function safeExternalUrl(
  value,
  {
    allowedHosts = null,
    allowLocalHttp = true,
  } = {}
) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (!trimmed) return null;
  if (trimmed.length > MAX_URL_LENGTH) return null;
  if (containsControlCharacters(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();

    if (url.username || url.password) {
      return null;
    }

    const isHttps =
      url.protocol === "https:";

    const isAllowedLocalHttp =
      allowLocalHttp &&
      url.protocol === "http:" &&
      LOCAL_DEVELOPMENT_HOSTS.has(hostname);

    if (!isHttps && !isAllowedLocalHttp) {
      return null;
    }

    if (
      Array.isArray(allowedHosts) &&
      allowedHosts.length > 0
    ) {
      const approved = allowedHosts.some(
        (host) =>
          hostnameMatches(hostname, host)
      );

      if (!approved) {
        return null;
      }
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function safeCheckoutUrl(value) {
  return safeExternalUrl(value, {
    allowedHosts: [
      ...APPROVED_CHECKOUT_HOSTS,
    ],
    allowLocalHttp: false,
  });
}

export function safeOfficialUrl(
  value,
  allowedHosts
) {
  return safeExternalUrl(value, {
    allowedHosts,
    allowLocalHttp: false,
  });
}
