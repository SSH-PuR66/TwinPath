/**
 * marketsCatalog.js — a dated, read-only snapshot of the brokerage accounts.
 *
 * Three rules this file enforces, structurally rather than by convention:
 *
 * 1. NOTHING HERE PLACES AN ORDER. There is no order shape, no ticket, no
 *    side field, no quantity-to-buy. TwinPath reads. You trade in the broker's
 *    own app. test/marketsCatalog.test.js fails the build if that changes.
 *
 * 2. NO ACCOUNT NUMBERS. Not full, not masked, not last-four. Accounts are
 *    identified by the job they do. Same rule the profile vault runs on.
 *
 * 3. NOTHING HERE IS A RECOMMENDATION. Every field is an observed number or a
 *    plain description of one. No targets, no ratings, no "consider".
 *
 * Prices are a snapshot, not a live feed — MARKETS_SNAPSHOT_AT is stamped on
 * screen so a stale number can never read as a current one. Refresh by asking
 * Claude to re-read the broker and rewrite this file.
 */

export const MARKETS_SNAPSHOT_AT = "2026-07-31T16:00:00-04:00";
export const MARKETS_PRIOR_SESSION = "2026-07-30";

// July's regular-session closes, oldest first. This remains a dated,
// read-only record alongside the snapshot rather than a live market feed.
export const CLOSES_30D = {
    VTI: [369.27, 368.76, 371.67, 369.61, 368.25, 371.45, 372.69, 369.78, 371.16, 372.42, 370.58, 367.01, 366.25, 369.45, 368.87, 364.69, 364.8, 365.18, 365.99, 360.42, 366.27, 368.21],
    VEA: [70.36, 70.81, 71.89, 70.78, 70.34, 70.73, 70.99, 69.76, 70.6, 70.82, 70.03, 69.7, 69.23, 70.47, 70.49, 69.78, 69.71, 70, 69.6, 68.95, 71.09, 70.62],
    VWO: [59.22, 59.04, 60.07, 58.88, 59.17, 59.49, 59.89, 58.79, 59.08, 59.48, 58.84, 57.84, 57.93, 58.86, 58.81, 58.1, 57.8, 58.23, 57.74, 56.92, 58.19, 58.75],
    BND: [73.06, 73.11, 73.14, 72.85, 72.7, 72.83, 72.77, 72.5, 72.7, 72.82, 72.81, 72.86, 72.68, 72.515, 72.4, 72.25, 72.31, 72.46, 72.64, 72.38, 72.42, 72.23],
    AAPL: [294.38, 308.63, 312.66, 310.66, 313.39, 316.22, 315.32, 317.31, 314.86, 327.5, 333.26, 333.74, 326.59, 327.74, 325.89, 321.66, 333.02, 336.91, 340.08, 338.19, 333.43, 308.91],
    AMZN: [241.7, 242.67, 244.16, 245.98, 243.62, 247.04, 245.34, 247.31, 247.49, 254.96, 249.89, 247.23, 249.99, 247.55, 244.85, 233.66, 232.11, 231.39, 230.86, 226.65, 235.5, 271.58],
    GOOGL: [361.21, 359.91, 366.46, 367.03, 361.92, 358.89, 357.18, 352.51, 359.51, 370.92, 354.46, 346.77, 351.99, 347.15, 342.09, 317.69, 319.74, 326.56, 333.71, 336.71, 333.66, 356.13],
    A: [133.39, 130.69, 130.6, 131.14, 129.07, 133.59, 134.29, 134.04, 135.2, 134.71, 136.1, 131.46, 130.26, 132.86, 133.46, 139.74, 138.57, 137.89, 140.54, 140.3, 138.71, 138.37],
};

export const CLOSES_30D_RANGE = "2026-07-01 to 2026-07-31 (22 regular sessions)";

// All-time closing trades across every account. Zero means there is no realized
// gain or loss to carry onto a return — relevant because the aid and tax work
// downstream cares about the AGI line.
export const REALIZED_TRADES_ALL_TIME = 0;

export const accounts = [
    {
        id: "brokerage",
        label: "Brokerage",
        short: "Broker",
        kind: "taxable",
        cash: 25,
        crypto: 5.554,
        pendingDeposits: 49,
        note: "Individual taxable account, margin enabled, options level 2 switched on. No options position is open and no margin is drawn.",
    },
    {
        id: "roth",
        label: "Roth IRA",
        short: "Roth",
        kind: "retirement",
        cash: 0.6,
        crypto: 0,
        pendingDeposits: 20,
        note: "Roth contributions need earned income for the year and come out again tax-free and penalty-free at any time. Growth does not.",
    },
    {
        id: "agentic",
        label: "Agentic cash",
        short: "Agentic",
        kind: "taxable",
        cash: 5,
        crypto: 0,
        pendingDeposits: 0,
        note: "Cash account flagged for agent access at the broker. TwinPath still only reads it — the flag is the broker's, the restraint is ours.",
    },
];

