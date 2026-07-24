import { HttpError } from "./http.js";
import { selectRows, upsertRows } from "./supabase.js";

const MAX_CSV_BYTES = 512 * 1024;
const MAX_ROWS = 2000;
const SOURCE_LABEL_PATTERN = /^[a-z0-9][a-z0-9._-]{0,40}$/;

const DATE_HEADERS = ["date", "transaction date", "posted date", "post date", "datetime"];
const DESCRIPTION_HEADERS = ["description", "memo", "payee", "name", "details", "merchant"];
const AMOUNT_HEADERS = ["amount", "transaction amount", "value"];
const DEBIT_HEADERS = ["debit", "withdrawal", "withdrawals", "money out"];
const CREDIT_HEADERS = ["credit", "deposit", "deposits", "money in"];
const CATEGORY_HEADERS = ["category", "type"];

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function findColumn(headers, candidates) {
  const normalized = headers.map((header) => header.trim().toLowerCase());
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index !== -1) return index;
  }
  return -1;
}

export function detectColumns(headers) {
  const date = findColumn(headers, DATE_HEADERS);
  const description = findColumn(headers, DESCRIPTION_HEADERS);
  const amount = findColumn(headers, AMOUNT_HEADERS);
  const debit = findColumn(headers, DEBIT_HEADERS);
  const credit = findColumn(headers, CREDIT_HEADERS);
  const category = findColumn(headers, CATEGORY_HEADERS);
  if (date === -1 || description === -1 || (amount === -1 && debit === -1 && credit === -1)) {
    throw new HttpError(
      400,
      "unrecognized_csv",
      "CSV needs a date column, a description/memo column, and an amount (or debit/credit) column",
    );
  }
  return { date, description, amount, debit, credit, category };
}

export function parseAmount(raw) {
  if (typeof raw !== "string") return null;
  let value = raw.trim();
  if (!value) return null;
  let negative = false;
  if (value.startsWith("(") && value.endsWith(")")) {
    negative = true;
    value = value.slice(1, -1);
  }
  value = value.replace(/[$,\s]/g, "");
  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }
  if (!/^\d+(\.\d{1,4})?$/.test(value)) return null;
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount)) return null;
  return negative ? -amount : amount;
}

export function parseDate(raw) {
  if (typeof raw !== "string") return null;
  const value = raw.trim().slice(0, 20);
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    return `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }
  match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (match) {
    return `20${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }
  return null;
}

export function normalizeRows(rows, columns, options = {}) {
  const invert = Boolean(options.invert);
  const normalized = [];
  const skipped = [];
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i];
    const date = parseDate(cells[columns.date] ?? "");
    const description = String(cells[columns.description] ?? "").trim().slice(0, 180);
    let amount = null;
    if (columns.amount !== -1) {
      amount = parseAmount(cells[columns.amount] ?? "");
    } else {
      const debit = columns.debit !== -1 ? parseAmount(cells[columns.debit] ?? "") : null;
      const credit = columns.credit !== -1 ? parseAmount(cells[columns.credit] ?? "") : null;
      if (debit !== null && debit !== 0) amount = -Math.abs(debit);
      else if (credit !== null && credit !== 0) amount = Math.abs(credit);
    }
    if (!date || !description || amount === null || amount === 0) {
      skipped.push(i + 1);
      continue;
    }
    if (invert) amount = -amount;
    const category = columns.category !== -1
      ? String(cells[columns.category] ?? "").trim().slice(0, 60) || null
      : null;
    normalized.push({
      transaction_date: date,
      description,
      category,
      kind: amount < 0 ? "expense" : "income",
      amount: Math.round(Math.abs(amount) * 100) / 100,
    });
  }
  return { normalized, skipped };
}

