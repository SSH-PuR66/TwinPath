import assert from "node:assert/strict";
import test from "node:test";

import {
  AMAZON_CART_BASE,
  buildCartUrl,
  cartUrlForItems,
  isValidAsin,
  kits,
  portals,
  realisticBudget,
} from "../src/twinsPrepCatalog.js";

// Every ASIN below was read out of a real amazon.com product URL during
// research. Nothing outside this set may appear in the catalog. If a new
// product is added, verify it on Amazon first and add it here deliberately.
const VERIFIED_ASINS = new Set([
  // Infant car seats and bases
  "B09LKZFKGD",
  "B07MLW6ZSQ",
  "B081QVTBT3",
  "B07T25WNL3",
  "B07Y5S4VWT",
  "B07Y5SLKCK",
  "B08TX4GYTB",
  "B0DXP9S96C",
  "B0BWHD71J9",
  "B08C79V1G1",
  // Strollers and frames
  "B008U4MKU6",
  "B01LZBEZYY",
  "B00M733I02",
  "B013P21D9Q",
  "B00M72W7IC",
  "B0D59NZ1DW",
  "B0BRMFYKM7",
  "B0876T8DZ9",
  "B00LVMM72A",
  "B01GHVJHMW",
  "B094NY8PZ3",
  // Sleep surfaces
  "B08K3314ZL",
  "B00H8MRBI2",
  "B09MWHG3ZT",
  "B07612RVQK",
  // Feeding
  "B00PC3KVYA",
  "B007VEBMBO",
  "B084Z6ZRLG",
  "B08BHT19MS",
  "B01845QGKK",
  "B01N34NNJK",
  // Diapers
  "B07CVBTN3N",
  "B07DCCP3Y1",
  "B08PX2V52Q",
]);

// Real ASINs that must never be offered as a purchase.
//   B0BRMFYKM7 - Evenflo Pivot Xpand SINGLE. BabyGearLab labels it "Double".
//                Ordering it leaves you with one seat and two babies.
//   B07612RVQK - HALO BassiNest Twin. One shared surface, $500+, and the
//                catalog exists partly to argue against it.
const NEVER_PURCHASABLE = new Set(["B0BRMFYKM7", "B07612RVQK"]);

const AFFILIATE_KEYS = [
  "tag",
  "ref",
  "ref_",
  "linkcode",
  "linkid",
  "ascsubtag",
  "creative",
  "creativeasin",
  "camp",
  "associd",
  "smid",
  "psc",
];

const PORTAL_HOSTS = new Set([
  "www.myunidays.com",
  "www.studentbeans.com",
  "www.amazon.com",
]);

function allItems() {
  return kits.flatMap((kit) => kit.items || []);
}

function allExternalUrls() {
  const urls = [];
  for (const portal of portals) {
    urls.push(portal.url);
    for (const pick of portal.picks) {
      if (pick.url) urls.push(pick.url);
    }
  }
  return urls;
}

test("isValidAsin accepts real ASINs and rejects everything else", () => {
  assert.equal(isValidAsin("B0DXP9S96C"), true);
  assert.equal(isValidAsin("B08K3314ZL"), true);

  assert.equal(isValidAsin("b0dxp9s96c"), false, "lowercase is not an ASIN");
  assert.equal(isValidAsin("B0DXP9S96"), false, "nine characters is too short");
  assert.equal(isValidAsin("B0DXP9S96CC"), false, "eleven is too long");
  assert.equal(isValidAsin("A0DXP9S96C"), false, "must start with B");
  assert.equal(isValidAsin("B0DXP9S9-C"), false, "no punctuation");
  assert.equal(isValidAsin(""), false);
  assert.equal(isValidAsin(null), false);
  assert.equal(isValidAsin(undefined), false);
  assert.equal(isValidAsin(12345), false);
  assert.equal(isValidAsin({ asin: "B0DXP9S96C" }), false);
});

test("buildCartUrl refuses to emit a partial or malformed cart", () => {
  assert.equal(buildCartUrl(null), null);
  assert.equal(buildCartUrl([]), null);
  assert.equal(buildCartUrl("B0DXP9S96C"), null);

  // One bad line poisons the whole cart rather than silently dropping.
  assert.equal(
    buildCartUrl([{ asin: "B0DXP9S96C", qty: 1 }, { asin: "nope", qty: 1 }]),
    null,
  );

  assert.equal(buildCartUrl([{ asin: "B0DXP9S96C", qty: 0 }]), null);
  assert.equal(buildCartUrl([{ asin: "B0DXP9S96C", qty: -2 }]), null);
  assert.equal(buildCartUrl([{ asin: "B0DXP9S96C", qty: 13 }]), null);
  assert.equal(buildCartUrl([{ asin: "B0DXP9S96C", qty: 1.5 }]), null);
  assert.equal(buildCartUrl([{ asin: "B0DXP9S96C", qty: "two" }]), null);

  const tooMany = Array.from({ length: 11 }, () => ({
    asin: "B0DXP9S96C",
    qty: 1,
  }));
  assert.equal(buildCartUrl(tooMany), null, "cap is ten lines");
});

test("buildCartUrl emits ASIN and Quantity pairs and nothing else", () => {
  const url = buildCartUrl([
    { asin: "B0DXP9S96C", qty: 2 },
    { asin: "B08K3314ZL", qty: 2 },
  ]);

  assert.ok(url, "a valid cart should build");
  assert.ok(url.startsWith(AMAZON_CART_BASE));

  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:");
  assert.equal(parsed.hostname, "www.amazon.com");
  assert.equal(parsed.pathname, "/gp/aws/cart/add.html");

  const keys = [...parsed.searchParams.keys()];
  assert.deepEqual(keys, [
    "ASIN.1",
    "Quantity.1",
    "ASIN.2",
    "Quantity.2",
  ]);
  assert.equal(parsed.searchParams.get("ASIN.1"), "B0DXP9S96C");
  assert.equal(parsed.searchParams.get("Quantity.1"), "2");
  assert.equal(parsed.searchParams.get("ASIN.2"), "B08K3314ZL");
  assert.equal(parsed.searchParams.get("Quantity.2"), "2");
});

