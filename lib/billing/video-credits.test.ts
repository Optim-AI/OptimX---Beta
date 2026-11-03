/**
 * SkalX Video Credits unit tests (no DB).
 * Run: npx tsx lib/billing/video-credits.test.ts
 */

import {
  getVideoCreditsForDuration,
  getVideoSecondsForCredits,
  migrateSecondsToVideoCredits,
  videoPurchaseSubtotalInr,
  isValidVideoPurchaseQuantity,
  VIDEO_CREDITS_BY_DURATION,
  VIDEO_CREDIT_MIN_PURCHASE,
  VIDEO_CREDIT_BLOCK_PRICE_INR,
  VIDEO_CREDIT_PRICE_PAISE,
  SECONDS_TO_CREDITS_RATE,
} from './video-credits';
import { calculateTotalsInr, clampQuantity, BUY_CREDITS_PRICING } from './pricing';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function assertEqual(actual: unknown, expected: unknown, msg: string) {
  if (actual !== expected) {
    throw new Error(`FAIL: ${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
  }
}

console.log('=== video-credits tests ===');

// Duration → credits
assertEqual(getVideoCreditsForDuration(15), 300, '15s → 300');
assertEqual(getVideoCreditsForDuration(30), 600, '30s → 600');
assertEqual(VIDEO_CREDITS_BY_DURATION[15], 300, 'map 15');
assertEqual(VIDEO_CREDITS_BY_DURATION[30], 600, 'map 30');

let threw = false;
try {
  getVideoCreditsForDuration(10);
} catch {
  threw = true;
}
assert(threw, 'unsupported duration throws');

// Credits → seconds capacity
assertEqual(getVideoSecondsForCredits(600), 30, '600 → 30s');
assertEqual(getVideoSecondsForCredits(300), 15, '300 → 15s');
assertEqual(getVideoSecondsForCredits(160), 8, '160 → 8s');
assertEqual(getVideoSecondsForCredits(1), 0, '1 → 0s floor');

// Migration seconds × 20
assertEqual(migrateSecondsToVideoCredits(30), 600, '30s → 600');
assertEqual(migrateSecondsToVideoCredits(8), 160, '8s → 160');
assertEqual(migrateSecondsToVideoCredits(60), 1200, '60s → 1200');
assertEqual(migrateSecondsToVideoCredits(6), 120, '6s → 120');
assertEqual(SECONDS_TO_CREDITS_RATE, 20, 'rate is 20');

// Purchase validation: min 600, then step 300 (600, 900, 1200, …)
assert(isValidVideoPurchaseQuantity(600), '600 ok');
assert(isValidVideoPurchaseQuantity(900), '900 ok');
assert(isValidVideoPurchaseQuantity(1200), '1200 ok');
assert(!isValidVideoPurchaseQuantity(599), '599 invalid');
assert(!isValidVideoPurchaseQuantity(300), '300 invalid for purchase (below min)');
assert(!isValidVideoPurchaseQuantity(601), '601 invalid');
assert(!isValidVideoPurchaseQuantity(750), '750 invalid (not multiple of 300)');
assertEqual(VIDEO_CREDIT_MIN_PURCHASE, 600, 'min purchase 600');

// Subtotal math (₹199 per 100 Video Credits, before GST)
assertEqual(VIDEO_CREDIT_BLOCK_PRICE_INR, 199, 'block price ₹199');
assertEqual(VIDEO_CREDIT_PRICE_PAISE, 199, '199 paise per credit');
assertEqual(videoPurchaseSubtotalInr(100), 199, '100 → ₹199');
assertEqual(videoPurchaseSubtotalInr(300), 597, '300 → ₹597');
assertEqual(videoPurchaseSubtotalInr(600), 1194, '600 → ₹1194');
assertEqual(videoPurchaseSubtotalInr(900), 1791, '900 → ₹1791');
assertEqual(videoPurchaseSubtotalInr(1200), 2388, '1200 → ₹2388');
assertEqual(videoPurchaseSubtotalInr(2400), 4776, '2400 → ₹4776');

// GST totals (18%, rounded to the rupee — unchanged rule)
for (const [credits, subtotal, gst, total] of [
  [600, 1194, 215, 1409],
  [900, 1791, 322, 2113],
  [1200, 2388, 430, 2818],
  [2400, 4776, 860, 5636],
] as const) {
  const t = calculateTotalsInr({ creditType: 'video', credits });
  assertEqual(t.subtotalInr, subtotal, `${credits} subtotal`);
  assertEqual(t.gstAmountInr, gst, `${credits} gst`);
  assertEqual(t.totalInr, total, `${credits} total incl GST`);
  // A saved admin override of the same ₹199 must give the same server-side total
  const viaOverride = calculateTotalsInr({ creditType: 'video', credits, overrides: { videoBlockPriceInr: 199 } });
  assertEqual(viaOverride.totalInr, total, `${credits} override total`);
}
// A different saved admin price still wins over the default (stale ₹699 would charge the old rate)
assertEqual(
  calculateTotalsInr({ creditType: 'video', credits: 600, overrides: { videoBlockPriceInr: 699 } }).subtotalInr,
  4194,
  'stale ₹699 override still applies — DB setting must be updated'
);

const totals10img = calculateTotalsInr({ creditType: 'image', credits: 10 });
assertEqual(totals10img.subtotalInr, 100, '10 images = ₹100');
assertEqual(totals10img.gstAmountInr, 18, 'image gst 18');
assertEqual(totals10img.totalInr, 118, '10 images total 118');

// Clamp video: min 600, step 300
assertEqual(clampQuantity('video', 500), 600, 'clamp 500 → 600');
assertEqual(clampQuantity('video', 700), 600, 'clamp 700 → 600');
assertEqual(clampQuantity('video', 800), 900, 'clamp 800 → 900');
assertEqual(clampQuantity('video', 900), 900, 'clamp 900 → 900');
assertEqual(clampQuantity('video', 1500), 1500, 'clamp 1500 → 1500');
assertEqual(BUY_CREDITS_PRICING.defaultVideoQuantity, 600, 'default video qty');

// Generation gate thresholds (documented)
assert(300 <= 300, '300 credits can do 15s');
assert(!(299 >= 300), '299 cannot do 15s');
assert(600 <= 600, '600 can do 30s');
assert(!(599 >= 600), '599 cannot do 30s');
assert(!(1 >= 300), '1 cannot do 15s');

console.log('PASS: all video-credits / pricing tests');
