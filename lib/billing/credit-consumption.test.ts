/**
 * Focused credit consumption tests — split math + usage messaging.
 * No provider calls. No DB.
 */

import assert from 'node:assert/strict';
import { splitCreditDeduction } from './credit-split';
import {
  formatPostGenerationCreditSummary,
  formatPreGenerationCreditNotice,
} from './credit-usage-messages';
import {
  getVideoCreditsForDuration,
  isVideoGenerationDuration,
} from './video-credits';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

run('image success amount = 1 split from subscription', () => {
  const s = splitCreditDeduction(5, 2, 1);
  assert.ok(s);
  assert.equal(s!.fromSubscription, 1);
  assert.equal(s!.fromAddon, 0);
  assert.equal(s!.newSubscription, 4);
  assert.equal(s!.newAddon, 2);
});

run('video 15s = 300', () => {
  assert.equal(getVideoCreditsForDuration(15), 300);
  assert.equal(isVideoGenerationDuration(15), true);
});

run('video 30s = 600', () => {
  assert.equal(getVideoCreditsForDuration(30), 600);
});

run('subscription-first: sub 300 + addon 1200 consume 300', () => {
  const s = splitCreditDeduction(300, 1200, 300);
  assert.ok(s);
  assert.equal(s!.newSubscription, 0);
  assert.equal(s!.newAddon, 1200);
  assert.equal(s!.fromSubscription, 300);
  assert.equal(s!.fromAddon, 0);
});

run('mixed: sub 200 + addon 600 consume 300 → 0 + 500', () => {
  const s = splitCreditDeduction(200, 600, 300);
  assert.ok(s);
  assert.equal(s!.newSubscription, 0);
  assert.equal(s!.newAddon, 500);
  assert.equal(s!.fromSubscription, 200);
  assert.equal(s!.fromAddon, 100);
});

run('insufficient: sub 0 + addon 400 request 600 → null', () => {
  assert.equal(splitCreditDeduction(0, 400, 600), null);
});

run('addon pre-notice when only addon used', () => {
  const msg = formatPreGenerationCreditNotice({
    fromSubscription: 0,
    fromAddon: 600,
    requiredCredits: 600,
    creditType: 'video',
  });
  assert.ok(msg);
  assert.match(msg!, /Add-on Video Credits/);
  assert.match(msg!, /subscription credits are used up/i);
});

run('addon post-summary when addon consumed', () => {
  const msg = formatPostGenerationCreditSummary({
    fromSubscription: 0,
    fromAddon: 600,
    requiredCredits: 600,
    creditType: 'video',
  });
  assert.match(msg, /600 Add-on Video Credits used/);
});

run('no invoice semantics: helpers have no payment side effects', () => {
  // Pure functions — calling them must not throw or invent payment fields
  const pre = formatPreGenerationCreditNotice({
    fromSubscription: 300,
    fromAddon: 0,
    requiredCredits: 300,
    creditType: 'video',
  });
  assert.equal(pre, null);
  const post = formatPostGenerationCreditSummary({
    fromSubscription: 300,
    fromAddon: 0,
    requiredCredits: 300,
    creditType: 'video',
  });
  assert.match(post, /300 Video Credits used/);
  assert.equal(post.includes('invoice'), false);
  assert.equal(post.includes('payment'), false);
});

console.log('All credit-consumption unit tests passed.');
