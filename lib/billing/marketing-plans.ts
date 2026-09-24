/**
 * Customer-facing SkalX subscription plans (marketing + checkout UI).
 * Must stay aligned with active catalog: skalx_starter / skalx_growth / skalx_pro.
 *
 * `priceInr` is the pre-GST catalog price (same as plans.price_inr).
 * Razorpay subscription plans must be created at the GST-inclusive total.
 */

import { BUY_CREDITS_PRICING } from './pricing';

export const SUBSCRIPTION_GST_RATE = BUY_CREDITS_PRICING.gstRate; // 0.18

export const MARKETING_SUBSCRIPTION_PLANS = [
  {
    id: 'skalx_starter' as const,
    name: 'Starter',
    priceInr: 3999,
    imageCredits: 50,
    videoCredits: 1200,
    highlighted: false,
  },
  {
    id: 'skalx_growth' as const,
    name: 'Growth',
    priceInr: 6999,
    imageCredits: 150,
    videoCredits: 2400,
    highlighted: false,
  },
  {
    id: 'skalx_pro' as const,
    name: 'Pro',
    priceInr: 12999,
    imageCredits: 300,
    videoCredits: 4800,
    highlighted: false,
  },
] as const;

export type MarketingPlanId = (typeof MARKETING_SUBSCRIPTION_PLANS)[number]['id'];

export function isMarketingPlanId(planId: string): planId is MarketingPlanId {
  return MARKETING_SUBSCRIPTION_PLANS.some((p) => p.id === planId);
}

export function getMarketingPlan(planId: string) {
  return MARKETING_SUBSCRIPTION_PLANS.find((p) => p.id === planId) ?? null;
}

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** Pre-GST + rounded GST (same rounding as PAYG credit purchases). */
export function subscriptionTotalsInr(priceInrExclusive: number) {
  const subtotalInr = priceInrExclusive;
  const gstRate = SUBSCRIPTION_GST_RATE;
  const gstAmountInr = Math.round(subtotalInr * gstRate);
  const totalInr = subtotalInr + gstAmountInr;
  return { subtotalInr, gstRate, gstAmountInr, totalInr };
}

/** Marketing headline: "₹3,999 + GST" */
export function formatPricePlusGst(priceInrExclusive: number): string {
  return `${formatInr(priceInrExclusive)} + GST`;
}
