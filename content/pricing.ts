/**
 * Website pricing. Prices and credits come from the live plan catalog
 * (lib/billing/marketing-plans.ts), so the site always matches checkout.
 * Only marketing labels live here.
 */
import { MARKETING_SUBSCRIPTION_PLANS, formatInr, type MarketingPlanId } from '@/lib/billing/marketing-plans';

/** Video Credits used per finished video (same rule as the product: 15s = 300). */
export const VIDEO_CREDITS_PER_15S = 300;
export const VIDEO_CREDITS_PER_30S = 600;

export const PRICING_COPY = {
  gstNote: 'All prices + 18% GST, billed monthly. Cancel anytime.',
  imageCreditsBadge: 'Launch offer',
  mostPopularId: 'skalx_growth' as MarketingPlanId,
  mostPopularLabel: 'Most popular',
  customPlan: { title: 'Need a custom plan?', body: 'Agencies and larger teams can get a plan that fits.', cta: 'Contact us' },
  doneForYou: { title: 'Done-for-you', price: 'Custom monthly plans', body: 'Our studio researches, plans and makes your month of ads. You approve.' },
} as const;

export type PricingPlan = {
  id: MarketingPlanId;
  name: string;
  priceLabel: string;
  priceInr: number;
  imageCredits: number;
  videos15s: number;
  videos30s: number;
  mostPopular: boolean;
};

export const PRICING_PLANS: PricingPlan[] = MARKETING_SUBSCRIPTION_PLANS.map((p) => ({
  id: p.id,
  name: p.name,
  priceLabel: formatInr(p.priceInr),
  priceInr: p.priceInr,
  imageCredits: p.imageCredits,
  videos15s: Math.floor(p.videoCredits / VIDEO_CREDITS_PER_15S),
  videos30s: Math.floor(p.videoCredits / VIDEO_CREDITS_PER_30S),
  mostPopular: p.id === PRICING_COPY.mostPopularId,
}));
