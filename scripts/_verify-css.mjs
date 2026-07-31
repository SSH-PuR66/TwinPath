// Disposable verification probe for the Phase 2 CSS repairs.
// Re-checks only the states named in CSS-DIAGNOSIS.md Findings 1-3, plus the
// deferred bottom-nav overlap. Not a replacement for the full 104-state sweep.
// Delete after review.
import { chromium } from "playwright";

const BASE = process.env.HEIGHT_BASE || "http://127.0.0.1:5173";

const STATES = [
    { path: "/grow", tab: "profit", w: 360, h: 800, wasLost: null },
    { path: "/grow", tab: "profit", w: 390, h: 844, wasLost: 10337 },
    { path: "/grow", tab: "profit", w: 768, h: 1024, wasLost: null },
    { path: "/grow", tab: "profit", w: 1024, h: 768, wasLost: null },
    { path: "/grow", tab: "profit", w: 1280, h: 800, wasLost: null },
    { path: "/grow", tab: "profit", w: 1440, h: 900, wasLost: 5270 },
    { path: "/grow", tab: "automations", w: 1024, h: 768, wasLost: 3237 },
    { path: "/grow", tab: "student", w: 1024, h: 768, wasLost: 1863 },
    { path: "/money", tab: null, w: 834, h: 1112, wasLost: 4166 },
    { path: "/money", tab: null, w: 1440, h: 900, wasLost: 3392 },
    { path: "/grow", tab: "aid", w: 1440, h: 900, wasLost: 1467 },
    { path: "/grow", tab: "prep", w: 1440, h: 900, wasLost: 1073 },
    { path: "/grow", tab: "markets", w: 390, h: 844, wasLost: null },
    { path: "/", tab: null, w: 390, h: 844, wasLost: null },
    { path: "/family", tab: null, w: 1440, h: 900, wasLost: null },
];

