/**
 * Company facts and the links every page shares. Edit here, not in components.
 */
import { SITE_SUPPORT_EMAIL } from '@/lib/seo/site';

export const COMPANY = {
  brand: 'SkalX',
  legalName: 'Evio AI Technology Private Limited',
  gstin: '33AAJCE2995C1ZO',
  madeIn: 'Made in Chennai, for D2C brands everywhere.',
  supportEmail: SITE_SUPPORT_EMAIL,
} as const;

export const LINKS = {
  /** New accounts land in /try (onboarding); existing accounts go to their workspace. */
  startFree: '/auth/signup?next=/try',
  logIn: '/auth/signin?next=/try',
  /** Free brand audit: the form in the homepage's final section. */
  freeAudit: '/#get-started',
  /** Calendly booking link (embedded on /demo). */
  bookDemo: 'https://calendly.com/reachout-optim/new-meeting',
  demo: '/demo',
  pricing: '/pricing',
  doneForYou: '/done-for-you',
  solutionsD2c: '/solutions/d2c',
  solutionsAgencies: '/solutions/agencies',
  contact: '/Contact',
  about: '/About',
} as const;

export type Social = { label: string; href: string; icon: 'facebook' | 'instagram' | 'linkedin' | 'youtube' | 'x' };

/** Only accounts that exist and are ours. */
export const SOCIALS: Social[] = [
  { label: 'SkalX on Facebook', href: 'https://www.facebook.com/share/1BNxZDcfRe/?mibextid=wwXIfr', icon: 'facebook' },
];
