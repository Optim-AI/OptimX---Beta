/**
 * Builds the compact JSON summary the AI model interprets, plus the ad images to show it.
 * Numbers come from the same SQL + scoring the dashboard uses, so the AI and the
 * dashboard always agree.
 */
import { createHash } from 'crypto';
import { sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { buildDashboard, type DashboardPayload, type LeaderboardAd } from './summary';
import { getUserBrand } from '@/lib/brand-kit/server';
import { getBrandResearch } from '@/lib/research/store';
import { metaLog } from '@/lib/meta/log';

export const ANALYSIS_RANGE_DAYS = 30 as const;
/** Posts are fewer than ad results, so the post-only analysis looks further back. */
export const POSTS_RANGE_DAYS = 90 as const;
export const PROMPT_VERSION = 'meta-insights-v2';
const MIN_POSTS = 2;
const MAX_POSTS = 30;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;

const cut = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null);

export type AnalysisImage = { adId: string; label: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string };

/** 'ads': ad results (and posts) from the last 30 days. 'posts': no ad spend, so organic posts only. */
export type AnalysisMode = 'ads' | 'posts';

export type AnalysisInput = {
  mode: AnalysisMode;
  rangeDays: number;
  period: { since: string; until: string };
  json: Record<string, unknown>;
  hash: string;
  images: AnalysisImage[];
  /** ids the output may reference: ad ids (ads mode) or post ids (posts mode). */
  adIds: Set<string>;
  /** Posts mode: a readable name per post id, swapped in wherever the model writes a raw id. */
  labels?: Map<string, string>;
};

function adSummary(a: LeaderboardAd) {
  return {
    ad_id: a.adId,
    name: a.name,
    status: a.score.status,
    fatiguing: a.score.fatiguing,
    made_by_skalx: a.madeBySkalx,
    delivery: a.status,
    headline: cut(a.headline, 120),
    primary_text: cut(a.primaryText, 220),
    spend: a.spend,
    purchases: a.purchases,
    revenue: a.revenue,
    roas: a.roas,
    cost_per_purchase: a.cpa,
    ctr_pct: a.ctr,
    frequency: a.frequency,
    cost_per_purchase_vs_account_pct: a.score.cpaVsAvgPct,
    roas_vs_account_pct: a.score.roasVsAvgPct,
    rule_reasons: a.score.reasons,
  };
}

/** Rank judged ads best → worst using the strongest signal the account has. */
export function rankAds(d: DashboardPayload): LeaderboardAd[] {
  const judged = d.ads.filter((a) => a.score.status !== 'not_enough_data');
  const key = d.averages.roas !== null ? 'roas' : d.averages.cpa !== null ? 'cpa' : 'ctr';
  return [...judged].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return key === 'cpa' ? av - bv : bv - av;
  });
}

async function loadImage(a: LeaderboardAd, label: string, fetchImpl: typeof fetch): Promise<AnalysisImage | null> {
  if (!a.thumbnailUrl) return null;
  try {
    const res = await fetchImpl(a.thumbnailUrl);
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!res.ok || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) return null;
    return { adId: a.adId, label, mediaType: type as AnalysisImage['mediaType'], data: buf.toString('base64') };
  } catch (err) {
    metaLog.warn('analysis_image_failed', { adId: a.adId, message: (err as Error).message });
    return null;
  }
}

async function brandContext(userId: string) {
  const [{ snapshot }, research] = await Promise.all([
    getUserBrand(userId).catch(() => ({ snapshot: null })),
    getBrandResearch(userId).catch(() => null),
  ]);
  return {
    brand: snapshot ? {
      name: snapshot.name, industry: snapshot.industry ?? null, offering: cut(snapshot.offering, 200), audience: cut(snapshot.audience, 200),
      tone: cut(snapshot.tone, 120), value_prop: cut(snapshot.coreValueProp, 160),
    } : null,
    competitors: research?.competitors?.slice(0, 4).map((c) => ({
      name: c.name, positioning: cut(c.positioning, 160), strength: cut(c.strength, 120), weakness: cut(c.weakness, 120),
    })) ?? [],
    customer_voice: research ? {
      their_words: research.customer_voice?.their_words?.slice(0, 6) ?? [],
      desires: research.customer_voice?.desires?.slice(0, 3).map((i) => i.insight) ?? [],
      frustrations: research.customer_voice?.frustrations?.slice(0, 3).map((i) => i.insight) ?? [],
    } : null,
  };
}

