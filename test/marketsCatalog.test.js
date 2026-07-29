import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MARKETS_PRIOR_SESSION,
  MARKETS_SNAPSHOT_AT,
  REALIZED_TRADES_ALL_TIME,
  SLEEVES,
  accountById,
  accounts,
  costBasis,
  dayChange,
  formatMoney,
  formatPct,
  formatQuantity,
  formatSigned,
  holdings,
  holdingsFor,
  marketValue,
  mixRows,
  snapshotLabel,
  totals,
  trend,
  unrealized,
  unrealizedPct,
} from "../src/marketsCatalog.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(here, "..", "src", "marketsCatalog.js");
const componentPath = path.join(here, "..", "src", "MarketsDesk.jsx");

// The exact shape a holding is allowed to have. A holding describes something
// already owned. It is not an instruction to a broker, so there is no side, no
// limit price, and no quantity-to-transact.
const ALLOWED_HOLDING_KEYS = new Set([
  "id",
  "accountId",
  "symbol",
  "name",
  "kind",
  "sleeve",
  "quantity",
  "avgCost",
  "price",
  "previousClose",
  "locked",
]);

const ALLOWED_ACCOUNT_KEYS = new Set([
  "id",
  "label",
  "short",
  "kind",
  "cash",
  "crypto",
  "pendingDeposits",
  "note",
]);

// Substring match, deliberately broad. A false positive costs one rename; a
// false negative puts a brokerage account number in a git history.
const FORBIDDEN_KEY_FRAGMENTS = [
  "ssn",
  "dob",
  "number",
  "acctnum",
  "routing",
  "card",
  "mask",
  "lastfour",
  "last4",
  "token",
  "password",
  "secret",
];

// The load-bearing rule. If any of these ever appear as a live identifier in
// the catalog or the component, somebody has started building a write path and
// this test is the thing that stops the build. Checked against code only —
// comments and prose are stripped first, so the guard fires on what runs.
const WRITE_PATH_PATTERN =
  /\b(place|submit|buy|sell|order|ticket|side|limitPrice|stopPrice|execute|trade)\b/i;

/**
 * Strip comments and string/template literals so the pattern above tests what
 * the file actually does, not what it says about itself. Block comments first
 * (they contain apostrophes), then line comments, then double, backtick and
 * single quotes in that order.
 */
function codeOnly(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
}

function keysOf(object) {
  return Object.keys(object);
}

test("no holding or account key smells like stored personal data", () => {
  for (const record of [...holdings, ...accounts]) {
    for (const key of keysOf(record)) {
      const lowered = key.toLowerCase();
      for (const fragment of FORBIDDEN_KEY_FRAGMENTS) {
        assert.ok(
          !lowered.includes(fragment),
          `key "${key}" contains forbidden fragment "${fragment}"`,
        );
      }
    }
  }
});

test("holdings carry only the fields a read-only view needs", () => {
  for (const holding of holdings) {
    for (const key of keysOf(holding)) {
      assert.ok(
        ALLOWED_HOLDING_KEYS.has(key),
        `holding ${holding.id} has unexpected key "${key}"`,
      );
    }
  }
});

test("accounts carry only the fields a read-only view needs", () => {
  for (const account of accounts) {
    for (const key of keysOf(account)) {
      assert.ok(
        ALLOWED_ACCOUNT_KEYS.has(key),
        `account ${account.id} has unexpected key "${key}"`,
      );
    }
  }
});

test("no account identifier appears anywhere in the catalog", () => {
  const source = fs.readFileSync(catalogPath, "utf8");
  // Brokerage account numbers are nine digits. Any run of eight or more digits
  // in this file is either an account number or a mistake. Neither belongs.
  const runs = source.match(/\d{8,}/g) || [];
  assert.deepEqual(runs, [], `long digit runs found: ${runs.join(", ")}`);

  for (const account of accounts) {
    assert.ok(
      /^[a-z]+$/.test(account.id),
      `account id "${account.id}" should name the job it does, not a number`,
    );
  }
});

