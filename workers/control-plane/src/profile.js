import { HttpError } from "./http.js";
import { selectRows, upsertRows } from "./supabase.js";

const MAX_PROFILE_BYTES = 16 * 1024;

// Keys that suggest government identifiers or credentials. The vault
// refuses them by design: forms get those values from a human hand only.
const FORBIDDEN_KEY_PATTERN = /(ssn|social.?security|passport|driver.?s?.?license|license.?number|itin|ein|tax.?id|password|secret|pin\b|routing|account.?number|card.?number|cvv)/i;

export function findForbiddenKeys(value, path = "", found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findForbiddenKeys(item, `${path}[${index}]`, found));
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const keyPath = path ? `${path}.${key}` : key;
      if (FORBIDDEN_KEY_PATTERN.test(key)) found.push(keyPath);
      findForbiddenKeys(child, keyPath, found);
    }
  }
  return found;
}

export function validateProfile(profile) {
  if (typeof profile !== "object" || profile === null || Array.isArray(profile)) {
    throw new HttpError(400, "invalid_profile", "profile must be an object");
  }
  const serialized = JSON.stringify(profile);
  if (serialized.length > MAX_PROFILE_BYTES) {
    throw new HttpError(400, "profile_too_large", "profile must be at most 16 KB");
  }
  const forbidden = findForbiddenKeys(profile);
  if (forbidden.length > 0) {
    throw new HttpError(
      400,
      "sensitive_fields_rejected",
      `These fields are not allowed in the vault (government IDs and credentials stay with you): ${forbidden.slice(0, 5).join(", ")}`,
    );
  }
  return JSON.parse(serialized);
}

export async function getProfile(env, auth) {
  const rows = await selectRows(
    env,
    "household_profiles",
    new URLSearchParams({
      select: "profile,updated_at",
      household_id: `eq.${auth.household.id}`,
      limit: "1",
    }).toString(),
  );
  return rows[0] || { profile: {}, updated_at: null };
}

export async function putProfile(env, auth, body) {
  const profile = validateProfile(body.profile);
  const rows = await upsertRows(
    env,
    "household_profiles",
    [{
      household_id: auth.household.id,
      profile,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    }],
    "household_id",
  );
  return rows[0];
}
