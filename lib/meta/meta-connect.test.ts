/**
 * Meta connect building blocks: token crypto, OAuth state, signed_request,
 * usage-header backoff, debug_token interpretation, Graph retry, status derivation.
 * Run: npx tsx lib/meta/meta-connect.test.ts
 */
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'crypto';
import { encryptToken, decryptToken, parseKey, TokenCryptoError } from './crypto';
import { createState, verifyState } from './oauth-state';
import { parseSignedRequest } from './signed-request';
import { parseUsageHeaders, backoffMs } from './usage';
import { graphCall, MetaGraphError } from './graph';
import { interpretDebugToken } from './connect';
import { deriveState } from './status';
import { META_GRAPH_VERSION } from './version';

let failures = 0;
async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}`);
    console.error(e);
  }
}

const key = randomBytes(32);
const SECRET = 'x'.repeat(64);

(async () => {
  await run('version is pinned to v26.0', () => assert.equal(META_GRAPH_VERSION, 'v26.0'));

  await run('crypto: round trip', () => {
    const enc = encryptToken('EAAB-token-123', key);
    assert.match(enc, /^v1:/);
    assert.notEqual(enc, encryptToken('EAAB-token-123', key), 'random IV');
    assert.equal(decryptToken(enc, key), 'EAAB-token-123');
  });

  await run('crypto: tampered ciphertext is rejected', () => {
    const enc = encryptToken('secret', key).split(':');
    enc[3] = Buffer.from('other').toString('base64url');
    assert.throws(() => decryptToken(enc.join(':'), key), TokenCryptoError);
  });

  await run('crypto: wrong key is rejected', () => {
    assert.throws(() => decryptToken(encryptToken('secret', key), randomBytes(32)), TokenCryptoError);
  });

  await run('crypto: key parsing (base64, unpadded, hex, bad)', () => {
    const k = randomBytes(32);
    assert.equal(parseKey(k.toString('base64')).length, 32);
    assert.equal(parseKey(k.toString('base64url')).length, 32);
    assert.equal(parseKey(k.toString('hex')).length, 32);
    assert.throws(() => parseKey('short'), TokenCryptoError);
    assert.throws(() => parseKey(undefined), TokenCryptoError);
  });

  await run('state: valid round trip', () => {
    const { state, nonce } = createState('user-1', { secret: SECRET });
    assert.deepEqual(verifyState(state, nonce, { secret: SECRET }), { ok: true, userId: 'user-1' });
  });

  await run('state: wrong nonce, tampered, expired', () => {
    const { state, nonce } = createState('user-1', { secret: SECRET, now: 1_000_000 });
    assert.equal(verifyState(state, 'other', { secret: SECRET, now: 1_000_000 }).ok, false);
    const [body, sig] = state.split('.');
    const forged = Buffer.from(JSON.stringify({ u: 'attacker', n: nonce, e: 9e9 })).toString('base64url');
    assert.deepEqual(verifyState(`${forged}.${sig}`, nonce, { secret: SECRET }), { ok: false, reason: 'bad_signature' });
    assert.deepEqual(verifyState(`${body}.${sig}`, nonce, { secret: SECRET, now: 1_000_000 + 601_000 }), { ok: false, reason: 'expired' });
    assert.deepEqual(verifyState(undefined, nonce, { secret: SECRET }), { ok: false, reason: 'malformed' });
  });

  await run('signed_request: valid, bad signature, wrong algorithm', () => {
    const appSecret = 'app-secret';
    const make = (payload: object, secret = appSecret) => {
      const p = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const s = createHmac('sha256', secret).update(p).digest('base64url');
      return `${s}.${p}`;
    };
    assert.equal(parseSignedRequest(make({ algorithm: 'HMAC-SHA256', user_id: '123' }), appSecret)?.user_id, '123');
    assert.equal(parseSignedRequest(make({ algorithm: 'HMAC-SHA256', user_id: '123' }, 'wrong'), appSecret), null);
    assert.equal(parseSignedRequest(make({ algorithm: 'NONE', user_id: '123' }), appSecret), null);
    assert.equal(parseSignedRequest('garbage', appSecret), null);
    assert.equal(parseSignedRequest(undefined, appSecret), null);
  });

  await run('usage: headers parsed and backoff tiers', () => {
    const headers: Record<string, string> = {
      'x-app-usage': JSON.stringify({ call_count: 10, total_cputime: 5, total_time: 4 }),
      'x-business-use-case-usage': JSON.stringify({
        '123': [{ type: 'ads_insights', call_count: 80, total_cputime: 20, total_time: 30, estimated_time_to_regain_access: 0 }],
      }),
    };
    const u = parseUsageHeaders((n) => headers[n]);
    assert.equal(u.maxPct, 80);
    assert.equal(backoffMs(u), 3_000);
    assert.equal(backoffMs({ maxPct: 10, regainSeconds: 0 }), 0);
    assert.equal(backoffMs({ maxPct: 100, regainSeconds: 120 }), 120_000);
    assert.equal(parseUsageHeaders(() => 'not json').maxPct, 0);
  });

  await run('debug_token: system user vs user token', () => {
    const sys = interpretDebugToken({ data: { is_valid: true, type: 'SYSTEM_USER', expires_at: 0, scopes: ['ads_read'], granular_scopes: [{ scope: 'business_management', target_ids: ['999'] }] } });
    assert.equal(sys.tokenType, 'system_user');
    assert.equal(sys.expiresAt, null);
    assert.deepEqual(sys.targets.business_management, ['999']);
    const user = interpretDebugToken({ data: { is_valid: true, type: 'USER', expires_at: 1_900_000_000, user_id: '42' } });
    assert.equal(user.tokenType, 'user');
    assert.equal(user.expiresAt, new Date(1_900_000_000_000).toISOString());
    assert.equal(user.subjectId, '42');
    assert.equal(interpretDebugToken({}).isValid, false);
  });

  await run('graph: retries throttling then succeeds; auth errors are not retried', async () => {
    let calls = 0;
    const sleeps: number[] = [];
    const fakeFetch = (async () => {
      calls++;
      if (calls === 1) return new Response(JSON.stringify({ error: { message: 'limit', code: 17 } }), { status: 400 });
      return new Response(JSON.stringify({ id: 'ok' }), { status: 200 });
    }) as typeof fetch;
    const out = await graphCall<{ id: string }>('me', 'tok', {}, { fetchImpl: fakeFetch, sleep: async (ms) => { sleeps.push(ms); } });
    assert.equal(out.id, 'ok');
    assert.equal(calls, 2);
    assert.equal(sleeps[0], 20_000);

    let authCalls = 0;
    const authFetch = (async () => {
      authCalls++;
      return new Response(JSON.stringify({ error: { message: 'expired', code: 190 } }), { status: 400 });
    }) as typeof fetch;
    await assert.rejects(
      graphCall('me', 'tok', {}, { fetchImpl: authFetch, sleep: async () => {} }),
      (e: unknown) => e instanceof MetaGraphError && e.isAuthError,
    );
    assert.equal(authCalls, 1);
  });

  await run('graph: url carries version, token and appsecret_proof', async () => {
    process.env.FACEBOOK_APP_SECRET = 'app-secret';
    let seen = '';
    const fakeFetch = (async (url: string) => {
      seen = url;
      return new Response('{}', { status: 200 });
    }) as unknown as typeof fetch;
    await graphCall('me', 'tok', { fields: 'id' }, { fetchImpl: fakeFetch });
    const u = new URL(seen);
    assert.equal(u.pathname, '/v26.0/me');
    assert.equal(u.searchParams.get('access_token'), 'tok');
    assert.equal(u.searchParams.get('appsecret_proof'), createHmac('sha256', 'app-secret').update('tok').digest('hex'));
  });

  await run('status: derived states', () => {
    const base = { status: 'active', tokenExpiresAt: null } as any;
    const now = Date.parse('2026-11-08T00:00:00Z');
    assert.equal(deriveState(null, now), 'not_connected');
    assert.equal(deriveState({ ...base, status: 'pending' }, now), 'needs_selection');
    assert.equal(deriveState(base, now), 'active');
    assert.equal(deriveState({ ...base, tokenExpiresAt: '2026-11-10T00:00:00Z' }, now), 'expiring');
    assert.equal(deriveState({ ...base, tokenExpiresAt: '2026-11-01T00:00:00Z' }, now), 'expired');
    assert.equal(deriveState({ ...base, tokenExpiresAt: '2027-01-01T00:00:00Z' }, now), 'active');
    assert.equal(deriveState({ ...base, status: 'revoked' }, now), 'revoked');
  });

  if (failures) {
    console.error(`\n${failures} test(s) failed`);
    process.exit(1);
  }
  console.log('\nAll Meta connect tests passed');
})();
