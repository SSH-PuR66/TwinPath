import { HttpError } from "./http.js";
import { deleteRows, insertRow, selectRows, updateRows } from "./supabase.js";

const ACCOUNT_TYPES = new Set(["roth_ira", "traditional_ira", "custodial_roth_ira", "other"]);
const VISIBILITIES = new Set(["household", "private"]);
const FIELDS = "id,nickname,institution,account_type,tax_year,current_value,contributions_ytd,earned_income_ytd,visibility,updated_at,created_at";

function amount(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 9_999_999_999.99) {
    throw new HttpError(400, "invalid_retirement_amount", `${field} must be a non-negative amount`);
  }
  return Math.round(parsed * 100) / 100;
}

function text(value, field, max, required = false) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new HttpError(400, "invalid_retirement_account", `${field} is required`);
    return null;
  }
  if (typeof value !== "string" || value.trim().length > max) {
    throw new HttpError(400, "invalid_retirement_account", `${field} must be at most ${max} characters`);
  }
  return value.trim();
}

function validated(body, partial = false) {
  const output = {};
  if (!partial || body.nickname !== undefined) output.nickname = text(body.nickname, "nickname", 80, !partial);
  if (!partial || body.institution !== undefined) output.institution = text(body.institution, "institution", 120);
  if (!partial || body.account_type !== undefined) {
    if (!ACCOUNT_TYPES.has(body.account_type)) throw new HttpError(400, "invalid_retirement_account", "account_type is invalid");
    output.account_type = body.account_type;
  }
  if (!partial || body.tax_year !== undefined) {
    const year = Number(body.tax_year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new HttpError(400, "invalid_retirement_account", "tax_year is invalid");
    output.tax_year = year;
  }
  for (const field of ["current_value", "contributions_ytd", "earned_income_ytd"]) {
    if (!partial || body[field] !== undefined) output[field] = amount(body[field], field);
  }
  if (!partial || body.visibility !== undefined) {
    const visibility = body.visibility ?? "household";
    if (!VISIBILITIES.has(visibility)) throw new HttpError(400, "invalid_retirement_account", "visibility is invalid");
    output.visibility = visibility;
  }
  return output;
}

function visibleFilter(auth) {
  return `and=(household_id.eq.${encodeURIComponent(auth.household.id)},or(visibility.eq.household,profile_id.eq.${encodeURIComponent(auth.user.id)}))`;
}

export async function listRetirementAccounts(env, auth) {
  return selectRows(env, "retirement_accounts", `select=${FIELDS}&${visibleFilter(auth)}&order=updated_at.desc&limit=20`);
}

export async function createRetirementAccount(env, auth, body) {
  return insertRow(env, "retirement_accounts", {
    ...validated(body),
    household_id: auth.household.id,
    profile_id: auth.user.id,
  });
}

export async function updateRetirementAccount(env, auth, body) {
  if (typeof body.id !== "string" || !body.id) throw new HttpError(400, "invalid_retirement_account", "id is required");
  const changes = validated(body, true);
  if (!Object.keys(changes).length) throw new HttpError(400, "invalid_retirement_account", "no changes supplied");
  const rows = await updateRows(env, "retirement_accounts", `id=eq.${encodeURIComponent(body.id)}&household_id=eq.${encodeURIComponent(auth.household.id)}&profile_id=eq.${encodeURIComponent(auth.user.id)}`, changes);
  if (rows.length !== 1) throw new HttpError(404, "retirement_account_not_found", "Retirement account was not found");
  return rows[0];
}

export async function removeRetirementAccount(env, auth, accountId) {
  if (typeof accountId !== "string" || !accountId) throw new HttpError(400, "invalid_retirement_account", "id is required");
  const rows = await deleteRows(env, "retirement_accounts", `id=eq.${encodeURIComponent(accountId)}&household_id=eq.${encodeURIComponent(auth.household.id)}&profile_id=eq.${encodeURIComponent(auth.user.id)}`);
  if (rows.length !== 1) throw new HttpError(404, "retirement_account_not_found", "Retirement account was not found");
  return rows[0];
}
