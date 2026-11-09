/** Trends shapes shared by server and browser (no runtime deps). */

export type TrendKind = 'viral_moment' | 'meme_format' | 'news' | 'festival_event' | 'sport_entertainment' | 'shopping' | 'video';
export type TrendStage = 'rising' | 'peaking' | 'fading' | 'upcoming';
export type TrendSource = { title: string; url: string };

export type Trend = {
  id: string;
  title: string;
  /** What it is, in one or two plain sentences. */
  what: string;
  /** Why it's trending now. */
  whyNow: string;
  kind: TrendKind;
  /** SkalX's estimate from the sources' dates and wording, shown as an estimate. */
  stage: TrendStage;
  /** e.g. "this week", "12–14 Nov" — as the sources put it. */
  when: string | null;
  platforms: string[];
  /** Real links the trend was found in (Google Search grounding or YouTube). Never written by the AI. */
  sources: TrendSource[];
  thumbnailUrl?: string | null;
};

export type TrendFit = 'high' | 'medium' | 'low';
export type IdeaFormat = 'poster' | 'reel' | 'story' | 'post';

export type TrendIdea = {
  format: IdeaFormat;
  /** The first line people see. */
  hook: string;
  /** What the poster or video shows. */
  show: string;
  /** For reels/stories: 3-5 short beats. */
  script: string[];
};

export type BrandTrend = Trend & {
  fit: TrendFit;
  fitReason: string;
  ideas: TrendIdea[];
};

export type TrendsResponse = {
  state: 'none' | 'running' | 'ready' | 'failed';
  category: string | null;
  updatedAt: string | null;
  day: string | null;
  trends: BrandTrend[];
  /** Trends checked but left out (not a fit, or not safe for brands). */
  skipped: number;
  error: string | null;
  refreshesLeftToday: number;
};
