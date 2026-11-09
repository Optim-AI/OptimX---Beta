/**
 * Product features and their real status. This file decides what the site may show:
 * - "live" / "beta": shown, can have a "Try it" CTA ("beta" gets a Beta badge).
 * - "soon": shown with a "Coming soon" badge, never linked and never given a CTA.
 * Change a status here when the product changes; nav, footer and sections follow.
 */

export type FeatureStatus = 'live' | 'beta' | 'soon';

export type Feature = {
  id: string;
  name: string;
  /** One line for menus and cards. */
  short: string;
  status: FeatureStatus;
  /** Where "Try it" / the menu item goes. Ignored for "soon". */
  href: string;
  /** Show in the nav Product menu. */
  inNav: boolean;
};

export const FEATURES: Feature[] = [
  {
    id: 'ad-studio',
    name: 'Ad Studio',
    short: 'Posters and carousels built from your research.',
    status: 'live',
    href: '/#how-skalx-thinks',
    inNav: true,
  },
  {
    id: 'ugc-video-ads',
    name: 'UGC Video Ads',
    short: 'A creator-style video about your product. English for now.',
    status: 'live',
    href: '/#ugc',
    inNav: true,
  },
  {
    id: 'product-video-ads',
    name: 'Product Video Ads',
    short: '15s and 30s video ads from your product photos.',
    status: 'live',
    href: '/#what-you-get',
    inNav: false,
  },
  {
    id: 'product-photoshoot',
    name: 'Product Photoshoot',
    short: 'Studio-quality product photos without a shoot.',
    status: 'live',
    href: '/#photoshoot',
    inNav: true,
  },
  {
    id: 'brand-research',
    name: 'Brand Research',
    short: 'Your brand, customers and market in one report.',
    status: 'live',
    href: '/#test-first',
    inNav: true,
  },
  {
    id: 'competitor-ad-watch',
    name: 'Competitor Ad Watch',
    short: "Competitors' public ads, longest-running first.",
    status: 'live',
    href: '/#test-first',
    inNav: true,
  },
  {
    id: 'ad-analytics',
    name: 'Ad Performance Analytics',
    short: 'ROAS, ROI and what to scale, across Meta, Google, TikTok and LinkedIn.',
    status: 'live',
    href: '/#ad-analytics',
    inNav: true,
  },
  {
    id: 'content-calendar',
    name: 'Content Calendar',
    short: 'A month of posts planned around your findings.',
    status: 'live',
    href: '/#what-you-get',
    inNav: true,
  },
  {
    id: 'ads-export-upload',
    name: 'Ads Manager export upload',
    short: 'Upload an export; see which ads to scale, hold or cut.',
    status: 'soon',
    href: '',
    inNav: false,
  },
];

export function getFeature(id: string): Feature | undefined {
  return FEATURES.find((f) => f.id === id);
}

/** True when a feature may be shown as available (live or beta). */
export function isAvailable(id: string): boolean {
  const f = getFeature(id);
  return f?.status === 'live' || f?.status === 'beta';
}
