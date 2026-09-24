/**
 * safe-next origin helpers.
 * Run: npx tsx lib/routing/safe-next.test.ts
 */
import assert from 'node:assert/strict';
import {
  getConfiguredSiteOrigin,
  getSafeNextPath,
  resolveRequestOrigin,
} from './safe-next';

assert.equal(getSafeNextPath('/welcome'), '/welcome');
assert.equal(getSafeNextPath('https://evil.com'), '/welcome');
assert.equal(getSafeNextPath('//evil.com'), '/welcome');
console.log('PASS: getSafeNextPath rejects open redirects');

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
    NEXT_PUBLIC_APP_URL: undefined,
    NEXT_PUBLIC_SITE_URL: undefined,
  },
  () => {
    assert.throws(
      () => getConfiguredSiteOrigin(),
      /must be configured in production/
    );
    console.log('PASS: production requires configured site origin');
  }
);

withEnv(
  {
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: 'https://example.com/',
    NEXT_PUBLIC_SITE_URL: undefined,
  },
  () => {
    assert.equal(getConfiguredSiteOrigin(), 'https://example.com');
    console.log('PASS: production uses NEXT_PUBLIC_APP_URL');
  }
);

withEnv(
  {
    NODE_ENV: 'production',
    NEXT_PUBLIC_APP_URL: undefined,
    NEXT_PUBLIC_SITE_URL: undefined,
  },
  () => {
    assert.throws(() =>
      resolveRequestOrigin({ headers: {} })
    );
    console.log('PASS: resolveRequestOrigin fails closed without host/config in production');
  }
);

withEnv(
  {
    NODE_ENV: 'development',
    NEXT_PUBLIC_APP_URL: undefined,
    NEXT_PUBLIC_SITE_URL: undefined,
  },
  () => {
    assert.equal(getConfiguredSiteOrigin(), 'http://localhost:3000');
    console.log('PASS: development allows localhost fallback');
  }
);

assert.equal(
  resolveRequestOrigin({ headers: { host: 'app.example.com', 'x-forwarded-proto': 'https' } }),
  'https://app.example.com'
);
console.log('PASS: resolveRequestOrigin uses request host');
