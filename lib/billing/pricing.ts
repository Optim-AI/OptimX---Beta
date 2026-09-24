// lib/billing/pricing.ts
// Shared pricing configuration for pay-as-you-go credit purchases.
//
// IMPORTANT:
// - Amount calculations MUST be re-checked server-side (never trust client inputs).
// - `gstRate` is a decimal (18% => 0.18).
// - Video wallet unit is SkalX Video Credits (NOT seconds, NOT provider tokens).
// - 100 Video Credits = ₹699 before GST; 100 credits = 5 seconds capacity.

import {
  VIDEO_CREDIT_BLOCK_PRICE_INR,
  VIDEO_CREDIT_BLOCK_SIZE,
  VIDEO_CREDIT_MAX_PURCHASE,
  VIDEO_CREDIT_MIN_PURCHASE,
  VIDEO_CREDIT_PURCHASE_STEP,
  videoPurchaseSubtotalInr,
} from './video-credits';

export const BUY_CREDITS_PRICING = {
  imageCreditPriceInr: 10, // ₹10 per image credit
  /** Legacy key kept for admin/settings migration reads only — prefer block pricing. */
  videoSecondPriceInr: 30,
  /** ₹699 per 100 Video Credits (customer-facing block). */
  videoCreditBlockSize: VIDEO_CREDIT_BLOCK_SIZE,
  videoCreditBlockPriceInr: VIDEO_CREDIT_BLOCK_PRICE_INR,
  minQuantity: 10,
  maxQuantity: 1000,
  minVideoQuantity: VIDEO_CREDIT_MIN_PURCHASE,
  maxVideoQuantity: VIDEO_CREDIT_MAX_PURCHASE,
  defaultImageQuantity: 50,
  defaultVideoQuantity: VIDEO_CREDIT_MIN_PURCHASE,
  imageQuantityStep: 10,
  videoQuantityStep: VIDEO_CREDIT_PURCHASE_STEP,
  gstRate: 0.18, // 18% GST
  /** Recommended purchase presets (Video Credits). Min 600, then +300. */
  videoPresets: [600, 900, 1200, 1800, 2400, 3000] as const,
  imagePresets: [25, 50, 100, 250] as const,
} as const;

export function getUnitPriceInr(creditType: 'image' | 'video'): number {
  if (creditType === 'image') return BUY_CREDITS_PRICING.imageCreditPriceInr;
  // Display helper: price per 100-credit block (not per single credit)
  return BUY_CREDITS_PRICING.videoCreditBlockPriceInr;
}

/** Price shown as "per 100 Video Credits". */
export function getVideoBlockPriceInr(overrides?: { blockPriceInr?: number }): number {
  return overrides?.blockPriceInr ?? BUY_CREDITS_PRICING.videoCreditBlockPriceInr;
}

export function getMinQuantity(creditType: 'image' | 'video'): number {
  return creditType === 'image' ? BUY_CREDITS_PRICING.minQuantity : BUY_CREDITS_PRICING.minVideoQuantity;
}

export function getMaxQuantity(creditType: 'image' | 'video'): number {
  return creditType === 'image' ? BUY_CREDITS_PRICING.maxQuantity : BUY_CREDITS_PRICING.maxVideoQuantity;
}

export function getQuantityStep(creditType: 'image' | 'video'): number {
  return creditType === 'image' ? BUY_CREDITS_PRICING.imageQuantityStep : BUY_CREDITS_PRICING.videoQuantityStep;
}

/** Clamps and rounds quantity to valid range. Video: min 600, then multiples of 300. */
export function clampQuantity(creditType: 'image' | 'video', value: number): number {
  const min = getMinQuantity(creditType);
  const max = getMaxQuantity(creditType);
  const step = getQuantityStep(creditType);

  let clamped = Math.max(min, Math.min(max, Math.round(value)));
  if (creditType === 'video') {
    clamped = Math.round(clamped / step) * step;
    clamped = Math.max(min, Math.min(max, clamped));
  }
  return clamped;
}

/**
 * Calculates subtotal + GST + total.
 * We round GST to the nearest rupee because our `payments.amount` is stored as an integer INR value in rupee.
 *
 * For video: subtotal is computed from block pricing (₹699 / 100 credits) via integer paise math.
 * Optional `overrides.unitPriceInr` for image only, or `overrides.videoBlockPriceInr` for video.
 */
export function calculateTotalsInr(params: {
  creditType: 'image' | 'video';
  credits: number;
  overrides?: { unitPriceInr?: number; videoBlockPriceInr?: number };
}) {
  const { creditType, credits, overrides } = params;
  let unitPriceInr: number;
  let subtotalInr: number;

  if (creditType === 'image') {
    unitPriceInr = overrides?.unitPriceInr ?? BUY_CREDITS_PRICING.imageCreditPriceInr;
    subtotalInr = credits * unitPriceInr;
  } else {
    const blockPrice =
      overrides?.videoBlockPriceInr ??
      overrides?.unitPriceInr ??
      BUY_CREDITS_PRICING.videoCreditBlockPriceInr;
    // unitPriceInr here means "price per 100-credit block" for display
    unitPriceInr = blockPrice;
    if (blockPrice === BUY_CREDITS_PRICING.videoCreditBlockPriceInr) {
      subtotalInr = videoPurchaseSubtotalInr(credits);
    } else {
      // Admin override: (credits / 100) * blockPrice, rounded to INR
      subtotalInr = Math.round((credits * blockPrice) / VIDEO_CREDIT_BLOCK_SIZE);
    }
  }

  const gstRate = BUY_CREDITS_PRICING.gstRate;
  const gstAmountInr = Math.round(subtotalInr * gstRate);
  const totalInr = subtotalInr + gstAmountInr;
  return { unitPriceInr, subtotalInr, gstRate, gstAmountInr, totalInr };
}

export {
  VIDEO_CREDIT_BLOCK_SIZE,
  VIDEO_CREDIT_BLOCK_PRICE_INR,
  VIDEO_CREDIT_MIN_PURCHASE,
  VIDEO_CREDIT_PURCHASE_STEP,
  getVideoCreditsForDuration,
  getVideoSecondsForCredits,
  formatVideoCapacityLabel,
  isValidVideoPurchaseQuantity,
} from './video-credits';
