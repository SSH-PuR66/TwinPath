const LEGAL_PAGES = new Set(["privacy", "terms", "refunds"]);
const PRODUCT_ROUTE = /^\/shop\/product\/([^/]+)$/;

export function normalizeApplicationPath(pathname) {
  const source = typeof pathname === "string" ? pathname.trim() : "";
  const pathOnly = source.split(/[?#]/, 1)[0] || "/";
  const withLeadingSlash = pathOnly.startsWith("/")
    ? pathOnly
    : `/${pathOnly}`;

  return withLeadingSlash.replace(/\/+$/, "").toLowerCase() || "/";
}

export function resolveApplicationRoute(pathname, productIds = []) {
  const path = normalizeApplicationPath(pathname);

  if (path === "/" || path === "/import") return { kind: "private-app" };
  if (path === "/shop") return { kind: "storefront" };

  const legalPage = path.match(/^\/shop\/(privacy|terms|refunds)$/)?.[1];
  if (legalPage && LEGAL_PAGES.has(legalPage)) {
    return { kind: "legal", page: legalPage };
  }

  const encodedProductId = path.match(PRODUCT_ROUTE)?.[1];
  if (encodedProductId) {
    try {
      const productId = decodeURIComponent(encodedProductId).toLowerCase();
      const knownProductIds = new Set(
        [...productIds].map((value) => String(value).toLowerCase())
      );

      if (!productId.includes("/") && knownProductIds.has(productId)) {
        return { kind: "product", productId };
      }
    } catch {
      return { kind: "not-found", path };
    }
  }

  return { kind: "not-found", path };
}
