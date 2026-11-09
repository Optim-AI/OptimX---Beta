/**
 * Signed OAuth `state` for the Meta connect flow.
 * state = base64url(JSON{u,n,e}) + "." + base64url(HMAC-SHA256(payload, SESSION_SECRET))
 * The nonce is also set in an httpOnly cookie and must match on callback,
 * so a state can't be replayed from another browser.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const STATE_COOKIE = 'skx_meta_state';
export const STATE_TTL_SECONDS = 600;

export type StatePayload = { u: string; n: string; e: number };

function secret(override?: string): string {
  const s = override ?? process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set (32+ chars) for Meta connect');
  return s;
}

function sign(data: string, key: string): string {
  return createHmac('sha256', key).update(data).digest('base64url');
}

export function createState(userId: string, opts: { now?: number; secret?: string } = {}) {
  const nonce = randomBytes(16).toString('base64url');
  const payload: StatePayload = {
    u: userId,
    n: nonce,
    e: Math.floor((opts.now ?? Date.now()) / 1000) + STATE_TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { state: `${body}.${sign(body, secret(opts.secret))}`, nonce };
}

export type VerifyResult = { ok: true; userId: string } | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' | 'nonce_mismatch' };

export function verifyState(
  state: string | undefined,
  cookieNonce: string | undefined,
  opts: { now?: number; secret?: string } = {},
): VerifyResult {
  if (!state || !state.includes('.')) return { ok: false, reason: 'malformed' };
  const [body, sig] = state.split('.', 2);
  const expected = Buffer.from(sign(body, secret(opts.secret)));
  const got = Buffer.from(sig ?? '');
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return { ok: false, reason: 'bad_signature' };

  let payload: StatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!payload?.u || !payload?.n || !payload?.e) return { ok: false, reason: 'malformed' };
  if (payload.e * 1000 < (opts.now ?? Date.now())) return { ok: false, reason: 'expired' };
  if (!cookieNonce || cookieNonce !== payload.n) return { ok: false, reason: 'nonce_mismatch' };
  return { ok: true, userId: payload.u };
}
