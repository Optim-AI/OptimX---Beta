// lib/billing/pricing.ts
// Shared pricing configuration for pay-as-you-go credit purchases.
//
// IMPORTANT:
// - Amount calculations MUST be re-checked server-side (never trust client inputs).
// - `gstRate` is a decimal (18% => 0.18).

export const BUY_CREDITS_PRICING = {
  imageCreditPriceInr: 10, // ₹10 per image credit
  videoSecondPriceInr: 30, // ₹30 per video second
  minQuantity: 10,
  maxQuantity: 1000,
  minVideoQuantity: 8,
  maxVideoQuantity: 1000,
  defaultImageQuantity: 50,
  defaultVideoQuantity: 16,
  imageQuantityStep: 10,
  videoQuantityStep: 8,
  gstRate: 0.18, // 18% GST
} as const;

export function getUnitPriceInr(creditType: 'image' | 'video'): number {
  return creditType === 'image'
    ? BUY_CREDITS_PRICING.imageCreditPriceInr
    : BUY_CREDITS_PRICING.videoSecondPriceInr;
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

/** Clamps and rounds quantity to valid range. Video quantities are rounded to nearest multiple of 8. */
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
 */
export function calculateTotalsInr(params: { creditType: 'image' | 'video'; credits: number }) {
  const { creditType, credits } = params;
  const unitPriceInr = getUnitPriceInr(creditType);
  const subtotalInr = credits * unitPriceInr;
  const gstRate = BUY_CREDITS_PRICING.gstRate;
  const gstAmountInr = Math.round(subtotalInr * gstRate);
  const totalInr = subtotalInr + gstAmountInr;
  return { unitPriceInr, subtotalInr, gstRate, gstAmountInr, totalInr };
}

