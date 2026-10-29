/**
 * Marketing copy for the public site. One source for prices, deliverables and FAQ
 * so the homepage, /pricing and /About never disagree.
 *
 * Honesty rules: we have no paying customers yet. Do not add client counts, logos,
 * results, testimonials, or features that are not live (posting, scheduling, analytics).
 */
import { SITE_SUPPORT_EMAIL } from '@/lib/seo/site';

export const SPRINT = {
  name: 'Launch Creative Sprint',
  price: '₹14,999',
  foundingPrice: '₹9,999',
  foundingNote: 'Founding-brand price for the first 3 brands',
  gstNote: '+ GST',
  turnaround: '7 days',
  paymentTerms: '50% upfront, 50% on delivery',
  riskReversal: "Approve fewer than 6 of the 12 creatives? Don't pay the second half.",
} as const;

export type Deliverable = {
  id: 'snapshot' | 'concept' | 'statics' | 'videos' | 'calendar' | 'revision';
  title: string;
  desc: string;
};

export const DELIVERABLES: Deliverable[] = [
  { id: 'snapshot', title: 'Brand + 3-competitor snapshot', desc: 'One page on where you stand and what rivals are running.' },
  { id: 'concept', title: '1 campaign concept, 3 angles', desc: 'A single idea, tested three ways so you can see what lands.' },
  { id: 'statics', title: '12 static ad creatives', desc: '4:5 feed and 9:16 story sizes, with captions and hooks.' },
  { id: 'videos', title: '2 × 15-second video ads', desc: 'Short vertical videos ready for Reels and Stories.' },
  { id: 'calendar', title: '2-week posting calendar', desc: 'What to post, when, so the creatives get used.' },
  { id: 'revision', title: '1 revision round', desc: 'Changes to up to 3 assets after you review.' },
];

export const PROBLEMS = [
  {
    title: 'Your ads go stale fast.',
    body: 'The same creative stops working after a week or two. You need new ones constantly.',
  },
  {
    title: 'Every launch needs new creative.',
    body: 'A new SKU, a new city, a new quick-commerce listing — each one needs its own set.',
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

export const COMPARISON = {
  columns: ['Freelancer', 'Agency', 'SkalX Sprint'] as const,
  rows: [
    { label: 'Turnaround', values: ['Varies', 'Weeks', '7 days'] },
    { label: 'Price', values: ['Per asset', 'Monthly retainer', '₹9,999 fixed (founding)'] },
    { label: 'Video ads included', values: ['Rarely', 'Extra', '2 included'] },
    { label: 'Competitor research', values: ['No', 'Sometimes', 'Included'] },
    { label: 'Commitment', values: ['Per job', 'Months', 'One sprint'] },
  ],
} as const;

export const FAQS = [
  {
    q: 'Will AI ads look generic?',
    a: 'Every creative starts from your real product photos, colours and tone. You see a free sample before you pay anything.',
  },
  { q: 'Who owns the creatives?', a: 'You do, once paid. Use them anywhere.' },
  {
    q: "What if I don't like them?",
    a: "One revision round is included, and if you approve fewer than 6 of 12 you don't pay the second half.",
  },
  {
    q: 'Do you post or run ads for us?',
    a: 'No. We deliver ready-to-use files; you or your team post and run them.',
  },
  {
    q: 'Can I use SkalX myself instead?',
    a: 'Yes — see the self-serve plans on the pricing page.',
    link: { href: '/pricing#self-serve', label: 'See self-serve plans' },
  },
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
export const bookingHref = BOOKING_URL || `mailto:${SITE_SUPPORT_EMAIL}?subject=${encodeURIComponent('Book a 15-min call — Launch Creative Sprint')}`;
