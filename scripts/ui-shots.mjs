// Before/after UI screenshots for the motion overhaul.
// Usage: node scripts/ui-shots.mjs <label> [baseUrl]
//   -> docs/ui-shots/<label>-<viewport>-<route>.png
// Requires a dev server started with VITE_E2E_MOCK_AUTH=1 so no real
// Supabase session is needed.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const LABEL = process.argv[2] || "shot";
const BASE = process.argv[3] || "http://127.0.0.1:5199";
const OUT = "docs/ui-shots";

const VIEWPORTS = [
    { name: "390x844", width: 390, height: 844, mobile: true },
    { name: "1440x900", width: 1440, height: 900, mobile: false },
];

const ROUTES = [
    { path: "/", slug: "home" },
    { path: "/money", slug: "money" },
    { path: "/grow", slug: "grow" },
    { path: "/grow", slug: "markets", markets: true },
    { path: "/family", slug: "family" },
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: 2,
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
    });

    for (const route of ROUTES) {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
        await page.goto(BASE + route.path, { waitUntil: "networkidle" }).catch(() => {});
        await page.waitForTimeout(900);
        if (route.markets) {
            const tab = page.getByRole("button", { name: /markets/i }).first();
            if (await tab.count()) {
                await tab.click().catch(() => {});
                await page.waitForTimeout(700);
            }
        }
        await page.screenshot({ path: `${OUT}/${LABEL}-${vp.name}-${route.slug}.png`, fullPage: false });
        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        console.log(`${LABEL} ${vp.name} ${route.slug}: overflow=${overflow}px errors=${errors.length} ${errors[0] || ""}`);
        await page.close();
    }
    await context.close();
}

await browser.close();