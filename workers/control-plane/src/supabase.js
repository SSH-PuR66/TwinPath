import { HttpError } from "./http.js";

function requireEnv(env, name) {
  const value = env[name];
  if (!value || value.includes("YOUR_")) {
    throw new HttpError(503, "service_not_configured", `${name} is not configured`);
  }
  return value.replace(/\/+$/, "");
}

export function resolveTableName(env, name) {
  const fallback = /^[A-Z0-9_]+_TABLE$/.test(name)
    ? name.slice(0, -6).toLowerCase()
    : name;
  const value = env[name] || fallback;
  if (!value || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new HttpError(503, "service_not_configured", `${name} is not configured`);
  }
  return value;
}

async function parseResponse(response) {
  if (response.status === 204) return null;
  return response.json();
}

export async function supabaseRequest(env, path, init = {}) {
  const baseUrl = requireEnv(env, "SUPABASE_URL");
  const serviceKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const { userToken, ...requestInit } = init;
  const authorization = userToken
    ? `Bearer ${userToken}`
    : `Bearer ${serviceKey}`;
  const response = await fetch(`${baseUrl}${path}`, {
    ...requestInit,
    headers: {
      apikey: userToken ? env.SUPABASE_ANON_KEY : serviceKey,
      authorization,
      accept: "application/json",
      ...(requestInit.body ? { "content-type": "application/json" } : {}),
      ...(requestInit.headers || {}),
    },
  });
  const body = await parseResponse(response);
  if (!response.ok) {
    throw new HttpError(502, "persistence_error", "Supabase persistence request failed", {
      status: response.status,
      code: body?.code,
    });
  }
  return body;
}

export async function selectRows(env, tableName, query) {
  const rows = await supabaseRequest(env, `/rest/v1/${resolveTableName(env, tableName)}?${query}`);
  if (!Array.isArray(rows)) {
    throw new HttpError(502, "persistence_error", "Supabase returned an invalid row set");
  }
  return rows;
}

export async function insertRow(env, tableName, row) {
  const rows = await supabaseRequest(env, `/rest/v1/${resolveTableName(env, tableName)}`, {
    method: "POST",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw new HttpError(502, "persistence_error", "Supabase did not return the inserted row");
  }
  return rows[0];
}

export async function upsertRows(env, tableName, rows, onConflict) {
  const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : "";
  const result = await supabaseRequest(env, `/rest/v1/${resolveTableName(env, tableName)}${query}`, {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  if (!Array.isArray(result)) {
    throw new HttpError(502, "persistence_error", "Supabase returned an invalid upsert result");
  }
  return result;
}

export async function insertIfAbsent(env, tableName, row, onConflict) {
  const query = `?on_conflict=${encodeURIComponent(onConflict)}`;
  const result = await supabaseRequest(env, `/rest/v1/${resolveTableName(env, tableName)}${query}`, {
    method: "POST",
    headers: { prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(row),
  });
  if (!Array.isArray(result) || result.length > 1) {
    throw new HttpError(502, "persistence_error", "Supabase returned an invalid insert result");
  }
  return result[0] || null;
}

export async function deleteRows(env, tableName, query) {
  const rows = await supabaseRequest(env, `/rest/v1/${resolveTableName(env, tableName)}?${query}`, {
    method: "DELETE",
    headers: { prefer: "return=representation" },
  });
  if (!Array.isArray(rows)) {
    throw new HttpError(502, "persistence_error", "Supabase returned an invalid delete result");
  }
  return rows;
}

export async function updateRows(env, tableName, query, changes) {
  const rows = await supabaseRequest(env, `/rest/v1/${resolveTableName(env, tableName)}?${query}`, {
    method: "PATCH",
    headers: { prefer: "return=representation" },
    body: JSON.stringify(changes),
  });
  if (!Array.isArray(rows)) {
    throw new HttpError(502, "persistence_error", "Supabase returned an invalid update result");
  }
  return rows;
}

export async function uploadArtifactObject(env, path, content) {
  const encodedPath = path
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return supabaseRequest(
    env,
    `/storage/v1/object/agent-artifacts/${encodedPath}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "x-upsert": "false",
      },
      body: content,
    },
  );
}

export function filters(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    params.set(key, `eq.${value}`);
  }
  return params;
}
