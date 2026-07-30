import { HttpError } from "./http.js";

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new HttpError(503, "invalid_encryption_key", "TOKEN_ENCRYPTION_KEY must be valid base64");
  }
}

function keyBytes(value) {
  if (typeof value !== "string" || !value) {
    throw new HttpError(503, "service_not_configured", "TOKEN_ENCRYPTION_KEY is not configured");
  }
  const bytes = /^[0-9a-f]{64}$/i.test(value)
    ? Uint8Array.from(value.match(/../g), (pair) => Number.parseInt(pair, 16))
    : base64ToBytes(value);
  if (bytes.byteLength !== 32) {
    throw new HttpError(503, "invalid_encryption_key", "TOKEN_ENCRYPTION_KEY must contain exactly 32 bytes");
  }
  return bytes;
}

async function importKey(value) {
  return crypto.subtle.importKey("raw", keyBytes(value), { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptToken(token, keyValue, context = "") {
  if (typeof token !== "string" || !token) {
    throw new TypeError("A non-empty token is required");
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = new TextEncoder().encode(context);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData },
    await importKey(keyValue),
    new TextEncoder().encode(token),
  );
  return `v1.${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptToken(envelope, keyValue, context = "") {
  const [version, encodedIv, encodedCiphertext, extra] = String(envelope || "").split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext || extra) {
    throw new HttpError(500, "invalid_token_envelope", "Stored provider token has an invalid envelope");
  }
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(encodedIv),
        additionalData: new TextEncoder().encode(context),
      },
      await importKey(keyValue),
      base64ToBytes(encodedCiphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(500, "token_decryption_failed", "Stored provider token could not be decrypted");
  }
}
