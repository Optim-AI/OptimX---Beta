/**
 * Run: npx tsx lib/billing/plan-card-actions.test.ts
 */
import assert from 'node:assert/strict';
import { MARKETING_SUBSCRIPTION_PLANS, isMarketingPlanId } from './marketing-plans';
import {
  isActivePaidSubscription,
  resolvePlanCardAction,
} from './plan-card-actions';

console.log('=== plan card actions ===');

assert.deepEqual(
  MARKETING_SUBSCRIPTION_PLANS.map((p) => p.id),
  ['skalx_starter', 'skalx_growth', 'skalx_pro']
);
assert.equal(isMarketingPlanId('free_trial'), false);

assert.equal(isActivePaidSubscription(null), false);
assert.equal(isActivePaidSubscription({ planId: 'skalx_starter', status: 'cancelled' }), false);
assert.equal(isActivePaidSubscription({ planId: 'skalx_starter', status: 'past_due' }), false);
assert.equal(isActivePaidSubscription({ planId: 'skalx_starter', status: 'pending' }), false);
assert.equal(isActivePaidSubscription({ planId: 'skalx_starter', status: 'active' }), true);
assert.equal(isActivePaidSubscription({ planId: 'skalx_growth', status: 'trialing' }), true);

// No paid sub (incl. approved trial without paid plan)
for (const id of MARKETING_SUBSCRIPTION_PLANS.map((p) => p.id)) {
  const a = resolvePlanCardAction(id, null);
  assert.equal(a.kind, 'buy');
  assert.equal(a.canCheckout, true);
  assert.equal(a.disabled, false);
  assert.match(a.label, /^Buy /);
}

// Starter subscriber
{
  const cur = { planId: 'skalx_starter' as const, status: 'active' };
  assert.equal(resolvePlanCardAction('skalx_starter', cur).kind, 'current');
  assert.equal(resolvePlanCardAction('skalx_starter', cur).disabled, true);
  assert.equal(resolvePlanCardAction('skalx_starter', cur).canCheckout, false);

  const up = resolvePlanCardAction('skalx_growth', cur);
  assert.equal(up.kind, 'upgrade_unavailable');
  assert.equal(up.disabled, true);
  assert.equal(up.canCheckout, false);
  assert.match(up.label, /Upgrade to Growth/);

  const upPro = resolvePlanCardAction('skalx_pro', cur);
  assert.equal(upPro.kind, 'upgrade_unavailable');
  assert.equal(upPro.canCheckout, false);
}

// Growth subscriber
{
  const cur = { planId: 'skalx_growth' as const, status: 'active' };
  assert.equal(resolvePlanCardAction('skalx_growth', cur).kind, 'current');
  assert.equal(resolvePlanCardAction('skalx_starter', cur).kind, 'downgrade_unavailable');
  assert.equal(resolvePlanCardAction('skalx_pro', cur).kind, 'upgrade_unavailable');
  assert.equal(resolvePlanCardAction('skalx_starter', cur).canCheckout, false);
}

// Pro subscriber
{
  const cur = { planId: 'skalx_pro' as const, status: 'active' };
  assert.equal(resolvePlanCardAction('skalx_pro', cur).kind, 'current');
  assert.equal(resolvePlanCardAction('skalx_starter', cur).kind, 'downgrade_unavailable');
  assert.equal(resolvePlanCardAction('skalx_growth', cur).kind, 'downgrade_unavailable');
}

console.log('PASS plan card actions');