async function rowHash(row, occurrence) {
  const material = `${row.transaction_date}|${row.description}|${row.kind}|${row.amount}|${occurrence}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function importCsvTransactions(env, auth, body) {
  const csv = body.csv;
  if (typeof csv !== "string" || !csv.trim()) {
    throw new HttpError(400, "invalid_csv", "csv text is required");
  }
  if (csv.length > MAX_CSV_BYTES) {
    throw new HttpError(400, "csv_too_large", "CSV must be at most 512 KB");
  }
  let sourceLabel = "import";
  if (body.source_label !== undefined && body.source_label !== null) {
    if (typeof body.source_label !== "string" || !SOURCE_LABEL_PATTERN.test(body.source_label)) {
      throw new HttpError(
        400,
        "invalid_source_label",
        "source_label must be 1-41 chars: lowercase letters, digits, dot, dash, underscore",
      );
    }
    sourceLabel = body.source_label;
  }

  const rows = parseCsv(csv);
  if (rows.length < 2) {
    throw new HttpError(400, "invalid_csv", "CSV needs a header row and at least one data row");
  }
  if (rows.length - 1 > MAX_ROWS) {
    throw new HttpError(400, "csv_too_large", `CSV must have at most ${MAX_ROWS} data rows`);
  }

  const columns = detectColumns(rows[0]);
  const { normalized, skipped } = normalizeRows(rows, columns, {
    invert: Boolean(body.invert),
  });
  if (normalized.length === 0) {
    throw new HttpError(400, "no_valid_rows", "No rows had a valid date, description, and amount");
  }

  const externalSource = `csv.${sourceLabel}`;
  const occurrences = new Map();
  const records = [];
  for (const row of normalized) {
    const key = `${row.transaction_date}|${row.description}|${row.kind}|${row.amount}`;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    records.push({
      household_id: auth.household.id,
      owner_user_id: auth.user.id,
      visibility: "shared",
      title: row.description.slice(0, 120),
      description: row.description,
      category: row.category,
      kind: row.kind,
      amount: row.amount,
      transaction_date: row.transaction_date,
      external_source: externalSource,
      external_id: await rowHash(row, occurrence),
    });
  }

  const saved = await upsertRows(
    env,
    "transactions",
    records,
    "household_id,external_source,external_id",
  );

  return {
    imported: Array.isArray(saved) ? saved.length : records.length,
    submitted: records.length,
    skipped_lines: skipped,
    source: externalSource,
  };
}

export async function financialSummary(env, auth) {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const params = new URLSearchParams({
    select: "kind,amount,category,transaction_date",
    household_id: `eq.${auth.household.id}`,
    transaction_date: `gte.${since}`,
    order: "transaction_date.desc",
    limit: "5000",
  });
  // Unified ledger (manual + CSV imports).
  const ledgerRows = await selectRows(env, "transactions", params.toString());

  // Plaid-synced transactions live in their own table with Plaid's sign
  // convention (positive amount = money OUT). Normalize into the same
  // income/expense shape so the Money view reflects connected banks too.
  let plaidRows = [];
  try {
    const plaidParams = new URLSearchParams({
      select: "amount,name,merchant_name,posted_date,authorized_date,pending",
      household_id: `eq.${auth.household.id}`,
      order: "posted_date.desc",
      limit: "5000",
    });
    plaidRows = await selectRows(env, "plaid_transactions", plaidParams.toString());
  } catch {
    plaidRows = [];
  }

  const normalized = [
    ...ledgerRows.map((row) => ({
      kind: row.kind,
      amount: Number(row.amount) || 0,
      category: row.category,
      date: row.transaction_date,
    })),
    ...plaidRows
      .filter((row) => !row.pending)
      .map((row) => {
        const raw = Number(row.amount) || 0;
        return {
          kind: raw > 0 ? "expense" : "income",
          amount: Math.abs(raw),
          category: row.merchant_name || row.name || "bank",
          date: String(row.posted_date || row.authorized_date || "").slice(0, 10),
        };
      })
      .filter((row) => row.date >= since),
  ];

  let income = 0;
  let expense = 0;
  const byCategory = new Map();
  const byMonth = new Map();
  for (const row of normalized) {
    const amount = row.amount;
    const month = String(row.date || "").slice(0, 7);
    const monthEntry = byMonth.get(month) || { income: 0, expense: 0 };
    if (row.kind === "income") {
      income += amount;
      monthEntry.income += amount;
    } else {
      expense += amount;
      monthEntry.expense += amount;
      const category = row.category || "uncategorized";
      byCategory.set(category, (byCategory.get(category) || 0) + amount);
    }
    if (month) byMonth.set(month, monthEntry);
  }
  const rows = normalized;

  const round = (value) => Math.round(value * 100) / 100;
  return {
    window_days: 90,
    since,
    transaction_count: rows.length,
    income: round(income),
    expense: round(expense),
    net: round(income - expense),
    top_expense_categories: [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, total]) => ({ category, total: round(total) })),
    by_month: [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, totals]) => ({
        month,
        income: round(totals.income),
        expense: round(totals.expense),
        net: round(totals.income - totals.expense),
      })),
  };
}