const probe = () => {
    const round = (n) => Math.round(n * 10) / 10;
    const scrollable = (el) => {
        const cs = getComputedStyle(el);
        return /(auto|scroll)/.test(cs.overflowY);
    };

    // 1. Content clipped by a bounded pane with no scrollable ancestor between.
    const clips = [];
    for (const pane of document.querySelectorAll(".tp-pane")) {
        const paneRect = pane.getBoundingClientRect();
        if (paneRect.height === 0) continue;
        let worst = 0;
        let worstSel = "";
        for (const el of pane.querySelectorAll("*")) {
            let node = el.parentElement;
            let guarded = false;
            while (node && node !== pane) {
                if (scrollable(node)) { guarded = true; break; }
                node = node.parentElement;
            }
            if (guarded) continue;
            const r = el.getBoundingClientRect();
            if (r.height === 0 && r.width === 0) continue;
            const over = r.bottom - paneRect.bottom;
            if (over > worst) {
                worst = over;
                worstSel = el.className && typeof el.className === "string"
                    ? `${el.tagName.toLowerCase()}.${el.className.trim().split(/\s+/).join(".")}`
                    : el.tagName.toLowerCase();
            }
        }
        if (worst > 1) {
            clips.push({
                pane: pane.className.trim().split(/\s+/).join("."),
                lost: round(worst),
                element: worstSel,
            });
        }
    }

    // 2. Pane bodies: reachable scroll, and no fade on a body that fits.
    const bodies = [];
    for (const b of document.querySelectorAll(".tp-pane__body")) {
        const fits = b.scrollHeight - b.clientHeight <= 1;
        bodies.push({
            pane: (b.closest(".tp-pane")?.className || "").trim().split(/\s+/).join("."),
            clientH: round(b.clientHeight),
            scrollH: round(b.scrollHeight),
            scrollable: !fits,
            fadeOnFittingBody: fits && b.classList.contains("is-more") && !b.classList.contains("is-end"),
            collapsed: b.clientHeight === 0,
        });
    }

    // 3. Header / content adjacency (Finding 2).
    const header = document.querySelector(".app-header");
    const content = document.querySelector(".content");
    const headerBox = header ? header.getBoundingClientRect() : null;
    const adjacency = headerBox && content
        ? {
            headerHeight: round(headerBox.height),
            gap: round(content.getBoundingClientRect().top - headerBox.bottom),
            contentHeight: round(content.getBoundingClientRect().height),
            contentBottomVsViewport: round(innerHeight - content.getBoundingClientRect().bottom),
        }
        : null;

    // 4. bottom-nav overlapping anything interactive (the deferred finding).
    const nav = document.querySelector(".bottom-nav");
    const navBox = nav ? nav.getBoundingClientRect() : null;
    const overlaps = [];
    if (navBox) {
        const sel = "button,a,input,select,textarea,[role=button],[tabindex]";
        for (const el of document.querySelectorAll(sel)) {
            if (nav.contains(el)) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === "hidden" || cs.display === "none" || cs.pointerEvents === "none") continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            const ox = Math.max(0, Math.min(r.right, navBox.right) - Math.max(r.left, navBox.left));
            const oy = Math.max(0, Math.min(r.bottom, navBox.bottom) - Math.max(r.top, navBox.top));
            if (ox * oy > 4) {
                overlaps.push({
                    element: `${el.tagName.toLowerCase()}.${(el.className || "").toString().trim().split(/\s+/).join(".")}`,
                    area: Math.round(ox * oy),
                });
            }
        }
    }

    // 5. Grow rail sizing (Finding 3) + truncated money values.
    const rail = document.querySelector(".grow-tabs.grow-workspace-tabs");
    const railItems = rail ? [...rail.children] : [];
    const railInfo = rail
        ? {
            railItemVar: getComputedStyle(rail).getPropertyValue("--tp-rail-item").trim(),
            lastTabRight: round(railItems.at(-1).getBoundingClientRect().right),
            itemWidths: railItems.map((c) => round(c.getBoundingClientRect().width)),
            scrolls: rail.scrollWidth > rail.clientWidth + 1,
        }
        : null;

    const truncated = [...document.querySelectorAll(".money-density__pulse .summary-card strong, .money-density__pulse .summary-card small")]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => ({ text: el.textContent.slice(0, 40), clientW: round(el.clientWidth), scrollW: round(el.scrollWidth) }));

    const heroBody = document.querySelector(".grow-density__hero .tp-pane__body, .money-density__summary .tp-pane__body");
    const hero = heroBody
        ? {
            paddingBottom: getComputedStyle(heroBody).paddingBottom,
            bottomNavHeight: getComputedStyle(heroBody).getPropertyValue("--tp-bottom-nav-height").trim(),
            bottomNavOffset: getComputedStyle(heroBody).getPropertyValue("--tp-bottom-nav-offset").trim(),
            bodyBottom: round(heroBody.getBoundingClientRect().bottom),
            navTop: navBox ? round(navBox.top) : null,
            clearance: navBox ? round(parseFloat(getComputedStyle(heroBody).paddingBottom) - navBox.height) : null,
        }
        : null;

    return {
        displayModeStandalone: window.matchMedia("(display-mode: standalone)").matches,
        visualViewport: window.visualViewport
            ? { width: round(window.visualViewport.width), height: round(window.visualViewport.height) }
            : null,
        docScrollHeight: document.documentElement.scrollHeight,
        innerHeight,
        heightRatio: round(document.documentElement.scrollHeight / innerHeight),
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1
            ? { scrollWidth: document.documentElement.scrollWidth, innerWidth }
            : null,
        navHeight: navBox ? round(navBox.height) : null,
        clips,
        collapsedBodies: bodies.filter((b) => b.collapsed),
        fadeOnFittingBodies: bodies.filter((b) => b.fadeOnFittingBody),
        bodies,
        adjacency,
        overlaps,
        railInfo,
        truncated,
        hero,
    };
};

// A fixed nav sitting over a control is only a defect if no scroll can clear it.
// Scrolling every container to its end and re-measuring is the honest test:
// whatever still overlaps at maximum scroll is genuinely unreachable.
const scrollAllToEnd = () => {
    document.documentElement.scrollTop = document.documentElement.scrollHeight;
    document.body.scrollTop = document.body.scrollHeight;
    for (const el of document.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) {
            el.scrollTop = el.scrollHeight;
        }
    }
};

