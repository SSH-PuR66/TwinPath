import { HttpError } from "./http.js";
import {
  deleteRows,
  filters,
  insertIfAbsent,
  insertRow,
  selectRows,
  supabaseRequest,
  updateRows,
  upsertRows,
} from "./supabase.js";

function householdQuery(auth, values = {}) {
  return new URLSearchParams({
    household_id: `eq.${auth.household.id}`,
    owner_user_id: `eq.${auth.user.id}`,
    ...values,
  }).toString();
}

export function webhookDedupeKey(provider, eventId) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const normalizedEvent = String(eventId || "").trim();
  if (!/^[a-z][a-z0-9_-]{1,31}$/.test(normalizedProvider) || !normalizedEvent || normalizedEvent.length > 500) {
    throw new TypeError("A valid provider and event id are required");
  }
  return `${normalizedProvider}:${normalizedEvent}`;
}

export async function writeProviderAudit(env, {
  householdId,
  ownerUserId,
  eventType,
  eventData = {},
}) {
  await insertRow(env, "AGENT_AUDIT_EVENTS_TABLE", {
    household_id: householdId,
    owner_user_id: ownerUserId,
    actor_user_id: ownerUserId,
    automation_project_id: null,
    agent_run_id: null,
    event_type: eventType,
    event_data: eventData,
  });
}

export async function savePlaidItem(env, auth, item) {
  const rows = await upsertRows(env, "PLAID_ITEMS_TABLE", [{
    household_id: auth.household.id,
    owner_user_id: auth.user.id,
    item_id: item.itemId,
    institution_id: item.institutionId || null,
    institution_name: item.institutionName || null,
    encrypted_access_token: item.encryptedAccessToken,
    cursor: null,
    status: "active",
    provider_environment: item.environment,
    disconnected_at: null,
  }], "owner_user_id,item_id");
  if (rows.length !== 1) {
    throw new HttpError(502, "persistence_error", "Plaid item could not be saved");
  }
  return rows[0];
}

export async function getPlaidItem(env, auth) {
  const rows = await selectRows(env, "PLAID_ITEMS_TABLE", householdQuery(auth, {
    select: "*",
    status: "eq.active",
    limit: "1",
  }));
  return rows[0] || null;
}

export async function getPlaidItems(env, auth) {
  return selectRows(env, "PLAID_ITEMS_TABLE", householdQuery(auth, {
    select: "*",
    status: "eq.active",
    order: "created_at.asc",
    limit: "20",
  }));
}

export async function listPlaidItemsForAutonomousSync(env, limit = 20) {
  return selectRows(env, "PLAID_ITEMS_TABLE", new URLSearchParams({
    select: "*",
    status: "eq.active",
    order: "last_synced_at.asc.nullsfirst",
    limit: String(Math.max(1, Math.min(Number(limit) || 20, 50))),
  }).toString());
}

export async function getPlaidItemById(env, auth, itemId) {
  const rows = await selectRows(env, "PLAID_ITEMS_TABLE", householdQuery(auth, {
    select: "*",
    id: `eq.${itemId}`,
    status: "eq.active",
    limit: "1",
  }));
  return rows[0] || null;
}

export async function getPlaidItemByItemId(env, itemId) {
  const rows = await selectRows(env, "PLAID_ITEMS_TABLE", new URLSearchParams({
    select: "*",
    item_id: `eq.${itemId}`,
    status: "eq.active",
    limit: "1",
  }).toString());
  return rows[0] || null;
}

export async function updatePlaidCursor(env, item, cursor) {
  await updateRows(env, "PLAID_ITEMS_TABLE", filters({ id: item.id }).toString(), {
    cursor,
    last_synced_at: new Date().toISOString(),
  });
}

export async function savePlaidAccounts(env, auth, itemId, accounts) {
  return savePlaidItemAccounts(env, {
    id: itemId,
    household_id: auth.household.id,
    owner_user_id: auth.user.id,
  }, accounts);
}

export async function savePlaidItemAccounts(env, item, accounts) {
  if (!accounts.length) return [];
  return upsertRows(
    env,
    "PLAID_ACCOUNTS_TABLE",
    accounts.map((account) => ({
      household_id: item.household_id,
      owner_user_id: item.owner_user_id,
      plaid_item_id: item.id,
      account_id: account.account_id,
      name: String(account.name || "").slice(0, 180),
      mask: account.mask || null,
      type: account.type,
      subtype: account.subtype || null,
      current_balance: account.balances?.current ?? null,
      available_balance: account.balances?.available ?? null,
      currency: account.balances?.iso_currency_code || null,
    })),
    "owner_user_id,account_id",
  );
}

export async function listPlaidAccounts(env, auth) {
  return selectRows(env, "PLAID_ACCOUNTS_TABLE", householdQuery(auth, {
    select: "id,plaid_item_id,name,mask,type,subtype,current_balance,available_balance,currency,updated_at,plaid_items(institution_name,institution_id,status,last_synced_at)",
    order: "name.asc",
    limit: "100",
  }));
}

