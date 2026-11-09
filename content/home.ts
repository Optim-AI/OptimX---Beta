/**
 * Homepage copy (draft). Edit words here; layout lives in app/web/src/components/marketing/home/*.
 * Rules: lead with understanding before creation; no invented numbers (mockups say "Example data");
 * outcome language is about process, not guarantees.
 */

export const HERO = {
  eyebrow: 'The AI marketing team for D2C brands',
  kicker: 'Not just another AI ad tool.',
  title: 'Know what works. Then make it.',
  sub: 'SkalX understands your brand, competitors and customers, builds your marketing strategy, and turns it into ready-to-use posters, videos and UGC-style ads.',
  primaryCta: 'Get your free brand audit',
  secondaryCta: 'Create your first ad',
  trust: ['Free audit', 'No card needed', 'Ready in minutes'],
} as const;

/** Fictional brand used in the hero animation (never a real brand). */
export const HERO_FLOW = {
  brand: 'Dewdrop Skin',
  site: 'dewdropskin.in',
  label: 'Example, fictional brand',
  steps: ['Research', 'Angle', 'Ads'],
  research: {
    positioning: 'Lightweight gel moisturiser for humid Indian summers.',
    competitors: ['Mistleaf', 'Aqua Bloom', 'Kesar & Co.'],
    complaint: '“Will it work on oily skin, or just sit there?”',
  },
  angle: {
    finding: 'Customers doubt it works on oily skin.',
    angle: 'Show a before / after on oily skin, in real humidity.',
  },
  ads: [
    { format: 'Feed 4:5', headline: 'Oily skin? Still glows, never greasy.' },
    { format: 'Story 9:16', headline: '7 a.m. Chennai humidity test.' },
    { format: 'UGC 15s', headline: '“I have oily skin. Here’s week two.”' },
  ],
} as const;

export const PROBLEM = {
  eyebrow: 'The problem',
  title: "You have AI tools. You still don't know what to post.",
  sub: "ChatGPT writes captions. Canva makes posters. Video tools make videos. None of them tell you what your customers actually want to hear, or why your competitor's ad keeps running.",
  cards: [
    { title: 'Generic content', body: "AI ads that look like everyone else's get scrolled past." },
    { title: 'Guesswork', body: 'You post, boost and hope. Then do it again next week.' },
    { title: 'Too many tools', body: "Five subscriptions, and you're still the one connecting the dots." },
  ],
  table: {
    caption: 'Generic AI tools, an agency and SkalX compared',
    columns: ['Generic AI tools', 'An agency', 'SkalX'],
    rows: [
      { label: 'Knows your market', values: ['No', 'Yes', 'Yes, from your brand, competitors and reviews'] },
      { label: 'Tells you what to say', values: ['No, you write the prompt', 'Yes', 'Yes, with the reason for each ad'] },
      { label: 'Makes the content', values: ['Yes', 'Yes', 'Yes: posters, videos, UGC ads'] },
      { label: 'Cost', values: ['Low, per tool', '₹50K+ a month', 'From ₹3,999 a month'] },
      { label: 'Speed', values: ['Minutes', 'Weeks', 'Minutes'] },
    ],
  },
} as const;

export const THINKING = {
  eyebrow: 'How SkalX thinks',
  title: 'We do the thinking. Then we make the ads.',
  stages: [
    {
      title: 'Understand your brand',
      body: 'What you sell, who buys it, how you sound.',
      output: 'Brand profile',
    },
    {
      title: 'Study your competitors',
      body: 'Their positioning, their ads, the ones that have run for weeks.',
      output: 'Competitor snapshot',
    },
    {
      title: 'Hear your customers',
      body: 'Reviews and comments turned into the objections and reasons people buy.',
      output: 'Top 3 doubts',
    },
    {
      title: 'Make ads with a reason',
      body: 'Every ad answers one of those findings.',
      output: 'Ad with its “Why this ad”',
    },
  ],
  closing: "That's what a marketing team does. SkalX does it in minutes.",
} as const;

export const SHOWCASE = {
  eyebrow: 'Showcase',
  title: 'Every ad has a reason behind it.',
  sub: "Here's what SkalX made, and why.",
  whyLabel: 'Why this ad',
  hintTouch: 'Tap a card to see why',
  hintPointer: 'Hover a card to see why',
  note: 'Sample ads for fictional brands. Not client campaigns.',
  cta: 'See what SkalX finds for your brand',
} as const;