const browser = await chromium.launch();
const results = [];
const GEOMETRIES = [
    { name: "browser-tab", heightDelta: 0, safeAreaBottom: 0 },
    {
        name: "geometry-emulated; display-mode flag not emulatable in Chromium",
        heightDelta: 80,
        safeAreaBottom: 34,
    },
];

for (const geometry of GEOMETRIES) {
for (const state of STATES) {
    const page = await browser.newPage({ viewport: { width: state.w, height: state.h + geometry.heightDelta } });
    await page.goto(`${BASE}${state.path}`, { waitUntil: "networkidle" });
    await page.addStyleTag({
        content: `.app-shell { --tp-safe-area-bottom: ${geometry.safeAreaBottom}px !important; }
                  .bottom-nav { padding-bottom: max(0.35rem, var(--tp-safe-area-bottom)) !important; }`,
    });
    await page.waitForTimeout(700);
    if (state.tab) {
        const btn = page.locator(".grow-tabs.grow-workspace-tabs button", {
            hasText: new RegExp(state.tab, "i"),
        }).first();
        if (await btn.count()) {
            await btn.click();
            await page.waitForTimeout(500);
        } else {
            results.push({ ...state, geometry: geometry.name, safeAreaBottom: geometry.safeAreaBottom, error: `tab button "${state.tab}" not found` });
            await page.close();
            continue;
        }
    }
    const data = await page.evaluate(probe);
    await page.evaluate(scrollAllToEnd);
    await page.waitForTimeout(400);
    const atEnd = await page.evaluate(probe);
    data.overlaps = atEnd.overlaps;
    results.push({ ...state, geometry: geometry.name, safeAreaBottom: geometry.safeAreaBottom, ...data });
    await page.close();
}
}

await browser.close();

const line = (s) => `${s.path}${s.tab ? ` ${s.tab}` : ""} @ ${s.w}x${s.h} ${s.geometry}`;
console.log("\n=== PHASE 2 VERIFY ===\n");
let fail = 0;
for (const r of results) {
    if (r.error) { console.log(`FAIL ${line(r)} — ${r.error}`); fail++; continue; }
    const bad = [];
    if (r.clips.length) bad.push(`clipped: ${r.clips.map((c) => `${c.lost}px in .${c.pane}`).join("; ")}`);
    if (r.collapsedBodies.length) bad.push(`collapsed bodies: ${r.collapsedBodies.length}`);
    if (r.horizontalOverflow) bad.push(`h-overflow ${r.horizontalOverflow.scrollWidth}>${r.horizontalOverflow.innerWidth}`);
    if (r.overlaps.length) bad.push(`nav overlaps: ${r.overlaps.map((o) => `${o.element} ${o.area}px2`).join("; ")}`);
    if (r.fadeOnFittingBodies.length) bad.push(`fade on fitting body: ${r.fadeOnFittingBodies.length}`);
    if (r.truncated.length) bad.push(`truncated: ${r.truncated.map((t) => t.text).join("; ")}`);
    if (r.hero && r.hero.clearance !== null && r.hero.clearance < 0) bad.push(`hero clearance ${r.hero.clearance}px`);
    if (bad.length) fail++;
    console.log(
        `${bad.length ? "FAIL" : "ok  "} ${line(r)}` +
        ` | was ${r.wasLost === null ? "n/a" : `${r.wasLost}px lost`}` +
        ` | ratio ${r.heightRatio}` +
        ` | header ${r.adjacency ? r.adjacency.headerHeight : "?"}px gap ${r.adjacency ? r.adjacency.gap : "?"}px` +
        ` | nav ${r.navHeight}px` +
        (r.hero ? ` | hero pb ${r.hero.paddingBottom} clearance ${r.hero.clearance}px (--nav ${r.hero.bottomNavHeight}, safe ${r.safeAreaBottom}px, actual ${r.displayModeStandalone ? "standalone" : "browser"})` : "") +
        (r.railInfo ? ` | rail-item ${r.railInfo.railItemVar || "(unset)"} lastRight ${r.railInfo.lastTabRight} scrolls ${r.railInfo.scrolls}` : "") +
        (bad.length ? `\n     ${bad.join("\n     ")}` : "")
    );
}
console.log(`\n${results.length - fail}/${results.length} states clean\n`);
process.exit(fail ? 1 : 0);
