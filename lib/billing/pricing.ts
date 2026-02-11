// lib/billing/pricing.ts
// Shared pricing configuration for pay-as-you-go credit purchases.
//
// IMPORTANT:
// - Amount calculations MUST be re-checked server-side (never trust client inputs).
// - `gstRate` is a decimal (18% => 0.18).

export const BUY_CREDITS_PRICING = {
  imageCreditPriceInr: 10, // ₹10 per image credit
  videoSecondPriceInr: 25, // ₹25 per video second
  minQuantity: 10,
  maxQuantity: 1000,
  defaultImageQuantity: 50,
  defaultVideoQuantity: 60,
  gstRate: 0.18, // 18% GST
} as const;

export function getUnitPriceInr(creditType: 'image' | 'video'): number {
  return creditType === 'image'
    ? BUY_CREDITS_PRICING.imageCreditPriceInr
    : BUY_CREDITS_PRICING.videoSecondPriceInr;
}

/**
 * Calculates subtotal + GST + total.
 * We round GST to the nearest rupee because our `payments.amount` is stored as an integer INR value.
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

