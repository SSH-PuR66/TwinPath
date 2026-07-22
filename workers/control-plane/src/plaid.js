import { decryptToken, encryptToken } from "./crypto.js";
import { assertObject, HttpError, readBytes, readJson } from "./http.js";
import {
  applyPlaidTransactions,
  claimProviderWebhook,
  disconnectPlaidItem,
  getPlaidItem,
  getPlaidItemById,
  getPlaidItemByItemId,
  getPlaidItems,
  listPlaidItemsForAutonomousSync,
  listPlaidAccounts,
  releaseProviderWebhook,
  savePlaidAccounts,
  savePlaidItemAccounts,
  savePlaidItem,
  updatePlaidCursor,
  writeProviderAudit,
} from "./provider-persistence-v15.js";
import { providerMode, requireProvider } from "./provider-mode.js";

const MAX_SYNC_PAGES = 20;
const DEFAULT_STALE_MINUTES = 30;

function autonomousPlaidSyncEnabled(env) {
  return providerMode(env) === "production"
    && String(env.PLAID_ENV || "").toLowerCase() === "production"
    && String(env.AUTONOMOUS_PLAID_SYNC || "").toLowerCase() === "true";
}

function staleMinutes(env) {
  const value = Number(env.PLAID_SYNC_STALE_MINUTES);
  return Number.isFinite(value) ? Math.max(15, Math.min(Math.floor(value), 24 * 60)) : DEFAULT_STALE_MINUTES;
}

function isStale(item, now, minutes) {
  const lastSynced = Date.parse(item.last_synced_at || "");
  return !Number.isFinite(lastSynced) || now - lastSynced >= minutes * 60_000;
}

function plaidBaseUrl(env) {
  return providerMode(env) === "production" && String(env.PLAID_ENV).toLowerCase() === "production"
    ? "https://production.plaid.com"
    : "https://sandbox.plaid.com";
}

