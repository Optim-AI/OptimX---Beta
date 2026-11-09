/** Instagram watch shapes shared by server and browser (no runtime deps). */

export type IgPost = {
  id: string;
  caption: string | null;
  mediaType: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string;
  /** REEL / FEED when Meta says so (accounts only). */
  productType: string | null;
  /** Missing for albums and some reels (Meta withholds it); show a placeholder then. */
  imageUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
};

export type FormatShare = { format: 'Reels / video' | 'Photo' | 'Carousel'; posts: number; pct: number; avgEngagement: number | null };

export type AccountStats = {
  username: string;
  name: string | null;
  biography: string | null;
  profilePictureUrl: string | null;
  website: string | null;
  followers: number | null;
  totalPosts: number | null;
  /** Over the recent posts SkalX read. */
  sampled: number;
  postsPerWeek: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  /** (likes + comments) ÷ followers, per post, in %. */
  engagementRatePct: number | null;
  formats: FormatShare[];
  topPosts: IgPost[];
  posts: IgPost[];
  isYou?: boolean;
};

export type HashtagStats = {
  hashtag: string;
  /** Top posts Meta returned (the same ranking as Instagram's "Top" tab). */
  topCount: number;
  /** Public posts in the last 24 hours (capped at 50 by Meta's page size). */
  last24h: number | null;
  last24hCapped: boolean;
  avgLikes: number | null;
  avgComments: number | null;
  formats: FormatShare[];
  topPosts: IgPost[];
};

export type WatchItem<T> = {
  id: string;
  value: string;
  data: T | null;
  fetchedAt: string | null;
  error: string | null;
};

export type StyleRead = {
  summary: string;
  competitors: { username: string; style: string; what_works: string[]; borrow: string }[];
  ideas: { hook: string; show: string; format: 'reel' | 'post' | 'carousel' | 'story' }[];
};

export type InstagramView = {
  connected: boolean;
  igUsername: string | null;
  you: AccountStats | null;
  hashtags: WatchItem<HashtagStats>[];
  accounts: WatchItem<AccountStats>[];
  hashtagQuota: { used: number; limit: number; metaLimit: number };
  limits: { hashtags: number; accounts: number };
  style: { output: StyleRead; createdAt: string; dropped: number } | null;
  styleReadsLeftToday: number;
};