// sleeve ids are defined once in SLEEVES below so the mix chart and the holding
// rows can never drift apart.
export const SLEEVES = [
    { id: "us", label: "US total market", tone: "us" },
    { id: "intl", label: "Developed international", tone: "intl" },
    { id: "em", label: "Emerging markets", tone: "em" },
    { id: "bond", label: "Bonds", tone: "bond" },
    { id: "single", label: "Single companies", tone: "single" },
];

export const holdings = [
    {
        id: "brokerage-vti",
        accountId: "brokerage",
        symbol: "VTI",
        name: "Vanguard Total Stock Market ETF",
        kind: "fund",
        sleeve: "us",
        quantity: 0.020534,
        avgCost: 367.68,
        price: 368.22,
        previousClose: 366.27,
    },
    {
        id: "brokerage-vea",
        accountId: "brokerage",
        symbol: "VEA",
        name: "Vanguard FTSE Developed Markets ETF",
        kind: "fund",
        sleeve: "intl",
        quantity: 0.022285,
        avgCost: 70.45,
        price: 70.63,
        previousClose: 71.09,
    },
    {
        id: "brokerage-vwo",
        accountId: "brokerage",
        symbol: "VWO",
        name: "Vanguard FTSE Emerging Markets ETF",
        kind: "fund",
        sleeve: "em",
        quantity: 0.02623,
        avgCost: 58.33,
        price: 58.755,
        previousClose: 58.19,
    },
    {
        id: "brokerage-bnd",
        accountId: "brokerage",
        symbol: "BND",
        name: "Vanguard Total Bond Market ETF",
        kind: "fund",
        sleeve: "bond",
        quantity: 0.12909,
        avgCost: 72.43,
        price: 72.245,
        previousClose: 72.42,
    },
    {
        id: "brokerage-aapl",
        accountId: "brokerage",
        symbol: "AAPL",
        name: "Apple",
        kind: "company",
        sleeve: "single",
        quantity: 0.015129,
        avgCost: 333.8,
        price: 309.03,
        previousClose: 333.43,
        locked: "Held as a stock grant — the broker shows zero shares available to sell until it releases.",
    },
    {
        id: "roth-aapl",
        accountId: "roth",
        symbol: "AAPL",
        name: "Apple",
        kind: "company",
        sleeve: "single",
        quantity: 0.014925,
        avgCost: 335.01,
        price: 309.03,
        previousClose: 333.43,
    },
    {
        id: "roth-amzn",
        accountId: "roth",
        symbol: "AMZN",
        name: "Amazon.com",
        kind: "company",
        sleeve: "single",
        quantity: 0.02122,
        avgCost: 235.63,
        price: 271.57,
        previousClose: 235.5,
    },
    {
        id: "roth-googl",
        accountId: "roth",
        symbol: "GOOGL",
        name: "Alphabet Class A",
        kind: "company",
        sleeve: "single",
        quantity: 0.015346,
        avgCost: 325.82,
        price: 356.33,
        previousClose: 333.66,
    },
    {
        id: "roth-a",
        accountId: "roth",
        symbol: "A",
        name: "Agilent Technologies",
        kind: "company",
        sleeve: "single",
        quantity: 0.036339,
        avgCost: 137.59,
        price: 138.39,
        previousClose: 138.71,
    },
];

const CENT = 0.005;

export function accountById(id) {
    return accounts.find((account) => account.id === id) || null;
}

export function holdingsFor(accountId) {
    if (!accountId || accountId === "all") return holdings.slice();
    return holdings.filter((holding) => holding.accountId === accountId);
}

export function marketValue(holding) {
    return holding.quantity * holding.price;
}

export function costBasis(holding) {
    return holding.quantity * holding.avgCost;
}

export function unrealized(holding) {
    return marketValue(holding) - costBasis(holding);
}

export function unrealizedPct(holding) {
    const cost = costBasis(holding);
    if (cost <= 0) return 0;
    return unrealized(holding) / cost;
}

export function dayChange(holding) {
    return holding.quantity * (holding.price - holding.previousClose);
}

export function trend(amount) {
    if (Math.abs(amount) < CENT) return "flat";
    return amount > 0 ? "up" : "down";
}

function sum(list, read) {
    return list.reduce((total, item) => total + read(item), 0);
}

function scopedAccounts(accountId) {
    if (!accountId || accountId === "all") return accounts.slice();
    const account = accountById(accountId);
    return account ? [account] : [];
}

