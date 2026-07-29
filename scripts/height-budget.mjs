// Renders each route at a phone and a laptop viewport and reports how many
// screens tall it is. Fails when a route exceeds its budget.
// Run: npm run heights   (needs a local dev server on PORT)
import { chromium } from "playwright";

const BASE = process.env.HEIGHT_BASE || "http://127.0.0.1:5173";
const ROUTES = [
  { path: "/", phone: 2.2, wide: 1.05 },
  { path: "/money", phone: 2.6, wide: 1.05 },
  { path: "/grow", phone: 2.6, wide: 1.05 },
  { path: "/family", phone: 2.6, wide: 1.05 },
  { path: "/settings", phone: 2.6, wide: 1.05 },
];

const VIEWPORTS = [
  { key: "phone", width: 390, height: 844 },
  { key: "wide", width: 1440, height: 900 },
];

const browser = await chromium.launch();
const rows = [];
let failed = 0;

for (const route of ROUTES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + route.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      winH: window.innerHeight,
      wideX: document.documentElement.scrollWidth > window.innerWidth + 1,
    }));
    await ctx.close();

    const screens = m.docH / m.winH;
    const budget = route[vp.key];
    const displayedScreens = Number(screens.toFixed(2));
    const displayedBudget = Number(budget.toFixed(2));
    const bad = displayedScreens > displayedBudget || m.wideX || errors.length > 0;
    if (bad) failed += 1;
    rows.push({
      route: route.path, vp: vp.key,
      docH: m.docH,
      screens: displayedScreens.toFixed(2), budget: displayedBudget.toFixed(2),
      sideways: m.wideX, errors: errors.length, ok: !bad,
    });
  }
}

await browser.close();
console.table(rows);
if (failed) {
  console.error(`\n${failed} route/viewport pair(s) over budget or scrolling sideways.`);
  process.exit(1);
}
console.log("\nAll routes within budget.");
