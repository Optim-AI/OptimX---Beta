/**
 * Parses Meta's `signed_request` (data deletion + deauthorize callbacks).
 * Format: base64url(signature) "." base64url(JSON payload), HMAC-SHA256 with the app secret.
 * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */
import { createHmac, timingSafeEqual } from 'crypto';

export type SignedRequestPayload = {
  algorithm: string;
  user_id?: string;
  issued_at?: number;
  [k: string]: unknown;
};

export function parseSignedRequest(signedRequest: unknown, appSecret: string): SignedRequestPayload | null {
  if (typeof signedRequest !== 'string' || !appSecret) return null;
  const [sigPart, payloadPart] = signedRequest.split('.', 2);
  if (!sigPart || !payloadPart) return null;

  const expected = createHmac('sha256', appSecret).update(payloadPart).digest();
  const got = Buffer.from(sigPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')) as SignedRequestPayload;
    if (String(payload?.algorithm).toUpperCase() !== 'HMAC-SHA256') return null;
    return payload;
  } catch {
    return null;
  }
}