test("the catalog contains no write path", () => {
  const code = codeOnly(fs.readFileSync(catalogPath, "utf8"));
  const match = code.match(WRITE_PATH_PATTERN);
  assert.equal(
    match,
    null,
    `write-shaped identifier "${match ? match[0] : ""}" found in marketsCatalog.js`,
  );
});

test("the desk component contains no write path", () => {
  const code = codeOnly(fs.readFileSync(componentPath, "utf8"));
  const match = code.match(WRITE_PATH_PATTERN);
  assert.equal(
    match,
    null,
    `write-shaped identifier "${match ? match[0] : ""}" found in MarketsDesk.jsx`,
  );
});

test("the desk component renders the snapshot rather than calling out", () => {
  const source = fs.readFileSync(componentPath, "utf8");
  assert.ok(
    !/fetch\s*\(|axios|XMLHttpRequest/.test(source),
    "MarketsDesk.jsx must render the dated snapshot, not call a live endpoint",
  );
});

test("every holding points at an account that exists", () => {
  for (const holding of holdings) {
    assert.ok(
      accountById(holding.accountId),
      `holding ${holding.id} references unknown account ${holding.accountId}`,
    );
  }
});

test("every holding sits in a declared sleeve", () => {
  const known = new Set(SLEEVES.map((sleeve) => sleeve.id));
  for (const holding of holdings) {
    assert.ok(
      known.has(holding.sleeve),
      `holding ${holding.id} has unknown sleeve ${holding.sleeve}`,
    );
  }
});

test("holding ids are unique", () => {
  const ids = holdings.map((holding) => holding.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate holding id");
});

test("every numeric field is a finite non-negative number", () => {
  for (const holding of holdings) {
    for (const field of ["quantity", "avgCost", "price", "previousClose"]) {
      const value = holding[field];
      assert.ok(
        Number.isFinite(value) && value >= 0,
        `holding ${holding.id} field ${field} is not a usable number`,
      );
    }
  }
  for (const account of accounts) {
    for (const field of ["cash", "crypto", "pendingDeposits"]) {
      const value = account[field];
      assert.ok(
        Number.isFinite(value) && value >= 0,
        `account ${account.id} field ${field} is not a usable number`,
      );
    }
  }
});

test("holdingsFor scopes correctly and 'all' returns everything", () => {
  assert.equal(holdingsFor("all").length, holdings.length);
  assert.equal(holdingsFor().length, holdings.length);
  assert.equal(holdingsFor("agentic").length, 0);
  for (const account of accounts) {
    for (const holding of holdingsFor(account.id)) {
      assert.equal(holding.accountId, account.id);
    }
  }
});

test("per-holding math agrees with itself", () => {
  for (const holding of holdings) {
    const value = marketValue(holding);
    const cost = costBasis(holding);
    assert.ok(Math.abs(value - holding.quantity * holding.price) < 1e-9);
    assert.ok(Math.abs(cost - holding.quantity * holding.avgCost) < 1e-9);
    assert.ok(Math.abs(unrealized(holding) - (value - cost)) < 1e-9);
    if (cost > 0) {
      assert.ok(Math.abs(unrealizedPct(holding) - (value - cost) / cost) < 1e-9);
    }
    assert.ok(
      Math.abs(
        dayChange(holding) -
          holding.quantity * (holding.price - holding.previousClose),
      ) < 1e-9,
    );
  }
});

test("account totals sum to the all-accounts total", () => {
  const all = totals("all");
  const summed = accounts.reduce(
    (running, account) => {
      const scoped = totals(account.id);
      return {
        invested: running.invested + scoped.invested,
        cash: running.cash + scoped.cash,
        crypto: running.crypto + scoped.crypto,
        total: running.total + scoped.total,
      };
    },
    { invested: 0, cash: 0, crypto: 0, total: 0 },
  );
  assert.ok(Math.abs(all.invested - summed.invested) < 1e-9);
  assert.ok(Math.abs(all.cash - summed.cash) < 1e-9);
  assert.ok(Math.abs(all.crypto - summed.crypto) < 1e-9);
  assert.ok(Math.abs(all.total - summed.total) < 1e-9);
});

test("money in transit is never counted as money held", () => {
  const all = totals("all");
  assert.ok(all.pending > 0, "there are pending deposits to test against");
  assert.ok(
    Math.abs(all.total - (all.invested + all.cash + all.crypto)) < 1e-9,
    "pending deposits must stay out of the headline total",
  );
});

test("mixRows shares add to one and stay sorted by size", () => {
  for (const scope of ["all", ...accounts.map((account) => account.id)]) {
    const rows = mixRows(scope);
    if (rows.length === 0) continue;
    const sum = rows.reduce((running, row) => running + row.share, 0);
    assert.ok(
      Math.abs(sum - 1) < 1e-9,
      `mix shares for ${scope} add to ${sum}, not 1`,
    );
    for (const row of rows) {
      assert.ok(row.share >= 0 && row.share <= 1);
      assert.ok(typeof row.label === "string" && row.label.length > 0);
    }
    const descending = rows.every(
      (row, index) => index === 0 || rows[index - 1].value >= row.value,
    );
    assert.ok(descending, `mix rows for ${scope} are not sorted by size`);
  }
});

test("every mix row id has a literal fill class in the component", () => {
  const source = fs.readFileSync(componentPath, "utf8");
  const ids = new Set();
  for (const scope of ["all", ...accounts.map((account) => account.id)]) {
    for (const row of mixRows(scope)) ids.add(row.id);
  }
  assert.ok(ids.size > 0, "there is at least one mix row to check");
  for (const id of ids) {
    assert.ok(
      source.includes(`${id}: "markets-desk__mix-fill is-${id}"`),
      `mix row "${id}" has no literal fill class in MarketsDesk.jsx`,
    );
  }
});

test("trend classifies at the cent boundary", () => {
  assert.equal(trend(0), "flat");
  assert.equal(trend(0.004), "flat");
  assert.equal(trend(-0.004), "flat");
  assert.equal(trend(0.01), "up");
  assert.equal(trend(-0.01), "down");
});

test("formatters render signs and precision the way the screen expects", () => {
  assert.equal(formatMoney(0), "$0");
  assert.equal(formatMoney(25.5), "$25.50");
  assert.equal(formatMoney(1200), "$1,200");
  assert.equal(formatSigned(0), "flat");
  assert.equal(formatSigned(0.001), "flat");
  assert.equal(formatSigned(1.5), "+$1.50");
  assert.equal(formatSigned(-1.5), "−$1.50");
  assert.equal(formatPct(0), "0.00%");
  assert.equal(formatPct(0.0124), "+1.24%");
  assert.equal(formatPct(-0.0124), "−1.24%");
  assert.equal(formatQuantity(0.0205), "0.020500");
});

test("the snapshot is stamped, dated and parseable", () => {
  assert.ok(!Number.isNaN(new Date(MARKETS_SNAPSHOT_AT).getTime()));
  assert.match(MARKETS_PRIOR_SESSION, /^\d{4}-\d{2}-\d{2}$/);
  const label = snapshotLabel();
  assert.ok(label.length > 0 && label !== "an unknown time");
  assert.equal(snapshotLabel("not a date"), "an unknown time");
});

test("realized activity is a plain count, and today it is zero", () => {
  assert.ok(Number.isInteger(REALIZED_TRADES_ALL_TIME));
  assert.ok(REALIZED_TRADES_ALL_TIME >= 0);
  assert.equal(
    REALIZED_TRADES_ALL_TIME,
    0,
    "if this changes, the tax line in the stamp needs rewriting too",
  );
});

test("no note reads as a recommendation", () => {
  const advice =
    /\b(should buy|should sell|we recommend|recommend|you ought|target price|price target|rating|outperform|underperform|overweight|underweight)\b/i;
  for (const record of [...holdings, ...accounts]) {
    for (const value of Object.values(record)) {
      if (typeof value !== "string") continue;
      assert.equal(
        advice.test(value),
        false,
        `"${value}" reads as advice, and this desk is descriptive only`,
      );
    }
  }
});
