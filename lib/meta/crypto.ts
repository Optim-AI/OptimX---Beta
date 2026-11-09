/**
 * AES-256-GCM encryption for stored Meta tokens.
 * Format: "v1:<iv b64url>:<tag b64url>:<ciphertext b64url>".
 * Key: INTEGRATION_TOKEN_ENCRYPTION_KEY — 32 bytes, base64/base64url (or 64 hex chars).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PREFIX = 'v1';
const IV_BYTES = 12;

export class TokenCryptoError extends Error {}

export function parseKey(raw: string | undefined): Buffer {
  const value = (raw ?? '').trim();
  if (!value) throw new TokenCryptoError('INTEGRATION_TOKEN_ENCRYPTION_KEY is not set');
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (key.length !== 32) {
    throw new TokenCryptoError('INTEGRATION_TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  }
  return key;
}

function getKey(): Buffer {
  return parseKey(process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY);
}

export function encryptToken(plain: string, key: Buffer = getKey()): string {
  if (!plain) throw new TokenCryptoError('Cannot encrypt an empty token');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(':');
}

export function decryptToken(enc: string, key: Buffer = getKey()): string {
  const parts = (enc ?? '').split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) throw new TokenCryptoError('Unrecognised token format');
  const [, ivB, tagB, ctB] = parts;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ctB, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    throw new TokenCryptoError('Token could not be decrypted (wrong key or tampered data)');
  }
}