export async function savePlaidProductStatus(env, item, product, {
  status,
  errorCode = null,
  syncedAt = status === "enabled" ? new Date().toISOString() : null,
} = {}) {
  return upsertRows(env, "PLAID_PRODUCT_SYNC_STATUS_TABLE", [{
    household_id: item.household_id,
    owner_user_id: item.owner_user_id,
    plaid_item_id: item.id,
    product,
    status,
    provider_error_code: errorCode,
    last_synced_at: syncedAt,
  }], "plaid_item_id,product");
}

export async function listPlaidProductStatuses(env, auth) {
  return selectRows(env, "PLAID_PRODUCT_SYNC_STATUS_TABLE", householdQuery(auth, {
    select: "plaid_item_id,product,status,provider_error_code,last_synced_at,updated_at",
    order: "product.asc",
    limit: "200",
  }));
}

export async function savePlaidLiabilities(env, item, liabilities) {
  await deleteRows(env, "PLAID_LIABILITIES_TABLE", new URLSearchParams({
    plaid_item_id: `eq.${item.id}`,
  }).toString());
  if (!liabilities.length) return [];
  return upsertRows(env, "PLAID_LIABILITIES_TABLE", liabilities.map((liability) => ({
    household_id: item.household_id,
    owner_user_id: item.owner_user_id,
    plaid_item_id: item.id,
    account_id: liability.account_id,
    liability_type: liability.liability_type,
    current_balance: liability.current_balance ?? null,
    minimum_payment: liability.minimum_payment ?? null,
    next_payment_due_date: liability.next_payment_due_date ?? null,
    interest_rate: liability.interest_rate ?? null,
    currency: liability.currency ?? null,
  })), "plaid_item_id,account_id,liability_type");
}

export async function savePlaidRecurringStreams(env, item, streams) {
  await deleteRows(env, "PLAID_RECURRING_STREAMS_TABLE", new URLSearchParams({
    plaid_item_id: `eq.${item.id}`,
  }).toString());
  if (!streams.length) return [];
  return upsertRows(env, "PLAID_RECURRING_STREAMS_TABLE", streams.map((stream) => ({
    household_id: item.household_id,
    owner_user_id: item.owner_user_id,
    plaid_item_id: item.id,
    stream_id: stream.stream_id,
    account_id: stream.account_id ?? null,
    kind: stream.kind,
    description: stream.description,
    merchant_name: stream.merchant_name ?? null,
    average_amount: stream.average_amount ?? null,
    frequency: stream.frequency ?? null,
    last_date: stream.last_date ?? null,
    next_date: stream.next_date ?? null,
    currency: stream.currency ?? null,
  })), "plaid_item_id,stream_id,kind");
}

export async function listPlaidLiabilities(env, auth) {
  return selectRows(env, "PLAID_LIABILITIES_TABLE", householdQuery(auth, {
    select: "id,plaid_item_id,account_id,liability_type,current_balance,minimum_payment,next_payment_due_date,interest_rate,currency,updated_at",
    order: "next_payment_due_date.asc.nullslast",
    limit: "100",
  }));
}

export async function listPlaidRecurringStreams(env, auth) {
  return selectRows(env, "PLAID_RECURRING_STREAMS_TABLE", householdQuery(auth, {
    select: "id,plaid_item_id,stream_id,account_id,kind,description,merchant_name,average_amount,frequency,last_date,next_date,currency,updated_at",
    order: "next_date.asc.nullslast",
    limit: "200",
  }));
}

export async function applyPlaidTransactions(env, item, sync) {
  const base = {
    household_id: item.household_id,
    owner_user_id: item.owner_user_id,
    plaid_item_id: item.id,
  };
  const changed = [...sync.added, ...sync.modified];
  if (changed.length) {
    await upsertRows(env, "PLAID_TRANSACTIONS_TABLE", changed.map((transaction) => ({
      ...base,
      transaction_id: transaction.transaction_id,
      account_id: transaction.account_id,
      amount: transaction.amount,
      currency: transaction.iso_currency_code || null,
      merchant_name: transaction.merchant_name || null,
      name: String(transaction.name || "").slice(0, 500),
      authorized_date: transaction.authorized_date || null,
      posted_date: transaction.date,
      pending: Boolean(transaction.pending),
      provider_data: transaction,
    })), "owner_user_id,transaction_id");

    for (const transaction of changed) {
      if (transaction.pending || !transaction.date || !Number.isFinite(Number(transaction.amount))) {
        continue;
      }
      const plaidAmount = Number(transaction.amount);
      await supabaseRequest(env, "/rest/v1/rpc/upsert_plaid_transaction", {
        method: "POST",
        body: JSON.stringify({
          p_household_id: item.household_id,
          p_owner_user_id: item.owner_user_id,
          p_external_id: transaction.transaction_id,
          p_kind: plaidAmount < 0 ? "income" : "expense",
          p_amount: Math.abs(plaidAmount),
          p_transaction_date: transaction.date,
          p_category: Array.isArray(transaction.personal_finance_category?.detailed)
            ? transaction.personal_finance_category.detailed.join(", ").slice(0, 60)
            : String(transaction.personal_finance_category?.primary || "Plaid import").slice(0, 60),
          p_description: String(transaction.merchant_name || transaction.name || "Connected transaction").slice(0, 180),
          p_visibility: "private",
        }),
      });
    }
  }
  for (const removed of sync.removed) {
    await deleteRows(env, "PLAID_TRANSACTIONS_TABLE", new URLSearchParams({
      owner_user_id: `eq.${item.owner_user_id}`,
      transaction_id: `eq.${removed.transaction_id}`,
    }).toString());
    await deleteRows(env, "transactions", new URLSearchParams({
      household_id: `eq.${item.household_id}`,
      owner_user_id: `eq.${item.owner_user_id}`,
      external_source: "eq.plaid",
      external_id: `eq.${removed.transaction_id}`,
    }).toString());
  }
}