test("cartUrlForItems drops unusable entries instead of throwing", () => {
  assert.equal(cartUrlForItems(null), null);
  assert.equal(cartUrlForItems([]), null);
  assert.equal(cartUrlForItems([{ name: "no asin" }]), null);

  const url = cartUrlForItems([
    { asin: "B0DXP9S96C", qty: 2 },
    { name: "text-only pick" },
  ]);
  const parsed = new URL(url);
  assert.deepEqual([...parsed.searchParams.keys()], ["ASIN.1", "Quantity.1"]);
});

test("no cart URL anywhere in the catalog carries an affiliate parameter", () => {
  const urls = [];

  for (const kit of kits) {
    if (kit.items && kit.items.length) {
      urls.push(cartUrlForItems(kit.items));
      for (const item of kit.items) {
        urls.push(cartUrlForItems([item]));
      }
    }
  }

  assert.ok(urls.length > 0, "the catalog should produce cart links");

  for (const url of urls) {
    assert.ok(url, "every kit and item should build a cart link");
    const parsed = new URL(url);

    assert.equal(parsed.protocol, "https:");
    assert.equal(parsed.hostname, "www.amazon.com");
    assert.equal(parsed.hash, "");

    for (const key of parsed.searchParams.keys()) {
      assert.match(
        key,
        /^(ASIN|Quantity)\.\d+$/,
        `unexpected cart parameter "${key}" in ${url}`,
      );
      assert.ok(
        !AFFILIATE_KEYS.includes(key.toLowerCase()),
        `affiliate parameter "${key}" found in ${url}`,
      );
    }
  }
});

test("every catalog ASIN was verified, and no banned ASIN is purchasable", () => {
  const items = allItems();
  assert.ok(items.length >= 20, "the catalog should not have emptied out");

  for (const item of items) {
    assert.ok(
      isValidAsin(item.asin),
      `${item.name} carries a malformed ASIN: ${item.asin}`,
    );
    assert.ok(
      VERIFIED_ASINS.has(item.asin),
      `${item.name} uses unverified ASIN ${item.asin} - verify it on Amazon and add it to the list, do not guess`,
    );
    assert.ok(
      !NEVER_PURCHASABLE.has(item.asin),
      `${item.name} offers banned ASIN ${item.asin}`,
    );
    assert.ok(
      Number.isInteger(item.qty) && item.qty >= 1 && item.qty <= 12,
      `${item.name} has an out-of-range quantity: ${item.qty}`,
    );
    assert.ok(item.why && item.why.length > 10, `${item.name} needs a reason`);
  }
});

test("the Pivot Xpand single-seat trap is named in a warning, not sold", () => {
  const wheels = kits.find((kit) => kit.id === "wheels");
  assert.ok(wheels, "the wheels kit should exist");

  const warned = (wheels.warnings || []).some((warning) =>
    warning.includes("B0BRMFYKM7"),
  );
  assert.ok(warned, "the single-seat mislabel must be called out explicitly");

  const correct = wheels.items.some((item) => item.asin === "B0D59NZ1DW");
  assert.ok(correct, "the twins SKU should be the one offered");
});

test("external portal links are https, on known hosts, and untagged", () => {
  const urls = allExternalUrls();
  assert.ok(urls.length >= 6, "portals should carry verified deep links");

  for (const url of urls) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "https:", `${url} must be https`);
    assert.ok(
      PORTAL_HOSTS.has(parsed.hostname),
      `${url} points at an unexpected host`,
    );
    assert.equal(parsed.username, "");
    assert.equal(parsed.password, "");

    for (const key of parsed.searchParams.keys()) {
      const lower = key.toLowerCase();
      assert.ok(
        !AFFILIATE_KEYS.includes(lower),
        `affiliate parameter "${key}" found in ${url}`,
      );
      assert.ok(
        !lower.startsWith("utm_"),
        `tracking parameter "${key}" found in ${url}`,
      );
    }
  }
});

test("every kit is renderable and every portal is complete", () => {
  const seen = new Set();

  for (const kit of kits) {
    assert.ok(kit.id && !seen.has(kit.id), `duplicate or missing kit id: ${kit.id}`);
    seen.add(kit.id);

    assert.ok(kit.label && kit.short && kit.icon);
    assert.ok(kit.when && kit.headline && kit.note);
    assert.ok(
      (kit.items && kit.items.length) || (kit.steps && kit.steps.length),
      `${kit.id} renders nothing`,
    );

    if (kit.math) {
      assert.ok(kit.math.title && kit.math.footer);
      assert.ok(Array.isArray(kit.math.rows) && kit.math.rows.length > 0);
      for (const row of kit.math.rows) {
        assert.equal(row.length, 4, `${kit.id} math rows must have four cells`);
      }
    }
  }

  for (const portal of portals) {
    assert.ok(portal.id && portal.name && portal.url);
    assert.ok(portal.lead && portal.truth);
    assert.ok(Array.isArray(portal.picks) && portal.picks.length > 0);
    for (const pick of portal.picks) {
      assert.ok(pick.label && pick.detail, `${portal.id} has an empty pick`);
    }
  }

  assert.ok(realisticBudget.low > 0);
  assert.ok(realisticBudget.high > realisticBudget.low);
});
