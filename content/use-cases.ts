/**
 * SEO use-case pages: /ai-ad-maker/[slug]. Each page needs unique copy (400+ words),
 * its own example angles and its own FAQ. Example angles are illustrations, labelled as such.
 * No invented numbers or results.
 */

export type UseCase = {
  slug: string;
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  title: string;
  intro: string[];
  researchTitle: string;
  research: { title: string; body: string }[];
  anglesTitle: string;
  angles: { finding: string; angle: string; format: string; headline: string }[];
  stepsTitle: string;
  steps: string[];
  closing: string;
  faqs: { q: string; a: string }[];
};

export const USE_CASES: UseCase[] = [
  {
    slug: 'skincare-brands',
    seoTitle: 'AI ad maker for skincare brands',
    seoDescription:
      'Make skincare ads that answer what buyers actually doubt: skin type, ingredients, results. SkalX researches your reviews and competitors, then makes the ads.',
    eyebrow: 'AI ad maker for skincare brands',
    title: 'Skincare ads that answer the doubt before the buyer scrolls away.',
    intro: [
      'Skincare buyers are careful. Before they buy, they want to know if a product suits their skin type, what is in it, how long it takes to show results and whether it will break them out. Most skincare ads skip all of that and lead with a pretty bottle and a discount. Those ads look like every other brand in the feed, so people scroll past.',
      'SkalX works the other way round. It reads your product pages, your reviews and the ads your competitors are running, and pulls out the questions buyers keep asking. Then it turns each question into an ad angle and makes the posters, videos and UGC-style ads to test it. Every ad comes with the finding it answers, so you know why you are running it.',
    ],
    researchTitle: 'What SkalX looks for in skincare',
    research: [
      { title: 'Skin-type doubts', body: 'Oily, dry, sensitive, acne-prone: which skin types your reviewers mention, and where they hesitate.' },
      { title: 'Ingredient questions', body: 'Which actives people ask about, and which claims competitors lean on, so you can be specific where they are vague.' },
      { title: 'Texture and climate', body: 'Comments about stickiness, white cast or heaviness, which matter a lot in humid Indian summers.' },
      { title: 'Long-running competitor ads', body: 'Public competitor ads that have run for weeks, and what they lead with: offer, ingredient, routine or before/after.' },
    ],
    anglesTitle: 'Example angles for a skincare brand',
    angles: [
      { finding: 'Reviewers with oily skin ask if a moisturiser will feel greasy.', angle: 'Show it on oily skin in real humidity.', format: 'UGC video, 15s', headline: 'Oily skin? Still never greasy.' },
      { finding: 'Competitors list ingredients but never explain them.', angle: 'One active, one job, in plain words.', format: 'Carousel', headline: 'Niacinamide, explained in 4 slides.' },
      { finding: 'Buyers worry about routines with too many steps.', angle: 'A full routine in under a minute.', format: 'Story ad', headline: 'Three steps. Done before chai.' },
    ],
    stepsTitle: 'How to start',
    steps: [
      'Paste your website or a product page.',
      'SkalX researches your reviews, competitors and category.',
      'Pick an angle and get a test pack of ads for it.',
      'Edit, download and post, or run them as ads.',
    ],
    closing:
      'Skincare is a trust category. The brands that win explain clearly and show proof. SkalX helps you find the doubt worth answering this week, and makes the ad that answers it.',
    faqs: [
      { q: 'Can SkalX make before/after skincare ads?', a: 'SkalX can design before/after layouts using your own photos. Use real, consented images and follow advertising rules for your claims; SkalX does not invent results.' },
      { q: 'Will the ads use my real product?', a: 'Yes. Upload your product photos and SkalX builds the scene around them, so the bottle, label and colours stay yours.' },
      { q: 'Does SkalX write ingredient claims?', a: 'It writes copy from what is on your product page and in your reviews. Check claims against your own product data before you publish.' },
    ],
  },
  {
    slug: 'food-and-spice-brands',
    seoTitle: 'AI ad maker for food and spice brands',
    seoDescription:
      'Ads for food, snack and spice brands that sell taste, freshness and trust. SkalX reads your reviews and competitors, then makes posters and videos to match.',
    eyebrow: 'AI ad maker for food & spice brands',
    title: 'Make people taste it through the screen.',
    intro: [
      'Food is bought with the eyes first, but it is re-bought because of trust: is it fresh, is it authentic, is it what my family will eat? Spice and snack brands compete with grocery staples and with dozens of new D2C labels, and most of their ads look the same: a product shot, a price and a festive border.',
      'SkalX starts by finding what your buyers actually say. It reads your reviews for words like fresh, homemade, too spicy or not like my mother’s, checks what competitors are running and where they are silent, and turns those findings into angles. Then it makes the posters, carousels and short videos for each one, in your brand colours, so every ad has a reason behind it.',
      'This matters most in a category where buyers are loyal once they trust you. A first order often comes from one clear reason: a taste memory, a cleaner ingredient list, a pack that fits a small kitchen. Find that reason, say it plainly, and test it in two or three formats before you spend on the rest of the month.',
    ],
    researchTitle: 'What SkalX looks for in food and spices',
    research: [
      { title: 'Taste and authenticity', body: 'How buyers describe the taste, and whether they compare it to home cooking or a region.' },
      { title: 'Freshness and packaging', body: 'Mentions of aroma, shelf life, pouch quality or leaks, which often decide a repeat order.' },
      { title: 'Usage moments', body: 'When people use the product: breakfast, tiffin, festive cooking, gifting.' },
      { title: 'Competitor gaps', body: 'Public competitor ads, and the angles they ignore, such as sourcing or recipes.' },
    ],
    anglesTitle: 'Example angles for a food brand',
    angles: [
      { finding: 'Reviewers say the masala tastes “like home”.', angle: 'Lead with a family recipe, not the pack.', format: 'Product video, 15s', headline: 'The Sunday sambar, in one spoon.' },
      { finding: 'Competitors never show where the spices come from.', angle: 'Show the farm-to-pouch journey.', format: 'Carousel', headline: 'From Guntur fields to your kitchen.' },
      { finding: 'Buyers ask how to use the product.', angle: 'Turn each pack into a 3-step recipe.', format: 'Story ad', headline: 'Dinner in 15 minutes. Here’s how.' },
    ],
    stepsTitle: 'How to start',
    steps: [
      'Paste your website or marketplace listing.',
      'SkalX reads your reviews and the category’s public ads.',
      'Choose the angles to test and get a pack of ads.',
      'Download in every size you need, from Instagram to Amazon listings.',
    ],
    closing:
      'In food, the story behind the product sells as much as the product. SkalX finds the story your buyers already tell, and makes the ads that tell it back.',
    faqs: [
      { q: 'Can SkalX make recipe-style ads?', a: 'Yes. It can turn a product into step-by-step recipe carousels and short videos, using your product photos.' },
      { q: 'Does it make ads for Amazon and Flipkart listings?', a: 'SkalX exports images sized for marketplace listings. You upload them to your seller account yourself.' },
      { q: 'Can I make festive food ads?', a: 'Yes. Plan Diwali, Pongal, Onam or Ramzan campaigns ahead, with angles drawn from how buyers gift and cook during the season.' },
    ],
  },
  {
    slug: 'instagram-ads',
    seoTitle: 'AI Instagram ad maker',
    seoDescription:
      'Make Instagram feed, story and reel ads with a reason behind each one. SkalX researches your market, finds the angle, then makes the ads in every Instagram size.',
    eyebrow: 'AI Instagram ad maker',
    title: 'Instagram ads that stop the scroll for a reason.',
    intro: [
      'On Instagram, you have about a second to earn attention. Generic AI tools are good at making something that looks like an ad. They are bad at deciding what the ad should say. That is why so many AI-made Instagram ads look polished and still get scrolled past: they answer nobody’s question.',
      'SkalX decides what to say first. It studies your brand, the public ads your competitors are running and what your customers write in reviews and comments. It turns the strongest findings into angles, then makes feed posts, stories, reels-style videos and carousels sized for Instagram. Each ad carries the finding it is built on, so you can test with intent instead of hoping.',
      'Testing with intent also makes your results easier to read. When each ad tests one idea, a winner tells you something you can use again: which doubt matters, which benefit lands, which format your buyers stop for. Over a few weeks that becomes your own playbook for Instagram, instead of a folder of ads that may or may not have worked.',
    ],
    researchTitle: 'What SkalX checks before making an Instagram ad',
    research: [
      { title: 'The hook', body: 'The first line or frame, built from a real customer phrase or objection.' },
      { title: 'The format', body: 'Feed, story, carousel or reel-style video, chosen for what the angle needs to show.' },
      { title: 'The competition', body: 'What similar brands are running now, so your ad looks and sounds different.' },
      { title: 'The offer', body: 'Whether to lead with proof, story or price, based on what your buyers respond to.' },
    ],
    anglesTitle: 'Example Instagram angles',
    angles: [
      { finding: 'Comments keep asking “does it really work?”.', angle: 'A 15s proof clip in the first frame.', format: 'Reel-style video', headline: 'Day 1 vs day 14. Same light.' },
      { finding: 'Competitors all run discount stories.', angle: 'Lead with the product’s one clear benefit.', format: 'Story ad', headline: 'No sale. Just the best version.' },
      { finding: 'Buyers save posts that teach something.', angle: 'A swipeable how-to.', format: 'Carousel', headline: '5 mistakes we see every day.' },
    ],
    stepsTitle: 'How to start',
    steps: [
      'Paste your website or Instagram product link.',
      'SkalX researches your market and suggests angles.',
      'Get feed, story and video versions of each angle.',
      'Download and post, or run them as ads from your own account.',
    ],
    closing:
      'Good Instagram ads are not louder. They are more relevant. SkalX finds what your audience is already thinking about, and makes the ad that speaks to it.',
    faqs: [
      { q: 'Does SkalX post to Instagram for me?', a: 'No. You download the files and post or run them from your own Instagram or Meta account.' },
      { q: 'Which Instagram sizes does it make?', a: 'Feed (4:5 and 1:1), story (9:16) and vertical video for reels.' },
      { q: 'Can I match my existing Instagram look?', a: 'Yes. SkalX uses your brand colours, fonts and tone, and you can edit any ad before downloading.' },
    ],
  },
  {
    slug: 'product-video-ads',
    seoTitle: 'AI product video ad maker',
    seoDescription:
      'Make 15s and 30s product video ads from your product photos, built around the angle your market cares about. No shoot day needed.',
    eyebrow: 'AI product video ad maker',
    title: 'Product video ads, without the shoot day.',
    intro: [
      'Video ads usually mean a shoot: a studio, a crew, a day of production and a week of editing. For most D2C brands that is too slow and too costly to do every month, so they run the same video until it stops working.',
      'SkalX makes 15-second and 30-second product video ads from your product photos. But the video is the last step, not the first. SkalX first works out what the video should say: the customer doubt to answer, the benefit to prove or the moment to show. Then it plans the scenes, writes the lines and makes the video in vertical format, so each version tests one clear idea.',
      'Because each video is built from one angle, you can make several versions and see which idea earns attention, rather than spending a month’s budget on a single expensive film. When an angle works, make more videos around it; when it does not, move to the next finding. The research stays with you, so every new video starts from what you already learned.',
    ],
    researchTitle: 'What goes into a SkalX video ad',
    research: [
      { title: 'The angle', body: 'One finding per video, from your reviews or competitor gaps, so the message is clear.' },
      { title: 'The opening', body: 'A first scene built to earn the next few seconds.' },
      { title: 'Your product', body: 'Your real product photos, placed into scenes that suit the angle.' },
      { title: 'The ending', body: 'A clear call to action and end card in your brand style.' },
    ],
    anglesTitle: 'Example video angles',
    angles: [
      { finding: 'Buyers doubt a bottle will survive travel.', angle: 'Show it packed, shaken and opened.', format: 'Product video, 15s', headline: 'Packed for Goa. Not a drop lost.' },
      { finding: 'Reviews praise how fast it works.', angle: 'A morning routine, start to finish.', format: 'Product video, 30s', headline: '7:00 to 7:05, done.' },
      { finding: 'Competitors only show the product on white.', angle: 'Show it in use, at home.', format: 'Vertical video, 15s', headline: 'Where it actually lives.' },
    ],
    stepsTitle: 'How to start',
    steps: [
      'Upload product photos or paste a product link.',
      'SkalX researches and suggests the angle for each video.',
      'Get 15s or 30s vertical videos, one per angle.',
      'Review, ask for changes, then download.',
    ],
    closing:
      'A video that says the right thing beats a beautiful video that says nothing. SkalX finds the right thing, then makes the video.',
    faqs: [
      { q: 'How long are the videos?', a: 'SkalX makes 15-second and 30-second product video ads. Video credits depend on length: a 15-second video uses 300 video credits.' },
      { q: 'Do I need to film anything?', a: 'No. SkalX builds the video from your product photos.' },
      { q: 'Can I add a voiceover?', a: 'Videos can include an English voiceover. More languages are on the way.' },
      { q: 'Can I make one video per angle?', a: 'Yes. That is the point: make a short video for each angle you want to test, then put more budget behind the one that works.' },
    ],
  },
  {
    slug: 'diwali-ads',
    seoTitle: 'AI Diwali ad maker',
    seoDescription:
      'Plan and make Diwali ads that stand out from the festive noise: gifting angles, offer posters and short videos, built from what your buyers want this season.',
    eyebrow: 'AI Diwali ad maker',
    title: 'Diwali ads that don’t look like everyone else’s Diwali ads.',
    intro: [
      'Every brand runs a Diwali campaign, and most of them look alike: diyas, gold borders, a percentage off. In a feed full of identical festive posters, the ad that wins is the one that understands why this buyer is shopping right now: a gift for a boss, a hamper for family, a treat after a long year.',
      'SkalX plans your Diwali ads from research, not templates. It looks at how your buyers talk about gifting and festive use in reviews, what competitors ran last season and this season, and where the gaps are. Then it suggests angles, gifting, value, tradition or convenience, and makes the posters, carousels and videos for each one, so you can launch early and test which message lands before the big days.',
      'Launching early is the real advantage. Ad costs rise as the festival gets closer and every brand competes for the same people. If you already know which angle works from a small early test, you can put the bulk of your festive budget behind it in the final week, instead of guessing at the most expensive moment of the year.',
    ],
    researchTitle: 'What SkalX looks at for Diwali',
    research: [
      { title: 'Gifting language', body: 'How buyers describe giving your product, and to whom.' },
      { title: 'Last season’s ads', body: 'Public competitor ads from the festive season, and which ran longest.' },
      { title: 'Offer fatigue', body: 'Whether your category is crowded with discounts, so you can lead with something else.' },
      { title: 'Timing', body: 'A plan from early teasers to last-minute gifting, so you are not designing on Dhanteras.' },
    ],
    anglesTitle: 'Example Diwali angles',
    angles: [
      { finding: 'Reviews mention buying the product as a gift.', angle: 'Sell the finished gift, not the item.', format: 'Feed poster', headline: 'Gift-wrapped. Ready by Dhanteras.' },
      { finding: 'The category is flooded with flat-discount posters.', angle: 'Lead with meaning, not the markdown.', format: 'Product video, 15s', headline: 'For the people who light up your year.' },
      { finding: 'Buyers worry about late festive delivery.', angle: 'Make the delivery promise the hero.', format: 'Story ad', headline: 'Order by the 25th. Home before the lamps.' },
    ],
    stepsTitle: 'How to start',
    steps: [
      'Paste your website and choose Diwali as the moment.',
      'SkalX researches gifting angles and competitor festive ads.',
      'Get a test pack: early teasers, gifting ads and last-minute offers.',
      'Download every size and schedule your festive calendar.',
    ],
    closing:
      'Diwali rewards brands that plan early and say something different. SkalX gives you the angles and the ads weeks before the rush.',
    faqs: [
      { q: 'When should I start Diwali ads?', a: 'Start testing angles a few weeks before Dhanteras, so you know which message works before the busiest days.' },
      { q: 'Can SkalX make other festive campaigns?', a: 'Yes: Pongal, Onam, Holi, Raksha Bandhan, Big Billion Days, Black Friday and more.' },
      { q: 'Can I keep my brand look in festive ads?', a: 'Yes. Festive ads use your brand colours, fonts and tone, with seasonal touches rather than a generic template.' },
    ],
  },
];

export function getUseCase(slug: string): UseCase | undefined {
  return USE_CASES.find((u) => u.slug === slug);
}

/** Rough word count of a use case's copy (used to keep pages above the 400-word floor). */
export function useCaseWordCount(u: UseCase): number {
  const text = [
    u.title,
    ...u.intro,
    ...u.research.flatMap((r) => [r.title, r.body]),
    ...u.angles.flatMap((a) => [a.finding, a.angle, a.headline]),
    ...u.steps,
    u.closing,
    ...u.faqs.flatMap((f) => [f.q, f.a]),
  ].join(' ');
  return text.split(/\s+/).filter(Boolean).length;
}
