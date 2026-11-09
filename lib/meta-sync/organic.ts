/**
 * Organic sync: Instagram media and Facebook Page posts from the last 90 days, plus
 * their lifetime insights snapshotted once per sync day.
 * Metric names keep changing (impressions → views, post_impressions_* retired at v26),
 * so each request tries a metric set and falls back to smaller sets if Meta rejects it.
 */
import { graphCall, graphGetAll, MetaGraphError } from '@/lib/meta/graph';
import { decryptToken } from '@/lib/meta/crypto';
import * as store from './store';
import { toNum } from './metrics';
import { bump, recordError, type SyncContext } from './context';

const MAX_POSTS = 100;
const LOOKBACK_DAYS = 90;

/** Tried in order; first set Meta accepts wins (per media type). */
export const IG_METRIC_SETS = [
  ['views', 'reach', 'likes', 'comments', 'saved', 'shares', 'total_interactions'],
  ['reach', 'likes', 'comments', 'saved', 'shares'],
  ['reach'],
];
export const FB_POST_METRIC_SETS = [
  ['post_media_view', 'post_total_media_view_unique', 'post_clicks', 'post_reactions_by_type_total'],
  ['post_clicks', 'post_reactions_by_type_total'],
];

type InsightValue = { name: string; values?: { value: unknown }[]; total_value?: { value: unknown } };

/** Flatten an insights response into { metric: number }; object values (reactions by type) are summed. */
export function flattenInsights(data: InsightValue[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of data ?? []) {
    const raw = m.total_value?.value ?? m.values?.[0]?.value;
    if (raw && typeof raw === 'object') {
      out[m.name] = Object.values(raw as Record<string, unknown>).reduce<number>((s, v) => s + (toNum(v) ?? 0), 0);
    } else {
      const n = toNum(raw);
      if (n !== null) out[m.name] = n;
    }
  }
  return out;
}

async function insightsWithFallback(ctx: SyncContext, objectId: string, token: string, sets: string[][], cache: Map<string, number>, cacheKey: string) {
  const startAt = cache.get(cacheKey) ?? 0;
  for (let i = startAt; i < sets.length; i++) {
    try {
      const res = await graphCall<{ data?: InsightValue[] }>(`${objectId}/insights`, token, { metric: sets[i].join(',') }, { ...ctx.graph, attempts: 2 });
      cache.set(cacheKey, i);
      return flattenInsights(res.data);
    } catch (err) {
      const invalidMetric = err instanceof MetaGraphError && (err.code === 100 || err.code === 10);
      if (!invalidMetric) throw err;
    }
  }
  cache.set(cacheKey, sets.length);
  return {};
}

const cutoffIso = () => new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

export async function syncInstagram(ctx: SyncContext, igId: string, today: string) {
  const media = await graphGetAll<Record<string, any>>(`${igId}/media`, ctx.token, {
    fields: 'id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
    limit: 50,
  }, { ...ctx.graph, maxPages: 4 });
  const cutoff = cutoffIso();
  const recent = media.filter((m) => !m.timestamp || m.timestamp >= cutoff).slice(0, MAX_POSTS);
  await store.upsertOrganicPosts(ctx.connectionId, recent.map((m) => ({
    platform: 'instagram' as const, accountMetaId: igId, metaId: String(m.id),
    mediaType: m.media_product_type === 'REELS' ? 'REEL' : m.media_type ?? null,
    caption: m.caption ?? null, permalink: m.permalink ?? null,
    thumbnailUrl: m.thumbnail_url ?? (m.media_type === 'IMAGE' || m.media_type === 'CAROUSEL_ALBUM' ? m.media_url : null) ?? null,
    postedAt: m.timestamp ? new Date(m.timestamp).toISOString() : null, raw: m,
  })));
  bump(ctx, 'ig_posts', recent.length);

  const cache = new Map<string, number>();
  const rows: store.OrganicInsightRow[] = [];
  for (const m of recent) {
    try {
      const metrics = await insightsWithFallback(ctx, String(m.id), ctx.token, IG_METRIC_SETS, cache, String(m.media_product_type ?? m.media_type));
      rows.push({
        postMetaId: String(m.id), date: today,
        views: metrics.views ?? null, reach: metrics.reach ?? null,
        likes: metrics.likes ?? toNum(m.like_count), comments: metrics.comments ?? toNum(m.comments_count),
        saves: metrics.saved ?? null, shares: metrics.shares ?? null, interactions: metrics.total_interactions ?? null, metrics,
      });
    } catch (err) {
      recordError(ctx, 'ig_insights', err);
    }
  }
  const igWritten = await store.upsertOrganicInsights(ctx.connectionId, rows);
  bump(ctx, 'ig_insight_rows', igWritten);
  // Post stats feed the post-only analysis (brands without ad spend); it skips itself when nothing changed.
  if (igWritten > 0) ctx.dataChanged = true;
}

export async function syncPage(ctx: SyncContext, pageId: string, pageTokenEnc: string | null, today: string) {
  const token = pageTokenEnc ? decryptToken(pageTokenEnc) : ctx.token;
  const since = Math.floor((Date.now() - LOOKBACK_DAYS * 86_400_000) / 1000);
  let posts: Record<string, any>[];
  try {
    posts = await graphGetAll<Record<string, any>>(`${pageId}/posts`, token, {
      fields: 'id,message,created_time,permalink_url,full_picture,status_type,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)',
      since, limit: 50,
    }, { ...ctx.graph, maxPages: 4 });
  } catch (err) {
    // comments.summary can need pages_read_user_content; retry without engagement edges.
    if (!(err instanceof MetaGraphError) || err.code !== 10 && err.code !== 100 && err.code !== 200) throw err;
    posts = await graphGetAll<Record<string, any>>(`${pageId}/posts`, token, {
      fields: 'id,message,created_time,permalink_url,full_picture,status_type,shares', since, limit: 50,
    }, { ...ctx.graph, maxPages: 4 });
  }
  posts = posts.slice(0, MAX_POSTS);
  await store.upsertOrganicPosts(ctx.connectionId, posts.map((p) => ({
    platform: 'facebook' as const, accountMetaId: pageId, metaId: String(p.id), mediaType: p.status_type ?? null,
    caption: p.message ?? null, permalink: p.permalink_url ?? null, thumbnailUrl: p.full_picture ?? null,
    postedAt: p.created_time ? new Date(p.created_time).toISOString() : null, raw: p,
  })));
  bump(ctx, 'fb_posts', posts.length);

  const cache = new Map<string, number>();
  const rows: store.OrganicInsightRow[] = [];
  for (const p of posts) {
    try {
      const metrics = await insightsWithFallback(ctx, String(p.id), token, FB_POST_METRIC_SETS, cache, 'post');
      rows.push({
        postMetaId: String(p.id), date: today,
        views: metrics.post_media_view ?? null, reach: metrics.post_total_media_view_unique ?? null,
        likes: metrics.post_reactions_by_type_total ?? toNum(p.reactions?.summary?.total_count),
        comments: toNum(p.comments?.summary?.total_count), saves: null, shares: toNum(p.shares?.count),
        interactions: null, metrics,
      });
    } catch (err) {
      recordError(ctx, 'fb_post_insights', err);
    }
  }
  const fbWritten = await store.upsertOrganicInsights(ctx.connectionId, rows);
  bump(ctx, 'fb_insight_rows', fbWritten);
  // Post stats feed the post-only analysis (brands without ad spend); it skips itself when nothing changed.
  if (fbWritten > 0) ctx.dataChanged = true;
}
