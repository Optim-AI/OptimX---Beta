/**
 * AES-256-GCM token encryption for integration credentials at rest.
 * Ciphertext format: enc:v1:<iv_b64>:<tag_b64>:<data_b64>
 *
 * Key source (first match):
 *   INTEGRATION_TOKEN_ENCRYPTION_KEY (32+ chars recommended)
 *   SESSION_SECRET
 *
 * Plaintext tokens without the enc:v1: prefix are returned as-is (legacy rows).
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1:";

function looksLikePlaceholderSecret(raw: string): boolean {
  return /your[_-]|change.?me|placeholder|example_secret|minimum_32/i.test(raw);
}

function getEncryptionKey(): Buffer | null {
  const raw =
    process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
    process.env.SESSION_SECRET ||
    "";
  if (!raw || raw.length < 16) return null;
  if (looksLikePlaceholderSecret(raw)) {
    console.warn(
      "[ads/crypto] Refusing placeholder SESSION_SECRET / INTEGRATION_TOKEN_ENCRYPTION_KEY — set a real secret"
    );
    return null;
  }
  return createHash("sha256").update(raw).digest();
}

export function isEncryptedToken(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptToken(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return plaintext ?? null;
  if (isEncryptedToken(plaintext)) return plaintext;

  const key = getEncryptionKey();
  if (!key) {
    console.warn(
      "[ads/crypto] No INTEGRATION_TOKEN_ENCRYPTION_KEY or SESSION_SECRET — storing token plaintext"
    );
    return plaintext;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return (
    PREFIX +
    [
      iv.toString("base64url"),
      tag.toString("base64url"),
      encrypted.toString("base64url"),
    ].join(":")
  );
}

export function decryptToken(value: string | null | undefined): string | null {
  if (value == null || value === "") return value ?? null;
  if (!isEncryptedToken(value)) return value;

  const key = getEncryptionKey();
  if (!key) {
    throw new Error(
      "Cannot decrypt integration token: INTEGRATION_TOKEN_ENCRYPTION_KEY / SESSION_SECRET missing"
    );
  }

  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/** Encrypt tokens for DB write; sets tokenEncrypted flag hint. */
export function prepareTokensForStorage(tokens: {
  accessToken?: string | null;
  refreshToken?: string | null;
}): {
  accessToken: string | null;
  refreshToken: string | null;
  tokenEncrypted: boolean;
} {
  const accessToken = encryptToken(tokens.accessToken ?? null);
  const refreshToken = encryptToken(tokens.refreshToken ?? null);
  const tokenEncrypted =
    isEncryptedToken(accessToken) || isEncryptedToken(refreshToken);
  return { accessToken, refreshToken, tokenEncrypted };
}

/** Decrypt tokens after DB read. */
export function revealTokens(row: {
  accessToken?: string | null;
  refreshToken?: string | null;
}): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: decryptToken(row.accessToken ?? null),
    refreshToken: decryptToken(row.refreshToken ?? null),
  };
}
