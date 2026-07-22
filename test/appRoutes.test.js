import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeApplicationPath,
  resolveApplicationRoute,
} from "../src/appRoutes.js";

const productIds = [
  "digital-safety-checklist",
  "cyber-lab-tracker",
  "security-incident-notebook",
  "digital-security-bundle",
];

test("normalizes application paths without browser globals", () => {
  assert.equal(normalizeApplicationPath("/"), "/");
  assert.equal(normalizeApplicationPath("/SHOP/"), "/shop");
  assert.equal(normalizeApplicationPath("shop/privacy///"), "/shop/privacy");
  assert.equal(normalizeApplicationPath("/shop?from=test"), "/shop");
  assert.equal(normalizeApplicationPath(""), "/");
});

test("resolves each supported top-level route explicitly", () => {
  assert.deepEqual(resolveApplicationRoute("/", productIds), {
    kind: "private-app",
  });
  assert.deepEqual(resolveApplicationRoute("/shop/", productIds), {
    kind: "storefront",
  });

  for (const page of ["privacy", "terms", "refunds"]) {
    assert.deepEqual(
      resolveApplicationRoute(`/SHOP/${page.toUpperCase()}/`, productIds),
      { kind: "legal", page }
    );
  }
});

test("resolves only known product IDs to focused product pages", () => {
  for (const productId of productIds) {
    assert.deepEqual(
      resolveApplicationRoute(`/shop/product/${productId}/`, productIds),
      { kind: "product", productId }
    );
  }

  assert.deepEqual(
    resolveApplicationRoute(
      "/SHOP/PRODUCT/DIGITAL-SAFETY-CHECKLIST",
      productIds
    ),
    { kind: "product", productId: "digital-safety-checklist" }
  );
  assert.deepEqual(
    resolveApplicationRoute(
      "/shop/product/digital%2Dsafety%2Dchecklist",
      productIds
    ),
    { kind: "product", productId: "digital-safety-checklist" }
  );
});

test("invalid, malformed, and unknown paths resolve to not found", () => {
  const cases = [
    "/missing",
    "/shop/product",
    "/shop/product/not-a-product",
    "/shop/product/%E0%A4%A",
    "/shop/product/digital-safety-checklist/extra",
    "/shop/product/digital%2Fsafety-checklist",
  ];

  for (const pathname of cases) {
    const route = resolveApplicationRoute(pathname, productIds);
    assert.equal(route.kind, "not-found", pathname);
    assert.equal(typeof route.path, "string", pathname);
  }
});
