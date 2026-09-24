/**
 * Truthful plan comparison for /try pricing (Phase 10).
 * Derived from product reality + plan_feature_flags migration notes.
 * Do not invent unsupported capabilities.
 */

import type { MarketingPlanId } from '@/lib/billing/marketing-plans';

export type ComparisonCell = boolean | 'coming_soon' | string;

export type PlanComparisonRow = {
  id: string;
  label: string;
  hint?: string;
  values: Record<MarketingPlanId, ComparisonCell>;
};

/** Short bullets for plan cards — same capabilities, credit amounts differ on the card. */
export const PLAN_CARD_CAPABILITIES = [
  'AI posters & ad creatives',
  'AI video generation',
  'Brand intelligence',
  'Campaign planning tools',
  'No watermark on outputs',
] as const;

export const PLAN_COMPARISON_ROWS: PlanComparisonRow[] = [
  {
    id: 'image_credits',
    label: 'Image Credits / month',
    hint: 'One successful image generation uses 1 Image Credit.',
    values: {
      skalx_starter: '50',
      skalx_growth: '150',
      skalx_pro: '300',
    },
  },
  {
    id: 'video_credits',
    label: 'Video Credits / month',
    hint: 'Video generation uses Video Credits based on duration (e.g. 15s = 300).',
    values: {
      skalx_starter: '1,200',
      skalx_growth: '2,400',
      skalx_pro: '4,800',
    },
  },
  {
    id: 'ai_posters',
    label: 'AI poster creation',
    values: {
      skalx_starter: true,
      skalx_growth: true,
      skalx_pro: true,
    },
  },
  {
    id: 'ai_videos',
    label: 'AI video creation',
    values: {
      skalx_starter: true,
      skalx_growth: true,
      skalx_pro: true,
    },
  },
  {
    id: 'brand_intelligence',
    label: 'Brand intelligence',
    values: {
      skalx_starter: true,
      skalx_growth: true,
      skalx_pro: true,
    },
  },
  {
    id: 'campaign_planning',
    label: 'Campaign planning',
    values: {
      skalx_starter: true,
      skalx_growth: true,
      skalx_pro: true,
    },
  },
  {
    id: 'no_watermark',
    label: 'No watermark',
    values: {
      skalx_starter: true,
      skalx_growth: true,
      skalx_pro: true,
    },
  },
  {
    id: 'priority_generation',
    label: 'Priority generation',
    values: {
      skalx_starter: false,
      skalx_growth: false,
      skalx_pro: true,
    },
  },
  {
    id: 'analytics',
    label: 'Analytics & optimization',
    values: {
      skalx_starter: 'coming_soon',
      skalx_growth: 'coming_soon',
      skalx_pro: 'coming_soon',
    },
  },
  {
    id: 'social_posting',
    label: 'Social posting',
    values: {
      skalx_starter: false,
      skalx_growth: 'coming_soon',
      skalx_pro: 'coming_soon',
    },
  },
];