export const UGC = {
  eyebrow: 'UGC video ads',
  title: 'UGC-style ads, without the shoot day.',
  sub: "A real-looking creator talks about your product, in your customer's language.",
  cards: [
    { title: 'Pick a creator', body: 'Choose the age, look and setting that fits your buyer.' },
    { title: 'Natural voice', body: 'Natural-sounding English voices. More languages are on the way.' },
    { title: 'Hooks that sell', body: 'Scripts built from your reviews and your competitors’ ads.' },
  ],
  waitlist: {
    title: 'UGC video ads are coming soon',
    body: 'Leave your email and we’ll tell you when they’re ready.',
    cta: 'Join waitlist',
  },
} as const;

export const PHOTOSHOOT = {
  eyebrow: 'Product photoshoot',
  title: 'A phone photo in. A product shoot out.',
  sub: 'Snap your product on any table. SkalX turns it into studio and lifestyle shots in the setting your buyer lives in.',
  beforeLabel: 'Your product photo',
  afterLabel: 'SkalX photoshoot',
  anglesLabel: 'More angles, same photo',
  points: [
    { title: 'Any photo works', body: 'Kitchen counter, bad light, plain background. One photo is enough.' },
    { title: 'Scenes that fit your buyer', body: 'Studio, lifestyle or festive, set where your customer would use it.' },
    { title: 'Your product stays your product', body: 'Same pack, same label, same colours. Only the scene changes.' },
  ],
  note: 'Example shots for fictional brands. Every shot above was made by SkalX from the one product photo.',
  cta: 'Try it on your product',
} as const;

export const AD_ANALYTICS = {
  eyebrow: 'After you launch',
  title: "See what's working. Do more of it.",
  sub: 'Connect your ad accounts. See ROAS and ROI in one place, and what to do next.',
  steps: ['Connect', 'See ROAS & ROI', 'Scale the winners'],
  readOnly: 'Read-only. SkalX never touches your ads.',
  cta: 'Connect your ad accounts',
} as const;

export const TEST_FIRST = {
  eyebrow: 'Before you spend',
  title: "Know what's worth testing. Before you spend.",
  sub: 'SkalX reads your market, your competitors and your customers, then tells you which ad to run first.',
  cards: [
    { id: 'ad-watch', title: 'Competitor Ad Watch', body: "Competitors' live ads side by side. Running 6+ weeks usually means it's working.", source: 'From public ad libraries' },
    { id: 'category', title: 'What works in your category', body: 'Top angles and formats across brands in your category.', source: 'From public ads in your category' },
    { id: 'customers', title: 'What your customers say', body: 'Top objections and reasons to buy, each turned into an ad angle.', source: 'From public reviews' },
    { id: 'test-pack', title: 'Your test pack', body: '6 variants, each with what it tests and why it might work.', source: 'Made by SkalX' },
  ],
  csvLine: 'Already running ads? Upload your Ads Manager export and SkalX shows which ads to scale, hold or cut.',
} as const;

export const MAKES = {
  eyebrow: 'Then it makes everything',
  title: 'Then it makes everything you need.',
  sub: 'Once SkalX knows what to say, it makes it in every format.',
  items: [
    { featureId: 'ad-studio', title: 'Static image ads', body: 'Feed and story posters in your brand style.' },
    { featureId: 'ad-studio', title: 'Carousels', body: 'Multi-slide stories that walk through one idea.' },
    { featureId: 'product-video-ads', title: 'Product video ads', body: '15s and 30s videos from your product photos.' },
    { featureId: 'ugc-video-ads', title: 'UGC video ads', body: 'A creator-style video about your product.' },
    { featureId: 'product-photoshoot', title: 'Product photoshoots', body: 'Studio and lifestyle photos without a shoot.' },
    { featureId: 'ad-studio', title: 'Festive & sale campaigns', body: 'Diwali, Pongal, Big Billion Days, Black Friday.' },
  ],
} as const;

export const START_FROM = {
  eyebrow: 'Start from anything',
  title: 'Start from what you already have.',
  sub: "Each gives you the visual, headline, copy and CTA together, in your brand's colours, fonts and tone.",
  items: [
    { title: 'A product link', body: 'Paste a product page. SkalX reads the product, price and reviews.' },
    { title: 'A photo of your product', body: 'Upload one photo. SkalX builds the scene and the ad around it.' },
    { title: 'A rough idea', body: 'Type the offer or the message. SkalX turns it into finished ads.' },
  ],
} as const;

