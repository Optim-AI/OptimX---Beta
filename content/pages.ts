/**
 * Copy for the supporting pages: /demo, /done-for-you, /solutions/*.
 * Same rules as the homepage: process language, no invented numbers, no Meta-connection claims.
 */

export const DEMO_PAGE = {
  seoTitle: 'Book a demo',
  seoDescription: 'Book a 15-minute SkalX demo. See the research, the angles and the ads SkalX makes for your brand.',
  eyebrow: 'Book a demo',
  title: 'See what SkalX finds for your brand.',
  sub: 'A 15-minute call with the founder. Bring your website; we’ll walk through the research, the angles worth testing and the ads that come out of them.',
  points: [
    'A live look at your brand, competitors and customer reviews',
    'The angles SkalX would test first, and why',
    'Self-serve or done-for-you: which fits your team',
  ],
  fallback: 'The booking calendar didn’t load.',
  fallbackCta: 'Open the booking page',
  orAudit: 'Rather not talk yet?',
  orAuditCta: 'Get your free brand audit',
} as const;

export const DFY_PAGE = {
  seoTitle: 'Done-for-you Studio',
  seoDescription:
    'Our studio uses SkalX to research your market, plan your month and make your posters, carousels and videos. You approve.',
  eyebrow: 'Done-for-you Studio',
  title: "Rather not do it yourself? We'll make it for you.",
  sub: 'Our studio uses SkalX to research, plan and deliver your month of ads. You just approve.',
  processTitle: 'How the studio works',
  process: [
    { title: 'Kick-off', body: 'A short call about your products, customers, offers and what has worked before.' },
    { title: 'Research', body: 'SkalX studies your brand, your competitors and your reviews. We read it with you.' },
    { title: 'Monthly plan', body: 'Angles to test and a posting plan for the month. You approve before we make anything.' },
    { title: 'We make it', body: 'Posters, carousels and videos made with SkalX, in your brand style.' },
    { title: 'Review and deliver', body: 'Ask for changes, then get ready-to-post files.' },
  ],
  deliverablesTitle: 'What you get each month',
  deliverables: [
    'Brand and competitor research, refreshed monthly',
    'A content plan with the reason behind every post',
    'Posters, carousels and short video ads',
    'Revisions included',
    'Ready-to-post files for every platform you use',
  ],
  notIncludedTitle: 'What we don’t do (yet)',
  notIncluded: ['We don’t post or run ads for you. You stay in control of your accounts.'],
  samplesTitle: 'Sample work',
  samplesNote: 'Sample ads for fictional brands. Not client campaigns.',
  formTitle: 'Talk to the studio',
  pricingNote: 'Custom monthly plans, based on how much content you need.',
} as const;

export type SolutionPage = {
  slug: 'd2c' | 'agencies';
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  title: string;
  sub: string;
  problemsTitle: string;
  problems: { title: string; body: string }[];
  howTitle: string;
  how: { title: string; body: string }[];
  fitTitle: string;
  fit: string[];
  ctaTitle: string;
};

export const SOLUTIONS: Record<SolutionPage['slug'], SolutionPage> = {
  d2c: {
    slug: 'd2c',
    seoTitle: 'SkalX for D2C brands',
    seoDescription:
      'For D2C founders and small marketing teams: SkalX researches your market, finds the angles worth testing and makes the ads to match.',
    eyebrow: 'For D2C brands',
    title: 'Your brand needs fresh ads every week. Not more guesses.',
    sub: 'SkalX gives a small team what a marketing team does: research, a reason for every ad, and the posters and videos to run.',
    problemsTitle: 'Sound familiar?',
    problems: [
      { title: 'You post, then wonder why it didn’t work', body: 'Without research, every ad is a guess. SkalX starts with what your customers say.' },
      { title: 'Ads wear out in a week or two', body: 'You need new creative constantly. SkalX makes a test pack from each new angle.' },
      { title: 'An agency is too slow and too costly', body: 'SkalX does the thinking and the making in minutes, on a monthly plan.' },
    ],
    howTitle: 'What SkalX does for a D2C brand',
    how: [
      { title: 'Reads your market', body: 'Your website, your reviews and your competitors’ public ads, in one place.' },
      { title: 'Finds the angles', body: 'The doubts and reasons to buy worth answering, ranked by what to test first.' },
      { title: 'Makes the ads', body: 'Posters, carousels, product videos and UGC-style videos, in your brand style.' },
      { title: 'Plans the month', body: 'Festive and sale moments like Diwali, Pongal and Big Billion Days, planned ahead.' },
    ],
    fitTitle: 'A good fit if you',
    fit: [
      'Sell your own products online (website, Instagram, Amazon or Flipkart)',
      'Run ads or post regularly, and want a reason behind each one',
      'Don’t have a full-time designer or strategist',
    ],
    ctaTitle: 'Find out what your market wants.',
  },
  agencies: {
    slug: 'agencies',
    seoTitle: 'SkalX for agencies',
    seoDescription:
      'For agencies and freelancers: research, angles and first-draft ads for each client brand, so your team spends time on judgement, not legwork.',
    eyebrow: 'For agencies',
    title: 'Do the research for every client. In minutes, not days.',
    sub: 'SkalX handles the legwork: brand and competitor research, customer doubts, angles to test and first-draft creative. Your team brings the judgement.',
    problemsTitle: 'Where agency hours go',
    problems: [
      { title: 'Research eats the retainer', body: 'Reading reviews and competitor ads for each client takes days. SkalX does it in minutes.' },
      { title: 'Pitches need proof', body: 'Walk into a pitch with the brand’s real customer doubts and the angles to answer them.' },
      { title: 'Clients want more creative', body: 'Turn each angle into posters and videos to review, then polish what works.' },
    ],
    howTitle: 'How agencies use SkalX',
    how: [
      { title: 'Pitch research', body: 'A brand and competitor snapshot before the first meeting.' },
      { title: 'Monthly angles', body: 'Fresh angles from new reviews and competitor ads, every month.' },
      { title: 'First drafts', body: 'Posters, carousels and videos your designers can refine.' },
      { title: 'A reason for every ad', body: 'Show clients the finding behind each creative.' },
    ],
    fitTitle: 'A good fit if you',
    fit: [
      'Manage social or performance creative for D2C brands',
      'Want faster research without growing the team',
      'Need a plan that covers several client brands (talk to us)',
    ],
    ctaTitle: 'Bring us a client brand. See what SkalX finds.',
  },
};
