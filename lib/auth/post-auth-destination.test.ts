/**
 * Canonical post-auth destination tests.
 * Pure decision coverage + failure contract for resolvePostAuthDestination.
 */

import assert from 'node:assert/strict';
import {
  decidePostAuthDestination,
  type PostAuthState,
} from './post-auth-decision';
import { resolvePostAuthDestination } from './post-auth-destination';

async function run(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

async function main() {

function base(overrides: Partial<PostAuthState> = {}): PostAuthState {
  return {
    hasCapturedPayment: false,
    subscriptionStatus: null,
    subscriptionCurrentPeriodEnd: null,
    onboarding: null,
    businessName: null,
    brandSnapshotName: null,
    now: new Date('2026-10-06T12:00:00.000Z'),
    ...overrides,
  };
}

await run('1. brand-new user → try/brand', () => {
  const d = decidePostAuthDestination(base());
  assert.equal(d.ok, true);
  assert.equal(d.destination, 'try');
  assert.equal(d.step, 'brand');
});

await run('2. halfway onboarding brand_analyzed → try/brand_analyzed', () => {
  const d = decidePostAuthDestination(
    base({ onboarding: { status: 'brand_analyzed' } })
  );
  assert.equal(d.destination, 'try');
  assert.equal(d.step, 'brand_analyzed');
});

await run('3. pricing_seen unpaid → try/pricing', () => {
  const d = decidePostAuthDestination(
    base({
      onboarding: {
        status: 'pricing_seen',
      },
    })
  );
  assert.equal(d.destination, 'try');
  assert.equal(d.step, 'pricing');
});

await run('4. pricing_seen + pending subscription, no payment → try/pricing', () => {
  const d = decidePostAuthDestination(
    base({
      onboarding: { status: 'pricing_seen' },
      subscriptionStatus: 'pending',
      hasCapturedPayment: false,
    })
  );
  assert.equal(d.destination, 'try');
  assert.equal(d.step, 'pricing');
});

await run('5. production bug: pricing_seen + captured + cancelled in-window → workspace', () => {
  const d = decidePostAuthDestination(
    base({
      onboarding: { status: 'pricing_seen' },
      hasCapturedPayment: true,
      subscriptionStatus: 'cancelled',
      subscriptionCurrentPeriodEnd: '2026-10-24T14:40:34.773Z',
      businessName: 'Pintola',
      brandSnapshotName: 'Pintola',
    })
  );
  assert.equal(d.destination, 'workspace');
  assert.equal(d.step, undefined);
});

await run('6. active subscription → workspace', () => {
  const d = decidePostAuthDestination(
    base({ subscriptionStatus: 'active' })
  );
  assert.equal(d.destination, 'workspace');
});

await run('7. trialing subscription → workspace', () => {
  const d = decidePostAuthDestination(
    base({ subscriptionStatus: 'trialing' })
  );
  assert.equal(d.destination, 'workspace');
});

await run('8. cancelled but paid period remains → workspace', () => {
  const d = decidePostAuthDestination(
    base({
      subscriptionStatus: 'cancelled',
      subscriptionCurrentPeriodEnd: '2026-10-24T00:00:00.000Z',
    })
  );
  assert.equal(d.destination, 'workspace');
});

await run('8b. cancelled after period end without payment → not workspace', () => {
  const d = decidePostAuthDestination(
    base({
      subscriptionStatus: 'cancelled',
      subscriptionCurrentPeriodEnd: '2026-09-01T00:00:00.000Z',
      onboarding: { status: 'pricing_seen' },
    })
  );
  assert.equal(d.destination, 'try');
  assert.equal(d.step, 'pricing');
});

await run('9. legacy email user with business_name → workspace', () => {
  const d = decidePostAuthDestination(
    base({ businessName: 'Pintola' })
  );
  assert.equal(d.destination, 'workspace');
});

await run('9b. business_name with in-progress Try does not skip resume', () => {
  const d = decidePostAuthDestination(
    base({
      businessName: 'Pintola',
      onboarding: { status: 'demo_pending' },
    })
  );
  assert.equal(d.destination, 'try');
  assert.equal(d.step, 'demo_pending');
});

await run('10. database load failure → explicit error, not try/brand', async () => {
  const d = await resolvePostAuthDestination('user-1', async () => {
    throw new Error('simulated db failure');
  });
  assert.equal(d.ok, false);
  if (!d.ok) {
    assert.match(d.error, /try again/i);
  }
});

await run('completed onboarding status → workspace', () => {
  assert.equal(
    decidePostAuthDestination(base({ onboarding: { status: 'subscribed' } }))
      .destination,
    'workspace'
  );
  assert.equal(
    decidePostAuthDestination(base({ onboarding: { status: 'complete' } }))
      .destination,
    'workspace'
  );
});

await run('demo_complete unpaid → try/demo_complete', () => {
  const d = decidePostAuthDestination(
    base({ onboarding: { status: 'demo_complete' } })
  );
  assert.equal(d.destination, 'try');
  assert.equal(d.step, 'demo_complete');
});

await run('brand snapshot legacy without Try state → workspace', () => {
  const d = decidePostAuthDestination(
    base({ brandSnapshotName: 'Acme Co' })
  );
  assert.equal(d.destination, 'workspace');
});

console.log('post-auth-destination checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
