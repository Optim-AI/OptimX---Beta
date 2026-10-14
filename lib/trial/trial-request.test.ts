/**
 * Free-trial request capture — validation, no auto-access, pricing card isolation.
 * Run: npx tsx lib/trial/trial-request.test.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FREE_TRIAL_CARD, validateTrialRequest } from './validate';
import { getTrialNotifyRecipient } from './notify';
import { isMarketingPlanId, MARKETING_SUBSCRIPTION_PLANS } from '@/lib/billing/marketing-plans';
import { SITE_SUPPORT_EMAIL } from '@/lib/seo/site';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

run('validates required fields and normalizes email', () => {
  const bad = validateTrialRequest({});
  assert.equal(bad.ok, false);

  const missingUse = validateTrialRequest({
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    companyName: 'Analytical Engines',
  });
  assert.equal(missingUse.ok, false);

  const badEmail = validateTrialRequest({
    fullName: 'Ada',
    email: 'not-an-email',
    companyName: 'X',
    useCase: 'Explore video ads',
  });
  assert.equal(badEmail.ok, false);

  const ok = validateTrialRequest({
    fullName: '  Ada Lovelace ',
    email: 'Ada@Example.COM',
    companyName: ' Analytical Engines ',
    websiteUrl: 'example.com',
    useCase: 'Need guided trial for campaign creatives',
  });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.value.email, 'ada@example.com');
  assert.equal(ok.value.fullName, 'Ada Lovelace');
  assert.ok(ok.value.websiteUrl?.startsWith('https://'));
});

run('rejects unsafe website protocols', () => {
  const ftp = validateTrialRequest({
    fullName: 'Ada',
    email: 'ada@example.com',
    companyName: 'X',
    useCase: 'Try SkalX',
    websiteUrl: 'ftp://example.com',
  });
  assert.equal(ftp.ok, false);
});

run('Free Trial is not a purchasable marketing plan id', () => {
  assert.equal(isMarketingPlanId('free_trial'), false);
  assert.equal(isMarketingPlanId('Free Trial'), false);
  assert.deepEqual(
    MARKETING_SUBSCRIPTION_PLANS.map((p) => p.id),
    ['skalx_starter', 'skalx_growth', 'skalx_pro']
  );
  assert.equal(MARKETING_SUBSCRIPTION_PLANS.length, 3);
  assert.equal(FREE_TRIAL_CARD.cta, 'Request Free Trial');
  assert.ok(FREE_TRIAL_CARD.features.includes('Access subject to approval'));
});

run('API forces pending and never provisions billing', () => {
  const api = readFileSync(join(process.cwd(), 'pages/api/trial-requests/index.ts'), 'utf8');
  assert.ok(api.includes("status: 'pending'") || api.includes('insertTrialRequest'));
  assert.ok(!/provision|createSubscription|razorpay|grantCredits|skalx_starter/i.test(api));
  assert.ok(api.includes('Never creates a subscription') || api.includes('never'));

  const store = readFileSync(join(process.cwd(), 'lib/trial/store.ts'), 'utf8');
  assert.ok(store.includes("status: 'pending'"));
  assert.ok(!store.includes('subscriptions'));
});

run('pricing UI opens request dialog and does not checkout free trial', () => {
  const ui = readFileSync(
    join(process.cwd(), 'app/web/src/components/onboarding/TryPricingExperience.tsx'),
    'utf8'
  );
  assert.ok(ui.includes('FreeTrialRequestDialog'));
  assert.ok(ui.includes('FREE_TRIAL_CARD'));
  assert.ok(ui.includes('Request Free Trial') || ui.includes('FREE_TRIAL_CARD.cta'));
  assert.ok(ui.includes('setTrialDialogOpen(true)'));
  assert.ok(!ui.includes("onContinue('free_trial')"));
  assert.ok(ui.includes('xl:grid-cols-4'));
});

run('notify defaults to info@skalxai.app', () => {
  const prev = process.env.TRIAL_REQUEST_NOTIFY_EMAIL;
  delete process.env.TRIAL_REQUEST_NOTIFY_EMAIL;
  assert.equal(getTrialNotifyRecipient(), SITE_SUPPORT_EMAIL);
  assert.equal(SITE_SUPPORT_EMAIL, 'info@skalxai.app');
  if (prev !== undefined) process.env.TRIAL_REQUEST_NOTIFY_EMAIL = prev;
});

run('paid plan prices and credits unchanged in marketing catalog', () => {
  const starter = MARKETING_SUBSCRIPTION_PLANS.find((p) => p.id === 'skalx_starter')!;
  const growth = MARKETING_SUBSCRIPTION_PLANS.find((p) => p.id === 'skalx_growth')!;
  const pro = MARKETING_SUBSCRIPTION_PLANS.find((p) => p.id === 'skalx_pro')!;
  assert.equal(starter.priceInr, 3999);
  assert.equal(starter.imageCredits, 50);
  assert.equal(starter.videoCredits, 1200);
  assert.equal(growth.priceInr, 6999);
  assert.equal(growth.imageCredits, 150);
  assert.equal(growth.videoCredits, 2400);
  assert.equal(pro.priceInr, 12999);
  assert.equal(pro.imageCredits, 300);
  assert.equal(pro.videoCredits, 4800);
});

console.log('\nall trial request tests passed');
