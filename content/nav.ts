/**
 * Site navigation and footer. Product items come from content/features.ts so a feature's
 * status (live / beta / soon) shows the same everywhere.
 *
 */
import { LINKS } from './site';

export type NavLink = { label: string; href: string; description?: string; external?: boolean };

export const NAV = {
  productLabel: 'Product',
  productFeatureIds: ['ad-studio', 'ugc-video-ads', 'product-photoshoot', 'brand-research', 'competitor-ad-watch', 'ad-analytics', 'content-calendar'],
  productFooterNote: 'Every ad comes with the research behind it.',
  solutionsLabel: 'Solutions',
  solutions: [
    { label: 'D2C Brands', href: LINKS.solutionsD2c, description: 'Research, angles and ads for your own brand.' },
    { label: 'Agencies', href: LINKS.solutionsAgencies, description: 'Research-backed creative for every client.' },
    { label: 'Done-for-you Studio', href: LINKS.doneForYou, description: 'We make your month of ads. You approve.' },
  ] as NavLink[],
  links: [
    { label: 'Pricing', href: LINKS.pricing },
    { label: 'Book a demo', href: LINKS.demo },
  ] as NavLink[],
  logIn: { label: 'Log in', href: LINKS.logIn },
  startFree: { label: 'Start free', href: LINKS.startFree },
} as const;

export const FOOTER = {
  tagline: 'The AI marketing team for D2C brands. Research first, then the ads.',
  groups: [
    {
      title: 'Product',
      // Product links are added from FEATURES (live/beta only) in SiteFooter.
      links: [
        { label: 'Free brand audit', href: LINKS.freeAudit },
        { label: 'Pricing', href: LINKS.pricing },
      ],
    },
    {
      title: 'Use cases',
      links: [
        { label: 'Skincare ads', href: '/ai-ad-maker/skincare-brands' },
        { label: 'Food & spice ads', href: '/ai-ad-maker/food-and-spice-brands' },
        { label: 'Instagram ads', href: '/ai-ad-maker/instagram-ads' },
        { label: 'Product video ads', href: '/ai-ad-maker/product-video-ads' },
        { label: 'Diwali ads', href: '/ai-ad-maker/diwali-ads' },
      ],
    },
    {
      title: 'Solutions',
      links: [
        { label: 'D2C Brands', href: LINKS.solutionsD2c },
        { label: 'Agencies', href: LINKS.solutionsAgencies },
        { label: 'Done-for-you Studio', href: LINKS.doneForYou },
        { label: 'Book a demo', href: LINKS.demo },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', href: LINKS.about },
        { label: 'Contact', href: LINKS.contact },
        { label: 'Help Center', href: '/help-center' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '/privacy-policy' },
        { label: 'Terms', href: '/terms-and-conditions' },
        { label: 'Refunds', href: '/terms-and-conditions#refund-cancellation' },
        { label: 'Cookies', href: '/cpolicy' },
        { label: 'AI Disclosure', href: '/ai-disclosure' },
      ],
    },
  ] as { title: string; links: NavLink[] }[],
} as const;
