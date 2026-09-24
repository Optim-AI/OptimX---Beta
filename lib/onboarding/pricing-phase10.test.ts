/**
 * Phase 10 pricing / plan selection unit tests (no DB / no Razorpay).
 * Run: npx tsx lib/onboarding/pricing-phase10.test.ts
 */

import assert from 'node:assert/strict';
import {
  MARKETING_SUBSCRIPTION_PLANS,
  formatPricePlusGst,
  getMarketingPlan,
  isMarketingPlanId,
  subscriptionTotalsInr,
} from '@/lib/billing/marketing-plans';
import { PLAN_COMPARISON_ROWS } from './plan-comparison';
import { parseTryOnboarding } from './try-onboarding';

function main() {
  console.log('=== Phase 10 pricing tests ===');

  // Canonical plan ids
  assert.deepEqual(
    MARKETING_SUBSCRIPTION_PLANS.map((p) => p.id),
    ['skalx_starter', 'skalx_growth', 'skalx_pro']
  );

  // No "Most Popular" highlight
  assert.ok(MARKETING_SUBSCRIPTION_PLANS.every((p) => p.highlighted === false));

  // Credits match product decisions
  assert.equal(getMarketingPlan('skalx_starter')?.imageCredits, 50);
  assert.equal(getMarketingPlan('skalx_starter')?.videoCredits, 1200);
  assert.equal(getMarketingPlan('skalx_growth')?.imageCredits, 150);
  assert.equal(getMarketingPlan('skalx_growth')?.videoCredits, 2400);
  assert.equal(getMarketingPlan('skalx_pro')?.imageCredits, 300);
  assert.equal(getMarketingPlan('skalx_pro')?.videoCredits, 4800);

  // GST model: exclusive catalog → inclusive total
  const starter = subscriptionTotalsInr(3999);
  assert.equal(starter.subtotalInr, 3999);
  assert.equal(starter.gstAmountInr, 720);
  assert.equal(starter.totalInr, 4719);
  assert.equal(formatPricePlusGst(3999), '₹3,999 + GST');

  const growth = subscriptionTotalsInr(6999);
  assert.equal(growth.totalInr, 8259);
  const pro = subscriptionTotalsInr(12999);
  assert.equal(pro.totalInr, 15339);

  // Plan id validation
  assert.equal(isMarketingPlanId('skalx_starter'), true);
  assert.equal(isMarketingPlanId('skalx_growth'), true);
  assert.equal(isMarketingPlanId('skalx_pro'), true);
  assert.equal(isMarketingPlanId('free_trial'), false);
  assert.equal(isMarketingPlanId('plan_TfW39qLbzDnjH5'), false);

  // Selected plan persistence shape
  const parsed = parseTryOnboarding({
    onboarding: {
      status: 'pricing_seen',
      brandName: 'Acme',
      selectedPlanId: 'skalx_growth',
      demo: {
        status: 'completed',
        type: 'poster',
        imageUrl: 'https://cdn.example.com/p.png',
      },
    },
  });
  assert.equal(parsed?.selectedPlanId, 'skalx_growth');
  assert.equal(parsed?.status, 'pricing_seen');
  assert.equal(parsed?.demo?.status, 'completed');

  // Change selection replaces previous
  const next = parseTryOnboarding({
    onboarding: {
      ...parsed,
      status: 'pricing_seen',
      selectedPlanId: 'skalx_pro',
    },
  });
  assert.equal(next?.selectedPlanId, 'skalx_pro');

  // Comparison uses Video Credits language, not seconds as currency
  const videoRow = PLAN_COMPARISON_ROWS.find((r) => r.id === 'video_credits');
  assert.ok(videoRow);
  assert.ok(videoRow!.label.includes('Video Credits'));
  assert.equal(videoRow!.values.skalx_starter, '1,200');
  assert.ok(!String(videoRow!.values.skalx_starter).toLowerCase().includes('second'));

  // Analytics marked coming soon honestly
  const analytics = PLAN_COMPARISON_ROWS.find((r) => r.id === 'analytics');
  assert.equal(analytics?.values.skalx_starter, 'coming_soon');

  // Priority generation only on Pro
  const priority = PLAN_COMPARISON_ROWS.find((r) => r.id === 'priority_generation');
  assert.equal(priority?.values.skalx_starter, false);
  assert.equal(priority?.values.skalx_growth, false);
  assert.equal(priority?.values.skalx_pro, true);

  // No free trial language in plan names
  for (const p of MARKETING_SUBSCRIPTION_PLANS) {
    assert.ok(!/free|trial/i.test(p.name));
  }

  console.log('✓ Phase 10 pricing tests passed');
}

main();
