import { HttpError } from "./http.js";
import { selectRows } from "./supabase.js";

function bearerToken(request) {
  const value = request.headers.get("authorization") || "";
  const match = /^Bearer ([^\s]+)$/i.exec(value);
  if (!match) {
    throw new HttpError(401, "unauthorized", "A Bearer access token is required");
  }
  return match[1];
}

export async function verifySupabaseUser(request, env) {
  const token = bearerToken(request);
  const baseUrl = (env.SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = env.SUPABASE_ANON_KEY;
  if (!baseUrl || baseUrl.includes("YOUR_") || !anonKey) {
    throw new HttpError(503, "service_not_configured", "Supabase authentication is not configured");
  }

  const response = await fetch(`${baseUrl}/auth/v1/user`, {
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${token}`,
      accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new HttpError(401, "invalid_token", "The Supabase access token is invalid or expired");
  }
  const user = await response.json();
  if (!user || typeof user.id !== "string" || !user.id) {
    throw new HttpError(401, "invalid_token", "Supabase returned an invalid user");
  }
  return {
    id: user.id,
    email: typeof user.email === "string" ? user.email : null,
    token,
  };
}

export async function resolveHousehold(request, env, user) {
  const requestedHousehold = request.headers.get("x-household-id");
  const params = new URLSearchParams({
    select: "household_id,role",
    user_id: `eq.${user.id}`,
    limit: "2",
  });
  if (requestedHousehold) params.set("household_id", `eq.${requestedHousehold}`);

  const memberships = await selectRows(env, "HOUSEHOLD_MEMBERS_TABLE", params.toString());
  if (memberships.length === 0) {
    throw new HttpError(403, "household_access_denied", "No matching household membership was found");
  }
  if (memberships.length > 1 && !requestedHousehold) {
    throw new HttpError(409, "household_required", "Select a household with X-Household-Id");
  }
  const membership = memberships[0];
  if (!membership || typeof membership.household_id !== "string") {
    throw new HttpError(502, "invalid_membership", "Household membership data is invalid");
  }
  return {
    id: membership.household_id,
    role: typeof membership.role === "string" ? membership.role : "member",
  };
}

export async function authenticate(request, env) {
  const user = await verifySupabaseUser(request, env);
  const household = await resolveHousehold(request, env, user);
  return { user, household, token: user.token };
}
