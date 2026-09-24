/**
 * Canonical SkalX Video Credit rules.
 *
 * Customer-facing unit: Video Credits (NOT provider tokens, NOT seconds in the wallet).
 *
 * Conversion:
 *   100 Video Credits = 5 seconds of generation capacity
 *   ⇒ 20 Video Credits = 1 second
 *
 * Supported generation durations today: 15s and 30s only.
 *   15s → 300 Video Credits
 *   30s → 600 Video Credits
 *
 * Migration from legacy second-denominated wallet balances:
 *   newCredits = oldSeconds * SECONDS_TO_CREDITS_RATE (20)
 */

export const VIDEO_CREDITS_PER_SECOND = 20 as const;
export const VIDEO_CREDIT_BLOCK_SIZE = 100 as const;
export const VIDEO_CREDIT_BLOCK_PRICE_INR = 699 as const;
/** Minimum PAYG video purchase (enough for one 30s generation). */
export const VIDEO_CREDIT_MIN_PURCHASE = 600 as const;
/**
 * Purchase step after the minimum.
 * 300 = one 15s generation; valid carts: 600, 900, 1200, 1500, …
 */
export const VIDEO_CREDIT_PURCHASE_STEP = 300 as const;
export const VIDEO_CREDIT_MAX_PURCHASE = 60000 as const;

/** Supported commercial generation durations (seconds). */
export const VIDEO_GENERATION_DURATIONS = [15, 30] as const;
export type VideoGenerationDuration = (typeof VIDEO_GENERATION_DURATIONS)[number];

/** Credits required for each supported duration. */
export const VIDEO_CREDITS_BY_DURATION: Record<VideoGenerationDuration, number> = {
  15: 300,
  30: 600,
};

/** Legacy seconds → SkalX Video Credits (do not divide by 5). */
export const SECONDS_TO_CREDITS_RATE = 20 as const;

/**
 * Price of one Video Credit in paise (integer), derived from ₹699 / 100 credits.
 * 699 INR / 100 = 6.99 INR = 699 paise per credit.
 */
export const VIDEO_CREDIT_PRICE_PAISE = 699 as const;

export function isVideoGenerationDuration(value: number): value is VideoGenerationDuration {
  return value === 15 || value === 30;
}

/** Credits required to generate a commercial of the given duration. */
export function getVideoCreditsForDuration(durationSeconds: number): number {
  if (!isVideoGenerationDuration(durationSeconds)) {
    throw new Error(`Unsupported video duration: ${durationSeconds}. Only 15s and 30s are supported.`);
  }
  return VIDEO_CREDITS_BY_DURATION[durationSeconds];
}

/** Approximate generation capacity in seconds for a credit balance (floor). */
export function getVideoSecondsForCredits(credits: number): number {
  if (!Number.isFinite(credits) || credits < 0) return 0;
  return Math.floor(credits / VIDEO_CREDITS_PER_SECOND);
}

/** Migrate a legacy second-denominated balance to Video Credits. */
export function migrateSecondsToVideoCredits(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.floor(seconds) * SECONDS_TO_CREDITS_RATE;
}

/**
 * Subtotal for a video credit purchase in whole INR (paise-safe).
 * credits must be a multiple of VIDEO_CREDIT_BLOCK_SIZE for exact pricing;
 * we still compute with integer paise: credits * 699 paise / 100.
 */
export function videoPurchaseSubtotalInr(credits: number): number {
  if (!Number.isFinite(credits) || credits < 0 || !Number.isInteger(credits)) {
    throw new Error('Video credits must be a non-negative integer');
  }
  // 1 credit = 699 paise (₹6.99). Total INR = (credits * 699) / 100.
  // For multiples of 100 this is always a whole rupee (e.g. 600 → ₹4194).
  const totalPaise = credits * VIDEO_CREDIT_PRICE_PAISE;
  if (totalPaise % 100 !== 0) {
    return Math.round(totalPaise / 100);
  }
  return totalPaise / 100;
}

export function isValidVideoPurchaseQuantity(credits: number): boolean {
  return (
    Number.isInteger(credits) &&
    credits >= VIDEO_CREDIT_MIN_PURCHASE &&
    credits <= VIDEO_CREDIT_MAX_PURCHASE &&
    credits % VIDEO_CREDIT_PURCHASE_STEP === 0
  );
}

export function formatVideoCapacityLabel(credits: number): string {
  const seconds = getVideoSecondsForCredits(credits);
  if (seconds <= 0) return 'No video capacity';
  return `Up to ${seconds} sec`;
}