/** Ads first; with no ad spend, fall back to the brand's Facebook and Instagram posts. */
export async function buildAnalysisInput(userId: string, deps: { fetchImpl?: typeof fetch } = {}): Promise<AnalysisInput | null> {
  const d = await buildDashboard(userId, ANALYSIS_RANGE_DAYS);
  if (d.state !== 'ready') return null;
  if (d.dataState === 'empty' || !d.hasAdAccounts) return d.hasOrganicAccounts ? buildPostsInput(userId, deps) : null;

  const ranked = rankAds(d);
  const top = ranked.slice(0, 5);
  const bottom = ranked.slice(5).slice(-5).reverse();
  const fatigue = d.ads.filter((a) => a.score.fatiguing).slice(0, 5);

  const context = await brandContext(userId);

  const json: Record<string, unknown> = {
    analysis: 'ads',
    period: { days: d.range, since: d.period.since, until: d.period.until, compared_with: d.previousPeriod },
    currency: d.currency,
    data_state: d.dataState,
    account: { ...d.kpis, change_vs_previous_pct: d.deltas },
    account_averages: { cost_per_purchase: d.averages.cpa, roas: d.averages.roas, ctr_pct: d.averages.ctr },
    rules: {
      min_spend_to_judge: d.scoringMinSpend,
      winner: 'cost per purchase at least 20% below average, or ROAS at least 20% above',
      losing: 'cost per purchase at least 30% above average',
      fatiguing: 'click rate down 25%+ week on week while frequency is above 3 and rising',
    },
    ads_judged: ranked.length,
    ads_total: d.ads.length,
    top_ads: top.map(adSummary),
    bottom_ads: bottom.map(adSummary),
    fatigue: fatigue.map((a) => ({
      ad_id: a.adId, name: a.name, ctr_last_7_days_pct: a.score.ctrLast7, ctr_previous_7_days_pct: a.score.ctrPrev7,
      ctr_change_pct: a.score.ctrChangePct, frequency_last_7_days: a.score.frequencyLast7, frequency_previous_7_days: a.score.frequencyPrev7,
    })),
    skalx_vs_others: d.comparison.ready ? d.comparison : null,
    organic_top_posts: d.organic.slice(0, 5).map((p) => ({
      platform: p.platform, type: p.mediaType, caption: cut(p.caption, 160), likes: p.likes, comments: p.comments,
      saves: p.saves, shares: p.shares, views: p.views, reach: p.reach, engagement: p.engagement,
    })),
    ...context,
  };

  const hash = createHash('sha256').update(PROMPT_VERSION).update(JSON.stringify(json)).digest('hex');

  const fetchImpl = deps.fetchImpl ?? fetch;
  const wanted = [...top.map((a) => ({ a, label: 'top ad' })), ...bottom.map((a) => ({ a, label: 'bottom ad' }))].slice(0, MAX_IMAGES);
  const images = (await Promise.all(wanted.map(({ a, label }) => loadImage(a, label, fetchImpl)))).filter((x): x is AnalysisImage => !!x);

  const adIds = new Set(d.ads.map((a) => a.adId));
  return { mode: 'ads', rangeDays: ANALYSIS_RANGE_DAYS, period: { since: d.period.since, until: d.period.until }, json, hash, images, adIds };
}

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const pctVs = (v: number | null, base: number | null) => (v === null || !base ? null : r0(((v - base) / base) * 100));

/** When in the day a post went out, in India time (no numbers, so nothing for the AI to misquote). */
function partOfDay(iso: string): { day: string; time: string } {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  const h = d.getUTCHours();
  return {
    day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()],
    time: h < 6 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night',
  };
}

