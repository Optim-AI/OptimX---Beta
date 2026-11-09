/** Plain arithmetic on Instagram's own numbers: no AI, no estimates. */
import type { AccountStats, FormatShare, HashtagStats, IgPost } from './types';
import type { DiscoveredAccount } from './api';

const r1 = (n: number) => Math.round(n * 10) / 10;
/** Below this many followers an engagement rate is noise (1 like on 1 follower = 100%). */
export const MIN_FOLLOWERS_FOR_RATE = 100;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const engagement = (p: IgPost) => (p.likes ?? 0) + (p.comments ?? 0);

export function formatOf(p: IgPost): FormatShare['format'] {
  if (p.mediaType === 'CAROUSEL_ALBUM') return 'Carousel';
  if (p.mediaType === 'VIDEO' || p.productType === 'REELS' || p.productType === 'REEL') return 'Reels / video';
  return 'Photo';
}

export function formatMix(posts: IgPost[]): FormatShare[] {
  const order: FormatShare['format'][] = ['Reels / video', 'Photo', 'Carousel'];
  return order.flatMap((format) => {
    const ps = posts.filter((p) => formatOf(p) === format);
    if (!ps.length) return [];
    const withCounts = ps.filter((p) => p.likes !== null || p.comments !== null);
    const e = avg(withCounts.map(engagement));
    return [{ format, posts: ps.length, pct: Math.round((ps.length / posts.length) * 100), avgEngagement: e === null ? null : r1(e) }];
  });
}

/** Posts per week across the time the sampled posts span (at least one week). */
export function postsPerWeek(posts: IgPost[]): number | null {
  const times = posts.map((p) => (p.timestamp ? Date.parse(p.timestamp) : NaN)).filter(Number.isFinite).sort((a, b) => a - b);
  if (times.length < 2) return null;
  const weeks = Math.max((times[times.length - 1] - times[0]) / (7 * 86_400_000), 1);
  return r1(times.length / weeks);
}

export function accountStats(a: DiscoveredAccount, opts: { isYou?: boolean } = {}): AccountStats {
  const counted = a.posts.filter((p) => p.likes !== null || p.comments !== null);
  const likes = avg(a.posts.flatMap((p) => (p.likes === null ? [] : [p.likes])));
  const comments = avg(a.posts.flatMap((p) => (p.comments === null ? [] : [p.comments])));
  const perPost = avg(counted.map(engagement));
  return {
    username: a.username, name: a.name, biography: a.biography, profilePictureUrl: a.profilePictureUrl, website: a.website,
    followers: a.followers, totalPosts: a.totalPosts, sampled: a.posts.length,
    postsPerWeek: postsPerWeek(a.posts),
    avgLikes: likes === null ? null : r1(likes),
    avgComments: comments === null ? null : r1(comments),
    engagementRatePct: perPost !== null && a.followers && a.followers >= MIN_FOLLOWERS_FOR_RATE ? r1((perPost / a.followers) * 100) : null,
    formats: formatMix(a.posts),
    topPosts: [...counted].sort((x, y) => engagement(y) - engagement(x)).slice(0, 3),
    posts: a.posts,
    ...(opts.isYou ? { isYou: true } : {}),
  };
}

export function hashtagStats(hashtag: string, top: IgPost[], recent: IgPost[]): HashtagStats {
  const likes = avg(top.flatMap((p) => (p.likes === null ? [] : [p.likes])));
  const comments = avg(top.flatMap((p) => (p.comments === null ? [] : [p.comments])));
  return {
    hashtag,
    topCount: top.length,
    last24h: recent.length,
    last24hCapped: recent.length >= 50,
    avgLikes: likes === null ? null : r1(likes),
    avgComments: comments === null ? null : r1(comments),
    formats: formatMix(top),
    topPosts: [...top].sort((x, y) => engagement(y) - engagement(x)).slice(0, 9),
  };
}