export async function disconnectPlaidItem(env, auth, item) {
  const rows = await updateRows(env, "PLAID_ITEMS_TABLE", householdQuery(auth, {
    id: `eq.${item.id}`,
    status: "eq.active",
  }), {
    status: "disconnected",
    encrypted_access_token: null,
    disconnected_at: new Date().toISOString(),
  });
  if (rows.length !== 1) throw new HttpError(409, "plaid_disconnect_failed", "Plaid item was already disconnected");
}

export async function getStripeCustomer(env, auth) {
  const rows = await selectRows(env, "STRIPE_CUSTOMERS_TABLE", householdQuery(auth, {
    select: "*",
    limit: "1",
  }));
  return rows[0] || null;
}

export async function saveStripeCustomer(env, auth, customerId) {
  const rows = await upsertRows(env, "STRIPE_CUSTOMERS_TABLE", [{
    household_id: auth.household.id,
    owner_user_id: auth.user.id,
    stripe_customer_id: customerId,
  }], "owner_user_id");
  return rows[0];
}

export async function getStripeCustomerById(env, customerId) {
  const rows = await selectRows(env, "STRIPE_CUSTOMERS_TABLE", new URLSearchParams({
    select: "*",
    stripe_customer_id: `eq.${customerId}`,
    limit: "1",
  }).toString());
  return rows[0] || null;
}

export async function listStripeLifecycleEvents(env, auth) {
  return selectRows(env, "STRIPE_LIFECYCLE_EVENTS_TABLE", householdQuery(auth, {
    select: "stripe_event_id,event_type,status,amount,currency,occurred_at",
    order: "occurred_at.desc",
    limit: "20",
  }));
}

export async function saveStripeLifecycleEvent(env, customer, event) {
  return insertIfAbsent(env, "STRIPE_LIFECYCLE_EVENTS_TABLE", {
    household_id: customer.household_id,
    owner_user_id: customer.owner_user_id,
    stripe_event_id: event.id,
    event_type: event.type,
    status: String(event.status || "received").slice(0, 80),
    amount: Math.max(0, Number(event.amount) || 0),
    currency: event.currency,
    occurred_at: event.occurredAt,
  }, "stripe_event_id");
}

export async function claimProviderWebhook(env, provider, eventId, payload) {
  const key = webhookDedupeKey(provider, eventId);
  const row = await insertIfAbsent(env, "PROVIDER_WEBHOOK_EVENTS_TABLE", {
    provider,
    external_event_id: eventId,
    dedupe_key: key,
    verification_status: "verified",
    payload,
  }, "dedupe_key");
  return { claimed: Boolean(row), key };
}

export async function releaseProviderWebhook(env, key) {
  await deleteRows(
    env,
    "PROVIDER_WEBHOOK_EVENTS_TABLE",
    new URLSearchParams({ dedupe_key: `eq.${key}` }).toString(),
  );
}

export async function insertVerifiedStripeRevenue(env, customer, event) {
  if (!customer || event.provider !== "stripe" || event.verificationStatus !== "verified") {
    throw new HttpError(403, "unverified_revenue_event", "Only verified Stripe events can create revenue");
  }
  const revenue = await insertIfAbsent(env, "REVENUE_EVENTS_TABLE", {
    household_id: customer.household_id,
    owner_user_id: customer.owner_user_id,
    visibility: "private",
    source: "stripe",
    external_event_id: event.id,
    mode: "live",
    verification_status: "verified",
    amount: event.amount,
    currency: event.currency,
    category: "Subscription revenue",
    description: "Verified Stripe payment",
    occurred_at: event.occurredAt,
    payload: event.payload,
  }, "owner_user_id,source,external_event_id");
  if (revenue?.id) {
    await supabaseRequest(env, "/rest/v1/rpc/record_revenue_event_transaction", {
      method: "POST",
      body: JSON.stringify({ p_revenue_event_id: revenue.id }),
    });
  }
  return revenue;
}
