/**
 * Marketing copy for the public site. One source so the homepage, /pricing and /About agree.
 *
 * Positioning: SkalX is self-serve — research → strategy → create, on a monthly plan.
 * Honesty rules: we have no paying customers yet. No client counts, logos, results,
 * testimonials, fixed deliverable counts, or features that are not live (auto-posting,
 * scheduling, performance analytics).
 */
import { MARKETING_SUBSCRIPTION_PLANS, formatPricePlusGst } from '@/lib/billing/marketing-plans';
import { SITE_SUPPORT_EMAIL } from '@/lib/seo/site';

/** e.g. "₹3,999 + GST" — always derived from the live plan catalog. */
export const STARTING_PRICE = formatPricePlusGst(Math.min(...MARKETING_SUBSCRIPTION_PLANS.map((p) => p.priceInr)));

export const PROBLEMS = [
  {
    title: 'Your ads go stale fast.',
    body: 'The same creative stops working after a week or two. You need new ones constantly.',
  },
  {
    title: "You're guessing what customers want.",
    body: 'Reviews, comments and competitor ads are scattered across platforms. Piecing them together takes days, so most brands skip it.',
  },
  {
    title: 'Agencies are slow and pricey.',
    body: 'Doing it yourself eats your week. You end up posting less than you should.',
  },
] as const;

export const STEPS = [
  {
    title: 'Share your brand.',
    body: 'Your website, Instagram and product photos. A 15-minute call if you want one.',
  },
  {
    title: 'We build your sprint.',
    body: 'SkalX studies your brand and competitors, then we create the concept, ads and videos.',
  },
  {
    title: 'You approve and launch.',
    body: 'Review everything, ask for changes, then post or run ads.',
  },
] as const;

export type Pillar = {
  id: 'research' | 'strategy' | 'create';
  title: string;
  lead: string;
  points: string[];
};

export const PILLARS: Pillar[] = [
  {
    id: 'research',
    title: 'Research',
    lead: 'Know your market before you spend on it.',
    points: [
      'Your brand and competitor snapshot',
      'What customers praise and complain about, from public reviews',
      'What competitors are running right now',
    ],
  },
  {
    id: 'strategy',
    title: 'Strategy',
    lead: 'Turn what you learn into a plan.',
    points: ['Campaign concepts and angles', 'Hooks that answer real customer objections', 'A posting plan'],
  },
  {
    id: 'create',
    title: 'Create',
    lead: 'Make the content to match.',
    points: [
      'Static ads in feed and story sizes',
      'Short video ads',
      "Captions — as many as your plan's credits cover",
    ],
  },
];

export const COMPARISON = {
  columns: ['Freelancer', 'Agency', 'SkalX'] as const,
  rows: [
    { label: 'Turnaround', values: ['Varies', 'Weeks', 'Minutes'] },
    { label: 'Price', values: ['Per asset', 'Monthly retainer', `From ${STARTING_PRICE} a month`] },
    { label: 'Video ads', values: ['Rarely', 'Extra', 'Included'] },
    { label: 'Market & competitor research', values: ['No', 'Sometimes', 'Included'] },
    { label: 'Commitment', values: ['Per job', 'Months', 'Monthly, cancel anytime'] },
  ],
} as const;

export const FAQS = [
  {
    q: 'Will AI ads look generic?',
    a: 'Every creative starts from your real product photos, colours and tone, plus what your customers actually say. Get one free ad first and judge for yourself.',
  },
  {
    q: 'Where does the research come from?',
    a: 'Your website, public reviews, and the ads and posts your competitors are running.',
  },
  {
    q: 'How many ads and videos can I make?',
    a: "As many as your plan's credits cover. You can buy more credits anytime.",
  },
  { q: 'Who owns the creatives?', a: 'You do. Use them anywhere.' },
  {
    q: 'Do you post or run ads for us?',
    a: 'No. You download ready-to-use files and post or run them yourself.',
  },
  { q: 'Can I cancel anytime?', a: 'Yes. Plans are monthly and you can cancel anytime.' },
  { q: 'Is GST included?', a: 'Prices are + 18% GST.' },
] as const;

export const FOUNDER = {
  name: 'Sudharsan AJ',
  shortName: 'AJ',
  note: "Hi, I'm AJ. I'm a product designer from Chennai, and I built SkalX because good creative shouldn't need an agency budget. We're early, and we're taking on our first founding brands now — you'll work with me directly.",
  email: SITE_SUPPORT_EMAIL,
  // TODO: AJ's LinkedIn profile URL. The link renders once this is set.
  linkedinUrl: '',
  // TODO: add /public/images/founder-aj.jpg (800×800) and set this to '/images/founder-aj.jpg'.
  photo: '',
} as const;

// TODO: a booking link (e.g. Cal.com / Calendly). Until then "Book a 15-min call" opens an email.
export const BOOKING_URL = '';
export const bookingHref = BOOKING_URL || `mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent('Book a 15-min call — SkalX')}`;