/** Facebook reports a post's status_type (added_photos…); show it like Instagram's media types. */
const FB_TYPES: Record<string, string> = { added_photos: 'PHOTO', added_video: 'VIDEO', mobile_status_update: 'TEXT', shared_story: 'LINK', published_story: 'POST', created_event: 'EVENT' };
const postType = (t: string | null) => (t ? FB_TYPES[t] ?? t.toUpperCase() : null);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** e.g. Instagram reel “test reel” (13 Oct) — how the owner would recognise the post. */
function postLabel(p: { platform: string; type: string | null; caption: string | null; posted_at: string }): string {
  const d = new Date(new Date(p.posted_at).getTime() + 330 * 60_000);
  const kind = (p.type ?? 'post').toLowerCase().replace(/_/g, ' ').replace('carousel album', 'carousel');
  const cap = p.caption?.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, 30);
  const when = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  // Without a caption, the time of day tells same-day posts apart.
  return `${p.platform === 'instagram' ? 'Instagram' : 'Facebook'} ${kind}${cap ? ` “${cap}” (${when})` : ` (${when}, ${partOfDay(p.posted_at).time})`}`;
}

export type PostRow = {
  post_id: string; platform: 'instagram' | 'facebook'; type: string | null; caption: string | null; thumbnail_url: string | null; posted_at: string;
  views: number | null; reach: number | null; likes: number | null; comments: number | null; saves: number | null; shares: number | null; engagement: number;
};

/** The connection's posts from the last 90 days with their latest stats (newest first). */
export async function loadRecentPosts(connectionId: string): Promise<{ since: string; until: string; posts: PostRow[] }> {
  const until = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - POSTS_RANGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const res = await db.execute(sql`
    select p.meta_id, p.platform, p.media_type, p.caption, p.thumbnail_url, p.posted_at,
      s.views, s.reach, s.likes, s.comments, s.saves, s.shares, s.interactions
    from meta_organic_posts p
    left join lateral (
      select * from meta_organic_post_insights_daily s
      where s.connection_id = p.connection_id and s.post_meta_id = p.meta_id
      order by s.date desc limit 1
    ) s on true
    where p.connection_id = ${connectionId} and p.posted_at >= ${since}::date
    order by p.posted_at desc
    limit ${MAX_POSTS}`);
  const raw = ((res as unknown as { rows?: Record<string, unknown>[] }).rows ?? (res as unknown as Record<string, unknown>[]));
  const posts: PostRow[] = raw.map((r) => {
    const likes = numOrNull(r.likes), comments = numOrNull(r.comments), saves = numOrNull(r.saves), shares = numOrNull(r.shares);
    return {
      post_id: String(r.meta_id), platform: r.platform as PostRow['platform'], type: postType(r.media_type as string | null),
      caption: (r.caption as string) ?? null, thumbnail_url: (r.thumbnail_url as string) ?? null,
      posted_at: new Date(r.posted_at as string).toISOString(),
      views: numOrNull(r.views), reach: numOrNull(r.reach), likes, comments, saves, shares,
      engagement: r.interactions != null ? Number(r.interactions) : (likes ?? 0) + (comments ?? 0) + (saves ?? 0) + (shares ?? 0),
    };
  });
  return { since, until, posts };
}

