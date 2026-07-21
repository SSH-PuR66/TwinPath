const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

export class HttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.includes(origin) ? origin : null;
}

export function corsHeaders(request, env) {
  const origin = allowedOrigin(request, env);
  return {
    ...(origin ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Authorization, Content-Type, X-Household-Id",
    "access-control-max-age": "86400",
  };
}

export function json(request, env, value, init = {}) {
  return Response.json(value, {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...corsHeaders(request, env),
      ...(init.headers || {}),
    },
  });
}

export function errorResponse(request, env, error, requestId) {
  const known = error instanceof HttpError;
  const status = known ? error.status : 500;
  const code = known ? error.code : "internal_error";
  const message = known ? error.message : "An internal error occurred";
  return json(
    request,
    env,
    {
      error: {
        code,
        message,
        request_id: requestId,
        ...(known && error.details !== undefined ? { details: error.details } : {}),
      },
    },
    { status },
  );
}

export async function readJson(request, maxBytes = 65_536) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Content-Type must be application/json");
  }

  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    throw new HttpError(413, "payload_too_large", "JSON body is too large");
  }

  if (!request.body) {
    throw new HttpError(400, "invalid_json", "A JSON body is required");
  }

  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maxBytes) {
      await reader.cancel("payload too large");
      throw new HttpError(413, "payload_too_large", "JSON body is too large");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "invalid_json", "Body must contain valid JSON");
  }
}

export function assertObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_body", "JSON body must be an object");
  }
  return value;
}

export function options(request, env) {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigin(request, env)) {
    return json(request, env, { error: { code: "origin_denied", message: "Origin is not allowed" } }, { status: 403 });
  }
  return new Response(null, { status: 204, headers: corsHeaders(request, env) });
}