export function totals(accountId) {
    const list = holdingsFor(accountId);
    const scope = scopedAccounts(accountId);
    const invested = sum(list, marketValue);
    const cost = sum(list, costBasis);
    const cash = sum(scope, (account) => account.cash);
    const crypto = sum(scope, (account) => account.crypto);
    const gain = invested - cost;
    return {
        invested,
        cost,
        cash,
        crypto,
        gain,
        gainPct: cost > 0 ? gain / cost : 0,
        day: sum(list, dayChange),
        pending: sum(scope, (account) => account.pendingDeposits),
        total: invested + cash + crypto,
    };
}

/**
 * How the money is actually spread. Descriptive only — this says what is there,
 * never what ought to be.
 */
export function mixRows(accountId) {
    const list = holdingsFor(accountId);
    const scope = scopedAccounts(accountId);
    const rows = SLEEVES.map((sleeve) => ({
        id: sleeve.id,
        label: sleeve.label,
        tone: sleeve.tone,
        value: sum(
            list.filter((holding) => holding.sleeve === sleeve.id),
            marketValue,
        ),
    }));
    rows.push({
        id: "crypto",
        label: "Crypto",
        tone: "crypto",
        value: sum(scope, (account) => account.crypto),
    });
    rows.push({
        id: "cash",
        label: "Cash",
        tone: "cash",
        value: sum(scope, (account) => account.cash),
    });
    const total = sum(rows, (row) => row.value);
    return rows
        .filter((row) => row.value >= CENT)
        .map((row) => ({ ...row, share: total > 0 ? row.value / total : 0 }))
        .sort((a, b) => b.value - a.value);
}

export function formatMoney(amount) {
    const value = Number.isFinite(amount) ? amount : 0;
    const magnitude = Math.abs(value);
    const digits = magnitude > 0 && magnitude < 1000 ? 2 : 0;
    return value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

export function formatSigned(amount) {
    const value = Number.isFinite(amount) ? amount : 0;
    if (Math.abs(value) < CENT) return "flat";
    const sign = value > 0 ? "+" : "−";
    return `${sign}${formatMoney(Math.abs(value))}`;
}

export function formatPct(fraction) {
    const value = Number.isFinite(fraction) ? fraction : 0;
    if (Math.abs(value) < 0.00005) return "0.00%";
    const sign = value > 0 ? "+" : "−";
    return `${sign}${(Math.abs(value) * 100).toFixed(2)}%`;
}

export function formatQuantity(quantity) {
    return quantity.toLocaleString("en-US", {
        minimumFractionDigits: 6,
        maximumFractionDigits: 6,
    });
}

export function snapshotLabel(iso = MARKETS_SNAPSHOT_AT) {
    const stamp = new Date(iso);
    if (Number.isNaN(stamp.getTime())) return "an unknown time";
    return stamp.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
    });
}

export function closesFor(symbol) {
    return CLOSES_30D[symbol] || null;
}

/** "Friday", derived from the snapshot stamp so body copy never prints ISO dates. */
export function sessionDayName(iso = MARKETS_SNAPSHOT_AT) {
    const stamp = new Date(iso);
    if (Number.isNaN(stamp.getTime())) return "the last session";
    return stamp.toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: "America/New_York",
    });
}

/** Share-price move for the session as a fraction, e.g. -0.074 for AAPL 7/31. */
export function sessionMovePct(holding) {
    if (!holding.previousClose) return 0;
    return holding.price / holding.previousClose - 1;
}

/** A session move of 5%+ in the share price is flagged as a big move — a fixed,
 *  factual threshold. The chip states the size; it draws no conclusion. */
export const BIG_MOVE_THRESHOLD = 0.05;

export function isBigMove(holding) {
    return Math.abs(sessionMovePct(holding)) >= BIG_MOVE_THRESHOLD;
}

/**
 * One plain sentence per holding, generated from observed numbers only.
 * Describes; never advises. The test suite asserts this function cannot emit
 * advice-shaped words no matter which branch runs.
 */
export function plainSummary(holding) {
    const value = formatMoney(marketValue(holding));
    const day = dayChange(holding);
    const gain = unrealized(holding);
    const dayName = sessionDayName();
    const dayPart =
        trend(day) === "flat"
            ? `It barely moved on ${dayName}`
            : `It moved ${trend(day) === "up" ? "up" : "down"} ${formatMoney(Math.abs(day))} on ${dayName}`;
    const gainPart =
        trend(gain) === "flat"
            ? "and overall it sits right where it started"
            : `and overall it is ${trend(gain) === "up" ? "up" : "down"} ${formatMoney(Math.abs(gain))} since the first purchase`;
    return `Your slice of ${holding.name} is worth ${value}. ${dayPart}, ${gainPart}.`;
}
