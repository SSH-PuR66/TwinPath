import test from "node:test";
import assert from "node:assert/strict";

import {
  detectColumns,
  normalizeRows,
  parseAmount,
  parseCsv,
  parseDate,
} from "../src/imports.js";

test("parseCsv handles quotes, commas, and CRLF", () => {
  const rows = parseCsv('Date,Description,Amount\r\n07/01/2026,"Coffee, twice",-8.50\r\n');
  assert.deepEqual(rows, [
    ["Date", "Description", "Amount"],
    ["07/01/2026", "Coffee, twice", "-8.50"],
  ]);
});

test("column detection finds common bank headers", () => {
  const columns = detectColumns(["Posted Date", "Payee", "Withdrawal", "Deposit"]);
  assert.equal(columns.date, 0);
  assert.equal(columns.description, 1);
  assert.equal(columns.debit, 2);
  assert.equal(columns.credit, 3);
  assert.equal(columns.amount, -1);
});

test("column detection rejects unusable files", () => {
  assert.throws(
    () => detectColumns(["Foo", "Bar"]),
    /CSV needs a date column/,
  );
});

test("amount parsing covers bank formats", () => {
  assert.equal(parseAmount("-8.50"), -8.5);
  assert.equal(parseAmount("(1,234.56)"), -1234.56);
  assert.equal(parseAmount("$2,000.00"), 2000);
  assert.equal(parseAmount("+15"), 15);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("1.2.3"), null);
});

test("date parsing accepts ISO and US formats", () => {
  assert.equal(parseDate("2026-07-01"), "2026-07-01");
  assert.equal(parseDate("7/1/2026"), "2026-07-01");
  assert.equal(parseDate("07/01/26"), "2026-07-01");
  assert.equal(parseDate("July first"), null);
});

test("normalizeRows maps signs to kinds and skips bad lines", () => {
  const rows = [
    ["Date", "Description", "Amount", "Category"],
    ["2026-07-01", "Paycheck", "500.00", "Income"],
    ["2026-07-02", "Groceries", "-82.19", "Food"],
    ["bad-date", "Broken", "-1.00", ""],
  ];
  const columns = detectColumns(rows[0]);
  const { normalized, skipped } = normalizeRows(rows, columns);
  assert.equal(normalized.length, 2);
  assert.deepEqual(skipped, [4]);
  assert.equal(normalized[0].kind, "income");
  assert.equal(normalized[0].amount, 500);
  assert.equal(normalized[1].kind, "expense");
  assert.equal(normalized[1].amount, 82.19);
  assert.equal(normalized[1].category, "Food");
});

test("debit/credit columns produce signed amounts", () => {
  const rows = [
    ["Posted Date", "Payee", "Withdrawal", "Deposit"],
    ["07/03/2026", "Rent", "1200.00", ""],
    ["07/05/2026", "Refund", "", "40.00"],
  ];
  const columns = detectColumns(rows[0]);
  const { normalized } = normalizeRows(rows, columns);
  assert.equal(normalized[0].kind, "expense");
  assert.equal(normalized[0].amount, 1200);
  assert.equal(normalized[1].kind, "income");
  assert.equal(normalized[1].amount, 40);
});

test("invert flips statement polarity", () => {
  const rows = [
    ["Date", "Description", "Amount"],
    ["2026-07-01", "Card payment shown positive", "82.19"],
  ];
  const { normalized } = normalizeRows(rows, detectColumns(rows[0]), { invert: true });
  assert.equal(normalized[0].kind, "expense");
});
