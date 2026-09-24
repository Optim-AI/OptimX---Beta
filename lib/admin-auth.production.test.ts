/**
 * Admin auth production-guard smoke tests.
 * Run: npx tsx lib/admin-auth.production.test.ts
 */
import assert from 'node:assert/strict';
import { generateAdminToken, verifyAdminToken } from './admin-auth';

function withEnv(patch: Record<string, string | undefined>, fn: () => void) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(patch)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

withEnv(
  {
    NODE_ENV: 'production',
    ADMIN_TOKEN_SECRET: undefined,
    ADMIN_PASSWORD: 'secure-prod-password-not-default',
  },
  () => {
    assert.throws(
      () => generateAdminToken('admin'),
      /ADMIN_TOKEN_SECRET must be set in production/,
      'production without ADMIN_TOKEN_SECRET must throw'
    );
    console.log('PASS: production rejects missing ADMIN_TOKEN_SECRET');
  }
);

withEnv(
  {
    NODE_ENV: 'production',
    ADMIN_TOKEN_SECRET: 'test-prod-secret-value',
    ADMIN_PASSWORD: 'secure-prod-password-not-default',
    ADMIN_USERNAME: 'admin',
  },
  () => {
    const token = generateAdminToken('admin');
    const verified = verifyAdminToken(token);
    assert.equal(verified.valid, true);
    assert.equal(verified.username, 'admin');
    console.log('PASS: production accepts configured ADMIN_TOKEN_SECRET');
  }
);

withEnv(
  {
    NODE_ENV: 'development',
    ADMIN_TOKEN_SECRET: undefined,
    ADMIN_PASSWORD: undefined,
  },
  () => {
    const token = generateAdminToken('admin');
    assert.equal(verifyAdminToken(token).valid, true);
    console.log('PASS: development uses safe fallback secret');
  }
);