export type PostStatRow = { label: string; posts: number; avgEngagement: number };
export type PostStats = {
  platform: 'instagram' | 'facebook';
  posts: number;
  avgEngagement: number;
  byFormat: PostStatRow[];
  byDay: PostStatRow[];
  byTime: PostStatRow[];
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIMES = ['morning', 'afternoon', 'evening', 'night'];

/** Average engagements per post by format, weekday and time of day, per platform (never mixed). */
export function postStats(posts: PostRow[]): PostStats[] {
  const group = (ps: PostRow[], key: (p: PostRow) => string, order?: string[]): PostStatRow[] => {
    const m = new Map<string, number[]>();
    for (const p of ps) m.set(key(p), [...(m.get(key(p)) ?? []), p.engagement]);
    const rows = [...m].map(([label, es]) => ({ label, posts: es.length, avgEngagement: r1(es.reduce((a, b) => a + b, 0) / es.length) }));
    return order ? rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : rows.sort((a, b) => b.avgEngagement - a.avgEngagement);
  };
  return (['instagram', 'facebook'] as const).flatMap((platform) => {
    const ps = posts.filter((p) => p.platform === platform);
    if (!ps.length) return [];
    return [{
      platform, posts: ps.length,
      avgEngagement: r1(ps.reduce((a, p) => a + p.engagement, 0) / ps.length),
      byFormat: group(ps, (p) => (p.type ?? 'post').toLowerCase().replace(/_/g, ' ').replace('carousel album', 'carousel')),
      byDay: group(ps, (p) => partOfDay(p.posted_at).day, DAYS),
      byTime: group(ps, (p) => partOfDay(p.posted_at).time, TIMES),
    }];
  });
}

/** Organic-only analysis: the last 90 days of posts, ranked against the brand's own averages. */
async function buildPostsInput(userId: string, deps: { fetchImpl?: typeof fetch }): Promise<AnalysisInput | null> {
  const conn = await MetaConnectionDAO.getByUser(userId);
  if (!conn) return null;
  const { since, until, posts } = await loadRecentPosts(conn.id);
  if (posts.length < MIN_POSTS) return null;

  // Averages per platform: posts are compared with their own platform, never across.
  const platforms = [...new Set(posts.map((p) => p.platform))];
  const averages = Object.fromEntries(platforms.map((pl) => {
    const ps = posts.filter((p) => p.platform === pl);
    const e = avg(ps.map((p) => p.engagement));
    const v = avg(ps.flatMap((p) => (p.views !== null ? [p.views] : [])));
    const rc = avg(ps.flatMap((p) => (p.reach ? [p.reach] : [])));
    return [pl, { posts: ps.length, engagement: e === null ? null : r1(e), views: v === null ? null : r1(v), reach: rc === null ? null : r1(rc) }];
  }));
  const byType = platforms.flatMap((pl) => {
    const types = [...new Set(posts.filter((p) => p.platform === pl).map((p) => p.type ?? 'unknown'))];
    return types.map((t) => {
      const ps = posts.filter((p) => p.platform === pl && (p.type ?? 'unknown') === t);
      const e = avg(ps.map((p) => p.engagement));
      const v = avg(ps.flatMap((p) => (p.views !== null ? [p.views] : [])));
      return { platform: pl, type: t, posts: ps.length, avg_engagement: e === null ? null : r1(e), avg_views: v === null ? null : r1(v) };
    });
  });
  const labels = new Map(posts.map((p) => [p.post_id, postLabel(p)]));
  const summary = (p: PostRow) => {
    const base = averages[p.platform] as { engagement: number | null; views: number | null };
    return {
      post_id: p.post_id, name: labels.get(p.post_id), platform: p.platform, type: p.type, caption: cut(p.caption, 200), posted: partOfDay(p.posted_at), posted_on: p.posted_at.slice(0, 10),
      views: p.views, reach: p.reach, likes: p.likes, comments: p.comments, saves: p.saves, shares: p.shares, engagement: p.engagement,
      engagement_vs_platform_avg_pct: pctVs(p.engagement, base.engagement),
      views_vs_platform_avg_pct: pctVs(p.views, base.views),
    };
  };
  const ranked = [...posts].sort((a, b) => {
    const ea = pctVs(a.engagement, (averages[a.platform] as { engagement: number | null }).engagement) ?? 0;
    const eb = pctVs(b.engagement, (averages[b.platform] as { engagement: number | null }).engagement) ?? 0;
    return eb - ea;
  });

  const json: Record<string, unknown> = {
    analysis: 'posts',
    note: 'There is no ad spend in this period, so this analysis is about organic Facebook and Instagram posts only.',
    period: { days: POSTS_RANGE_DAYS, since, until },
    platform_averages: averages,
    by_type: byType,
    posts_total: posts.length,
    posts: ranked.map(summary),
    ...(await brandContext(userId)),
  };
  const hash = createHash('sha256').update(PROMPT_VERSION).update(JSON.stringify(json)).digest('hex');

  const fetchImpl = deps.fetchImpl ?? fetch;
  const wanted = [...ranked.slice(0, 3).map((p) => ({ p, label: 'top post' })), ...ranked.slice(3).slice(-3).map((p) => ({ p, label: 'weaker post' }))];
  const images = (await Promise.all(wanted.map(({ p, label }) => loadImage(
    { adId: p.post_id, thumbnailUrl: p.thumbnail_url } as LeaderboardAd, label, fetchImpl,
  )))).filter((x): x is AnalysisImage => !!x);

  return { mode: 'posts', rangeDays: POSTS_RANGE_DAYS, period: { since, until }, json, hash, images, adIds: new Set(posts.map((p) => p.post_id)), labels };
}