async function plaidRequest(env, path, body) {
  requireProvider(env, "plaid");
  const response = await fetch(`${plaidBaseUrl(env)}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      client_id: env.PLAID_CLIENT_ID,
      secret: env.PLAID_SECRET,
      ...body,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new HttpError(502, "plaid_error", "Plaid request failed", {
      error_code: result?.error_code,
      request_id: result?.request_id,
    });
  }
  return result;
}

function tokenContext(ownerUserId, itemId) {
  return `plaid:${ownerUserId}:${itemId}`;
}

async function accessTokenFor(env, item) {
  return decryptToken(
    item.encrypted_access_token,
    env.TOKEN_ENCRYPTION_KEY,
    tokenContext(item.owner_user_id, item.item_id),
  );
}

async function syncItem(env, item) {
  const accessToken = await accessTokenFor(env, item);
  let cursor = item.cursor || null;
  const aggregate = { added: [], modified: [], removed: [] };
  for (let page = 0; page < MAX_SYNC_PAGES; page += 1) {
    const result = await plaidRequest(env, "/transactions/sync", {
      access_token: accessToken,
      ...(cursor ? { cursor } : {}),
      count: 100,
    });
    aggregate.added.push(...(result.added || []));
    aggregate.modified.push(...(result.modified || []));
    aggregate.removed.push(...(result.removed || []));
    cursor = result.next_cursor;
    if (!result.has_more) {
      const accountResult = await plaidRequest(env, "/accounts/get", { access_token: accessToken });
      await applyPlaidTransactions(env, item, aggregate);
      await savePlaidItemAccounts(env, item, accountResult.accounts || []);
      await updatePlaidCursor(env, item, cursor);
      return {
        added: aggregate.added.length,
        modified: aggregate.modified.length,
        removed: aggregate.removed.length,
      };
    }
  }
  throw new HttpError(502, "plaid_sync_limit", "Plaid transaction sync exceeded the page limit");
}

export async function syncAutonomousPlaidTransactions(env, now = Date.now()) {
  if (!autonomousPlaidSyncEnabled(env)) {
    return { enabled: false, inspected: 0, synced: 0, failed: 0 };
  }
  requireProvider(env, "plaid");
  const items = await listPlaidItemsForAutonomousSync(env);
  const eligible = items.filter((item) => isStale(item, now, staleMinutes(env)));
  let synced = 0;
  let failed = 0;
  for (const item of eligible) {
    try {
      await syncItem(env, item);
      await writeProviderAudit(env, {
        householdId: item.household_id,
        ownerUserId: item.owner_user_id,
        eventType: "plaid.autonomous_sync_completed",
      });
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { enabled: true, inspected: items.length, synced, failed };
}

export function isAutonomousPlaidSyncEnabled(env) {
  return autonomousPlaidSyncEnabled(env);
}

export async function createPlaidLinkToken(request, env, auth) {
  assertObject(await readJson(request, 8_192));
  const result = await plaidRequest(env, "/link/token/create", {
    user: { client_user_id: auth.user.id },
    client_name: "El Plan",
    products: ["transactions"],
    country_codes: ["US"],
    language: "en",
    ...(env.PLAID_WEBHOOK_URL ? { webhook: env.PLAID_WEBHOOK_URL } : {}),
    ...(env.PLAID_REDIRECT_URI ? { redirect_uri: env.PLAID_REDIRECT_URI } : {}),
  });
  await writeProviderAudit(env, {
    householdId: auth.household.id,
    ownerUserId: auth.user.id,
    eventType: "plaid.link_token_created",
  });
  return { link_token: result.link_token, expiration: result.expiration };
}

export async function exchangePlaidPublicToken(request, env, auth) {
  const body = assertObject(await readJson(request, 8_192));
  if (typeof body.public_token !== "string" || !body.public_token || body.public_token.length > 500) {
    throw new HttpError(400, "invalid_public_token", "A valid Plaid public_token is required");
  }
  const exchanged = await plaidRequest(env, "/item/public_token/exchange", {
    public_token: body.public_token,
  });
  const context = tokenContext(auth.user.id, exchanged.item_id);
  const encryptedAccessToken = await encryptToken(exchanged.access_token, env.TOKEN_ENCRYPTION_KEY, context);
  let item;
  try {
    item = await savePlaidItem(env, auth, {
      itemId: exchanged.item_id,
      encryptedAccessToken,
      environment: plaidBaseUrl(env).includes("production") ? "production" : "sandbox",
      institutionId: typeof body.institution_id === "string"
        ? body.institution_id.slice(0, 180)
        : null,
      institutionName: typeof body.institution_name === "string"
        ? body.institution_name.slice(0, 180)
        : null,
    });
  } catch (error) {
    await plaidRequest(env, "/item/remove", { access_token: exchanged.access_token }).catch(() => null);
    throw error;
  }
  const accountResult = await plaidRequest(env, "/accounts/get", { access_token: exchanged.access_token });
  await savePlaidAccounts(env, auth, item.id, accountResult.accounts || []);
  await writeProviderAudit(env, {
    householdId: auth.household.id,
    ownerUserId: auth.user.id,
    eventType: "plaid.item_connected",
    eventData: { item_id: exchanged.item_id, account_count: accountResult.accounts?.length || 0 },
  });
  return { connected: true, accounts: await listPlaidAccounts(env, auth) };
}

export async function getPlaidAccounts(env, auth) {
  requireProvider(env, "plaid");
  return listPlaidAccounts(env, auth);
}

export async function syncPlaidTransactions(request, env, auth) {
  requireProvider(env, "plaid");
  const body = assertObject(await readJson(request, 2_048));
  const items = body.item_id
    ? [await getPlaidItemById(env, auth, String(body.item_id))]
    : await getPlaidItems(env, auth);
  const activeItems = items.filter(Boolean);
  if (!activeItems.length) {
    throw new HttpError(404, "plaid_item_not_found", "No active Plaid connection was found");
  }
  const results = [];
  for (const item of activeItems) {
    results.push({ item_id: item.id, ...(await syncItem(env, item)) });
  }
  await writeProviderAudit(env, {
    householdId: auth.household.id,
    ownerUserId: auth.user.id,
    eventType: "plaid.transactions_synced",
    eventData: { connections: results },
  });
  return { connections: results };
}

export async function disconnectPlaid(request, env, auth) {
  requireProvider(env, "plaid");
  const body = assertObject(await readJson(request, 2_048));
  const item = body.item_id
    ? await getPlaidItemById(env, auth, String(body.item_id))
    : await getPlaidItem(env, auth);
  if (!item) throw new HttpError(404, "plaid_item_not_found", "No active Plaid connection was found");
  await plaidRequest(env, "/item/remove", { access_token: await accessTokenFor(env, item) });
  await disconnectPlaidItem(env, auth, item);
  await writeProviderAudit(env, {
    householdId: auth.household.id,
    ownerUserId: auth.user.id,
    eventType: "plaid.item_disconnected",
    eventData: { item_id: item.item_id },
  });
  return { disconnected: true };
}

function decodeBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function parseJwt(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new HttpError(401, "invalid_plaid_signature", "Plaid webhook signature is invalid");
  try {
    return {
      header: JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))),
      claims: JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))),
      signingInput: new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
      signature: decodeBase64Url(parts[2]),
    };
  } catch {
    throw new HttpError(401, "invalid_plaid_signature", "Plaid webhook signature is invalid");
  }
}

function toHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function verifyPlaidWebhook(env, signature, rawBody, nowSeconds = Math.floor(Date.now() / 1000)) {
  requireProvider(env, "plaid");
  const jwt = parseJwt(signature);
  if (jwt.header.alg !== "ES256" || typeof jwt.header.kid !== "string") {
    throw new HttpError(401, "invalid_plaid_signature", "Plaid webhook signature algorithm is invalid");
  }
  const keyResult = await plaidRequest(env, "/webhook_verification_key/get", { key_id: jwt.header.kid });
  const key = keyResult.key;
  if (!key || key.alg !== "ES256" || key.use !== "sig" || key.kid !== jwt.header.kid) {
    throw new HttpError(401, "invalid_plaid_signature", "Plaid webhook verification key is invalid");
  }
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    cryptoKey,
    jwt.signature,
    jwt.signingInput,
  );
  const issuedAt = Number(jwt.claims.iat);
  if (!valid || !Number.isFinite(issuedAt) || issuedAt > nowSeconds + 30 || nowSeconds - issuedAt > 300) {
    throw new HttpError(401, "invalid_plaid_signature", "Plaid webhook signature is invalid or stale");
  }
  const bodyHash = toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", rawBody)));
  if (jwt.claims.request_body_sha256 !== bodyHash) {
    throw new HttpError(401, "invalid_plaid_signature", "Plaid webhook body hash is invalid");
  }
  return true;
}

export async function handlePlaidWebhook(request, env) {
  const rawBody = await readBytes(request, 262_144);
  await verifyPlaidWebhook(env, request.headers.get("plaid-verification"), rawBody);
  let payload;
  try {
    payload = assertObject(JSON.parse(new TextDecoder().decode(rawBody)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "invalid_json", "Plaid webhook body must be valid JSON");
  }
  const digest = toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", rawBody)));
  const claim = await claimProviderWebhook(env, "plaid", digest, payload);
  if (!claim.claimed) return { received: true, duplicate: true };
  try {
    const item = typeof payload.item_id === "string" ? await getPlaidItemByItemId(env, payload.item_id) : null;
    if (item && payload.webhook_type === "TRANSACTIONS") {
      await syncItem(env, item);
      await writeProviderAudit(env, {
        householdId: item.household_id,
        ownerUserId: item.owner_user_id,
        eventType: "plaid.webhook_verified",
        eventData: { webhook_code: payload.webhook_code },
      });
    }
  } catch (error) {
    await releaseProviderWebhook(env, claim.key);
    throw error;
  }
  return { received: true, duplicate: false };
}
