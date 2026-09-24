import assert from 'node:assert/strict';
import { resolveTryEntry, parseTryOnboarding } from './try-onboarding';
import { getSafeNextPath } from '../routing/safe-next';

assert.equal(getSafeNextPath('/try'), '/try');
assert.equal(getSafeNextPath('//evil.com'), '/welcome');
assert.equal(getSafeNextPath('https://evil.com'), '/welcome');
assert.equal(getSafeNextPath(undefined), '/welcome');

assert.deepEqual(
  resolveTryEntry({
    authenticated: false,
    hasActiveSubscription: false,
    brandSnapshot: null,
    onboarding: null,
  }),
  { kind: 'signin', next: '/try' }
);

assert.deepEqual(
  resolveTryEntry({
    authenticated: true,
    hasActiveSubscription: true,
    brandSnapshot: null,
    onboarding: null,
  }),
  { kind: 'workspace' }
);

assert.deepEqual(
  resolveTryEntry({
    authenticated: true,
    hasActiveSubscription: false,
    brandSnapshot: null,
    onboarding: null,
  }),
  { kind: 'try' }
);

assert.deepEqual(
  resolveTryEntry({
    authenticated: true,
    hasActiveSubscription: false,
    brandSnapshot: { name: 'Acme' },
    onboarding: { status: 'brand_analyzed' },
  }),
  { kind: 'try', step: 'brand_analyzed' }
);

assert.deepEqual(
  resolveTryEntry({
    authenticated: true,
    hasActiveSubscription: false,
    brandSnapshot: null,
    onboarding: null,
    businessName: 'Legacy Co',
  }),
  { kind: 'workspace' }
);

assert.equal(parseTryOnboarding({ onboarding: { status: 'demo_ready', brandName: 'X' } })?.status, 'demo_ready');
assert.equal(parseTryOnboarding({}), null);

console.log('try-onboarding + safe-next checks passed');
