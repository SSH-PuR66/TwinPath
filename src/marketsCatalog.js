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

export const MARKETS_SNAPSHOT_AT = "2026-07-29T13:48:00-04:00";
export const MARKETS_PRIOR_SESSION = "2026-07-28";

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
        price: 363.285,
        previousClose: 365.99,
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
        price: 69.155,
        previousClose: 69.6,
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
        price: 57.2,
        previousClose: 57.74,
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
        price: 72.4747,
        previousClose: 72.64,
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
        price: 342.9776,
        previousClose: 340.08,
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
        price: 342.9776,
        previousClose: 340.08,
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
        price: 229.89,
        previousClose: 230.86,
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
        price: 336.31,
        previousClose: 333.71,
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
        price: 140.06,
        previousClose: 140.54,
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
