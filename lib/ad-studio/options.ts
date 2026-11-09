/** Goals and formats the owner picks (browser-safe). */
export type AdFormat = 'feed_4x5' | 'square_1x1' | 'story_9x16' | 'wide_191x1';

export const AD_FORMATS: Record<AdFormat, { aspect: '4:5' | '1:1' | '9:16' | '1.91:1'; label: string; where: string; recommended?: boolean }> = {
  feed_4x5: { aspect: '4:5', label: 'Feed post', where: 'Instagram and Facebook feed', recommended: true },
  square_1x1: { aspect: '1:1', label: 'Square post', where: 'Feed, works everywhere' },
  story_9x16: { aspect: '9:16', label: 'Story / Reels', where: 'Stories and Reels, full screen' },
  wide_191x1: { aspect: '1.91:1', label: 'Wide', where: 'Facebook feed links and right column' },
};
export const AD_FORMAT_KEYS = Object.keys(AD_FORMATS) as AdFormat[];
export const isAdFormat = (v: unknown): v is AdFormat => typeof v === 'string' && v in AD_FORMATS;

export type AdGoal = 'sell_more' | 'launch' | 'offer' | 'festive' | 'before_after' | 'awareness' | 'reviews';

/** Owner-facing goals → the poster engine's ad goal + the research focus line. */
export const AD_GOALS: Record<AdGoal, { label: string; hint: string; engineGoal: 'feature' | 'launch' | 'offer' | 'festive' | 'before_after' | 'awareness' | 'social_proof'; focus: string; needsOffer?: boolean; needsReviews?: boolean }> = {
  sell_more: { label: 'Sell more', hint: 'Show what it does and why it’s worth buying', engineGoal: 'feature', focus: 'drive purchases by showing what the product does and why it is worth buying' },
  launch: { label: 'Launch something new', hint: 'Announce a new product or flavour', engineGoal: 'launch', focus: 'announce a new product and make people want to try it first' },
  offer: { label: 'Run an offer', hint: 'A discount, combo or free gift', engineGoal: 'offer', focus: 'promote a real, time-bound offer', needsOffer: true },
  festive: { label: 'Festive / seasonal', hint: 'Diwali, Pongal, Onam, Eid, Christmas…', engineGoal: 'festive', focus: 'tie the product to the current festival or season' },
  before_after: { label: 'Before & after', hint: 'Show the change it makes', engineGoal: 'before_after', focus: 'show the visible difference before and after using the product' },
  awareness: { label: 'Get known', hint: 'Introduce the brand to new people', engineGoal: 'awareness', focus: 'introduce the brand to people who have never heard of it' },
  reviews: { label: 'Customer reviews', hint: 'Use what real customers say', engineGoal: 'social_proof', focus: 'build trust with what real customers say', needsReviews: true },
};
export const AD_GOAL_KEYS = Object.keys(AD_GOALS) as AdGoal[];
export const isAdGoal = (v: unknown): v is AdGoal => typeof v === 'string' && v in AD_GOALS;
