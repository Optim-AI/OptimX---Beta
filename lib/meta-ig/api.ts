/**
 * Instagram public data through the Graph API (Facebook Login token of the connected brand):
 *  - Business Discovery: another Business/Creator account's public profile and recent posts
 *    (needs instagram_basic, instagram_manage_insights, pages_read_engagement).
 *  - Hashtag Search: top posts and last-24h posts for a hashtag
 *    (needs instagram_basic + the "Instagram Public Content Access" feature;
 *     30 unique hashtags per Instagram account per rolling 7 days).
 */
import { graphCall, MetaGraphError } from '@/lib/meta/graph';
import type { IgPost } from './types';

type RawMedia = {
  id: string; caption?: string; media_type?: string; media_product_type?: string; media_url?: string; thumbnail_url?: string;
  permalink?: string; timestamp?: string; like_count?: number; comments_count?: number; view_count?: number;
};

export function toPost(m: RawMedia): IgPost {
  return {
    id: String(m.id),
    caption: m.caption ? m.caption.slice(0, 600) : null,
    mediaType: m.media_type ?? 'IMAGE',
    productType: m.media_product_type ?? null,
    // Videos give a thumbnail; albums and some reels give nothing (Meta withholds media_url).
    imageUrl: m.media_type === 'VIDEO' ? (m.thumbnail_url ?? null) : (m.media_url ?? m.thumbnail_url ?? null),
    permalink: m.permalink ?? null,
    timestamp: m.timestamp ?? null,
    likes: typeof m.like_count === 'number' ? m.like_count : null,
    comments: typeof m.comments_count === 'number' ? m.comments_count : null,
    views: typeof m.view_count === 'number' ? m.view_count : null,
  };
}

/** Instagram usernames: letters, numbers, dots, underscores; up to 30. */
export function cleanUsername(v: string): string | null {
  const u = v.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0].toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(u) ? u : null;
}

/** Hashtags: letters/numbers/underscore (any script), no emoji (Meta doesn't support them). */
export function cleanHashtag(v: string): string | null {
  const h = v.trim().replace(/^#/, '').toLowerCase();
  return /^[\p{L}\p{N}_]{2,60}$/u.test(h) ? h : null;
}

const MEDIA_FIELDS_FULL = 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,view_count';
const MEDIA_FIELDS_SAFE = 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count';

export type DiscoveredAccount = {
  username: string; name: string | null; biography: string | null; profilePictureUrl: string | null; website: string | null;
  followers: number | null; totalPosts: number | null; posts: IgPost[];
};

export class IgLookupError extends Error {
  constructor(message: string, readonly reason: 'not_found' | 'not_business' | 'limit' | 'permission' | 'other') {
    super(message);
  }
}

function explain(err: unknown, what: string): never {
  const e = err as MetaGraphError;
  const msg = (e?.message ?? '').toLowerCase();
  if (e?.code === 110 || /cannot be found|does not exist|invalid user id/.test(msg)) throw new IgLookupError(`Instagram couldn’t find ${what}. Check the spelling.`, 'not_found');
  if (/business|creator/.test(msg)) throw new IgLookupError(`${what} isn’t a public business or creator account, so Instagram doesn’t share its stats.`, 'not_business');
  if (e?.code === 10 || e?.code === 200 || /permission/.test(msg)) throw new IgLookupError('Instagram didn’t allow this lookup. Reconnect Meta in Settings → Integrations.', 'permission');
  if (/limit/.test(msg)) throw new IgLookupError('Instagram’s limit for this was reached. Try again later.', 'limit');
  throw new IgLookupError(`Instagram couldn’t load ${what} right now.`, 'other');
}

export async function discoverAccount(igUserId: string, token: string, username: string, mediaLimit = 18): Promise<DiscoveredAccount> {
  const profile = 'username,name,biography,profile_picture_url,website,followers_count,media_count';
  const ask = (mediaFields: string) => graphCall<{ business_discovery?: Record<string, any> }>(igUserId, token, {
    fields: `business_discovery.username(${username}){${profile},media.limit(${mediaLimit}){${mediaFields}}}`,
  }, { attempts: 2 });
  let res: { business_discovery?: Record<string, any> };
  try {
    res = await ask(MEDIA_FIELDS_FULL);
  } catch (err) {
    // Older or stricter API versions reject some media fields: retry with the documented core set.
    if ((err as MetaGraphError)?.code === 100 && !/username|business/i.test((err as Error).message)) {
      try { res = await ask(MEDIA_FIELDS_SAFE); } catch (e2) { explain(e2, `@${username}`); }
    } else explain(err, `@${username}`);
  }
  const b = res.business_discovery;
  if (!b) throw new IgLookupError(`Instagram didn’t return @${username}.`, 'not_found');
  return {
    username: b.username ?? username,
    name: b.name ?? null,
    biography: b.biography ?? null,
    profilePictureUrl: b.profile_picture_url ?? null,
    website: b.website ?? null,
    followers: typeof b.followers_count === 'number' ? b.followers_count : null,
    totalPosts: typeof b.media_count === 'number' ? b.media_count : null,
    posts: ((b.media?.data ?? []) as RawMedia[]).map(toPost),
  };
}

export async function hashtagPosts(igUserId: string, token: string, hashtag: string): Promise<{ top: IgPost[]; recent: IgPost[] }> {
  let id: string | undefined;
  try {
    const found = await graphCall<{ data?: { id: string }[] }>('ig_hashtag_search', token, { user_id: igUserId, q: hashtag }, { attempts: 2 });
    id = found.data?.[0]?.id;
  } catch (err) {
    explain(err, `#${hashtag}`);
  }
  if (!id) throw new IgLookupError(`Instagram has no posts for #${hashtag}.`, 'not_found');
  const fields = 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count';
  const [top, recent] = await Promise.all([
    graphCall<{ data?: RawMedia[] }>(`${id}/top_media`, token, { user_id: igUserId, fields, limit: 30 }, { attempts: 2 }).catch((e) => explain(e, `#${hashtag}`)),
    graphCall<{ data?: RawMedia[] }>(`${id}/recent_media`, token, { user_id: igUserId, fields: 'id,timestamp', limit: 50 }, { attempts: 2 }).catch(() => ({ data: undefined })),
  ]);
  return { top: (top.data ?? []).map(toPost), recent: (recent.data ?? []).map(toPost) };
}