export const PLATFORMS = {
  eyebrow: 'Sized for every platform',
  title: 'Export-ready for every place you sell.',
  sub: 'Every ad comes in the right size for where it will run.',
  items: [
    { name: 'Instagram', sizes: 'Feed, story, reel' },
    { name: 'Facebook', sizes: 'Feed, story' },
    { name: 'YouTube Shorts', sizes: 'Vertical video' },
    { name: 'Google Display', sizes: 'Banner sizes' },
    { name: 'WhatsApp Status', sizes: 'Vertical image and video' },
    { name: 'Amazon & Flipkart', sizes: 'Listing images' },
  ],
  prefix: 'Export-ready for',
} as const;

export const HOW_IT_WORKS = {
  eyebrow: 'How it works',
  title: 'From product link to launch, in four steps.',
  steps: [
    { title: 'Paste your product link', body: 'Or upload a product photo.' },
    { title: 'SkalX researches', body: 'Your brand, your customers and your competitors.' },
    { title: 'Get a test pack', body: 'A set of ads, each with the angle it tests.' },
    { title: 'Edit, download, launch', body: 'Change anything, then post or run the ads yourself.' },
  ],
} as const;

export const DONE_FOR_YOU = {
  eyebrow: 'Done-for-you Studio',
  title: "Rather not do it yourself? We'll make it for you.",
  sub: 'Our studio uses SkalX to research, plan and deliver your month of ads. You just approve.',
  bullets: ['A monthly content plan', 'Posters, carousels and videos delivered', 'Revisions included'],
  cta: 'Talk to the studio',
} as const;

export const FOUNDER_FALLBACK = {
  eyebrow: 'From the founder',
  cta: 'Book a 15-min call with the founder',
} as const;

export const PRICING_TEASER = {
  eyebrow: 'Pricing',
  title: 'Simple plans. Pick self-serve or done-for-you.',
  toggle: { selfServe: 'Self-serve', doneForYou: 'Done-for-you' },
  seeAll: 'See full pricing',
} as const;

export const FAQ_TITLE = { eyebrow: 'FAQ', title: 'Questions founders ask.' } as const;

/** Answers that depend on feature status are filled in by getHomeFaqs(). */
export const FAQS_BASE = [
  {
    q: 'What are credits?',
    a: 'Credits are how plans measure what you make. One image credit makes one poster or photo. Video credits depend on length: a 15-second video uses 300 video credits.',
  },
  {
    q: 'How is SkalX different from Canva or ChatGPT?',
    a: 'Those tools make what you ask for. SkalX first studies your brand, competitors and customers, works out what to say and why, then makes the ads. Every ad comes with the finding it is based on.',
  },
  { q: 'Do I need design skills?', a: 'No. SkalX makes finished ads in your brand style. You can edit text, colours and layout if you want to.' },
  { q: 'Can I use the ads commercially?', a: 'Yes. You own what you make and can use it anywhere.' },
  {
    q: 'Which platforms are the ads sized for?',
    a: 'Instagram, Facebook, YouTube Shorts, Google Display, WhatsApp Status, and Amazon and Flipkart listings. You download the files and post them yourself.',
  },
  { q: 'Which languages are supported?', a: 'English for now. More languages are on the way.' },
  {
    q: 'Is there a free trial?',
    a: 'Start with a free brand audit: paste your website and get findings, angles to test and a sample ad. You can also request a free trial; we review each request.',
  },
  {
    q: "What's the done-for-you studio?",
    a: 'Our team uses SkalX to research your market, plan your month and make your ads. You approve the plan and the content. Plans are custom; talk to the studio.',
  },
  {
    q: 'Do you connect to my ad accounts?',
    a: 'Yes. Connect Meta (Facebook and Instagram), Google, TikTok and LinkedIn ads. SkalX reads your results and shows your ROAS, ROI and cost per sale, which ads are working and what to do next. It only reads; it never changes or runs your ads.',
  },
  { q: 'How do I cancel?', a: 'Plans are monthly. Cancel anytime from Plans & Purchases in your account; you keep access until the end of the month you paid for.' },
] as const;

export const FINAL_CTA = {
  title: 'Stop guessing what to post. Find out what your market wants.',
  primary: 'Get your free brand audit',
  secondary: 'Book a demo',
} as const;

/** Free brand audit form (hero and final band). */
export const AUDIT_FORM = {
  urlLabel: 'Your website',
  urlPlaceholder: 'yourbrand.com',
  emailLabel: 'Work email',
  emailPlaceholder: 'you@yourbrand.com',
  categoryLabel: 'Category',
  categories: ['Skincare & beauty', 'Food & spices', 'Health & wellness', 'Fashion & accessories', 'Home & living', 'Other'],
  next: 'Continue',
  submit: 'Get my free audit',
  submitting: 'Starting your audit…',
  note: 'One free audit per email. No card needed.',
  privacy: 'We use your email to send your audit and follow up. No spam.',
} as const;
