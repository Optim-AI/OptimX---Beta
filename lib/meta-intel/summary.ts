/**
 * Builds the Meta Intelligence dashboard payload for one user. Server-only.
 * Everything is aggregated in SQL over the ad accounts the user linked, in the
 * primary account's currency (accounts in other currencies are left out and flagged).
 */
import { sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { todayInTz } from '@/lib/meta-sync/dates';
import { activeRun } from '@/lib/meta-sync/store';
import { CREATIVE_BUCKET } from '@/lib/meta-sync/images';
import { metaLog } from '@/lib/meta/log';
import { addDays } from '@/lib/meta-sync/dates';
import { scoreAd, minSpendThreshold, type AdScore, type AccountAverages } from './scoring';
import {
  type RangeDays, type Sums, type Kpis, type DailyPoint, type DataState,
  periods, deriveKpis, compareKpis, fillDaily, comparisonReady, dataState, emptySums, minSpendFor,
} from './kpis';

export type LeaderboardAd = {
  adId: string;
  name: string | null;
  campaignName: string | null;
  status: string | null;
  madeBySkalx: boolean;
  skxReason: string | null;
  headline: string | null;
  primaryText: string | null;
  thumbnailUrl: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  purchases: number | null;
  revenue: number | null;
  roas: number | null;
  cpa: number | null;
  frequency: number | null;
  score: AdScore;
};

export type ComparisonSide = Kpis & { ads: number };

export type OrganicPost = {
  postId: string;
  platform: 'instagram' | 'facebook';
  mediaType: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  postedAt: string | null;
  views: number | null;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  engagement: number;
};

export type DashboardPayload = {
  state: 'not_connected' | 'needs_selection' | 'syncing' | 'reconnect' | 'ready';
  range: RangeDays;
  period: { since: string; until: string };
  previousPeriod: { since: string; until: string };
  currency: string | null;
  timezone: string | null;
  mixedCurrency: boolean;
  excludedAccounts: string[];
  hasAdAccounts: boolean;
  hasOrganicAccounts: boolean;
  dataState: DataState;
  minSpend: number;
  lastSyncAt: string | null;
  syncing: boolean;
  needsReconnect: boolean;
  kpis: Kpis;
  previousKpis: Kpis;
  averages: AccountAverages;
  scoringMinSpend: number;
  deltas: Record<keyof Kpis, number | null>;
  trend: DailyPoint[];
  ads: LeaderboardAd[];
  comparison: { ready: boolean; skalx: ComparisonSide | null; others: ComparisonSide | null };
  organic: OrganicPost[];
};

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Revenue per row: action_values revenue, else Meta ROAS × spend. */
const REV = sql.raw(`coalesce(i.revenue, case when i.roas_source = 'meta' then i.roas * i.spend end)`);

function sumsFrom(row: Record<string, unknown> | undefined): Sums {
  if (!row) return emptySums();
  return {
    spend: num(row.spend), revenue: num(row.revenue), revenueRows: num(row.revenue_rows),
    purchases: num(row.purchases), purchaseRows: num(row.purchase_rows), clicks: num(row.clicks), impressions: num(row.impressions),
  };
}

const SUMS_SELECT = sql`
  coalesce(sum(i.spend), 0) as spend,
  coalesce(sum(${REV}), 0) as revenue,
  count(${REV}) as revenue_rows,
  coalesce(sum(i.purchases), 0) as purchases,
  count(i.purchases) as purchase_rows,
  coalesce(sum(i.clicks), 0) as clicks,
  coalesce(sum(i.impressions), 0) as impressions`;

async function rows<T = Record<string, unknown>>(q: ReturnType<typeof sql>): Promise<T[]> {
  const res = await db.execute(q);
  return (res as unknown as { rows: T[] }).rows;
}

async function signThumbnails(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  try {
    const { supabaseAdmin } = await import('@/auth/supabase/admin');
    const { data, error } = await supabaseAdmin.storage.from(CREATIVE_BUCKET).createSignedUrls(paths, 60 * 60);
    if (error) throw error;
    for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  } catch (err) {
    metaLog.warn('thumbnail_signing_failed', { message: (err as Error).message });
  }
  return out;
}

function emptyPayload(state: DashboardPayload['state'], range: RangeDays, today: string, extra: Partial<DashboardPayload> = {}): DashboardPayload {
  const p = periods(range, today);
  const k = deriveKpis(emptySums());
  return {
    state, range, period: p.current, previousPeriod: p.previous, currency: null, timezone: null, mixedCurrency: false,
    excludedAccounts: [], hasAdAccounts: false, hasOrganicAccounts: false, dataState: 'empty', minSpend: minSpendFor(null), lastSyncAt: null, syncing: false, needsReconnect: false,
    kpis: k, previousKpis: k, averages: { cpa: null, roas: null, ctr: null }, scoringMinSpend: minSpendFor(null), deltas: compareKpis(k, k), trend: fillDaily([], p.current), ads: [],
    comparison: { ready: false, skalx: null, others: null }, organic: [], ...extra,
  };
}

/** `until` (YYYY-MM-DD, account timezone) ends the period on a past day — the Monday brief uses last Sunday. */
export async function buildDashboard(userId: string, range: RangeDays, opts: { until?: string } = {}): Promise<DashboardPayload> {
  const conn = await MetaConnectionDAO.getByUser(userId);
  if (!conn) return emptyPayload('not_connected', range, todayInTz('Asia/Kolkata'));
  if (conn.status === 'pending') return emptyPayload('needs_selection', range, todayInTz('Asia/Kolkata'));

  const assets = await MetaConnectionDAO.listAssets(userId);
  const accounts = assets.filter((a) => a.kind === 'ad_account' && a.selected);
  const primary = accounts[0] ?? null;
  const currency = primary?.currency ?? null;
  const timezone = primary?.timezoneName ?? 'Asia/Kolkata';
  const included = accounts.filter((a) => !currency || !a.currency || a.currency === currency).map((a) => a.metaId);
  const excluded = accounts.filter((a) => !included.includes(a.metaId)).map((a) => a.name || a.metaId);
  const today = opts.until ?? todayInTz(timezone);
  const { current, previous } = periods(range, today);
  const running = await activeRun(conn.id);
  const needsReconnect = conn.status === 'expired' || conn.status === 'revoked' || conn.status === 'error';

  const acctList = included.length ? included : ['__none__'];
  const acctArray = sql`array[${sql.join(acctList.map((a) => sql`${a}`), sql`, `)}]::text[]`;
  const base = sql`i.connection_id = ${conn.id} and i.ad_account_id = any(${acctArray})`;

  // KPIs for both periods in one pass
  const kpiRows = await rows(sql`
    select (i.date >= ${current.since}::date) as is_current, ${SUMS_SELECT}
    from meta_ad_insights_daily i
    where ${base} and i.date between ${previous.since}::date and ${current.until}::date
    group by 1`);
  const curSums = sumsFrom(kpiRows.find((r) => r.is_current === true));
  const prevSums = sumsFrom(kpiRows.find((r) => r.is_current === false));
  const kpis = deriveKpis(curSums);
  const previousKpis = deriveKpis(prevSums);

  const anyRow = await rows<{ n: number }>(sql`select count(*)::int as n from meta_ad_insights_daily i where ${base}`);
  const hasAnyData = (anyRow[0]?.n ?? 0) > 0;

  const trendRows = await rows(sql`
    select to_char(i.date, 'YYYY-MM-DD') as date, sum(i.spend) as spend, sum(${REV}) as revenue
    from meta_ad_insights_daily i
    where ${base} and i.date between ${current.since}::date and ${current.until}::date
    group by i.date order by i.date`);

  const adRows = await rows(sql`
    select i.ad_meta_id, ${SUMS_SELECT},
      sum(i.frequency * i.impressions) filter (where i.frequency is not null)
        / nullif(sum(i.impressions) filter (where i.frequency is not null), 0) as frequency,
      max(a.name) as name, max(a.effective_status) as status, bool_or(coalesce(a.made_by_skalx, false)) as made_by_skalx,
      max(a.skx_reason) as skx_reason, max(c.name) as campaign_name,
      max(cr.title) as headline, max(cr.body) as primary_text, max(cr.stored_path) as stored_path
    from meta_ad_insights_daily i
    left join meta_ads a on a.connection_id = i.connection_id and a.meta_id = i.ad_meta_id
    left join meta_campaigns c on c.connection_id = i.connection_id and c.meta_id = i.campaign_meta_id
    left join meta_creatives cr on cr.connection_id = i.connection_id and cr.meta_id = a.creative_meta_id
    where ${base} and i.date between ${current.since}::date and ${current.until}::date
    group by i.ad_meta_id
    having sum(i.spend) > 0 or sum(i.impressions) > 0
    order by sum(i.spend) desc
    limit 200`);
  // Last 7 days vs the 7 before (fatigue), always ending today regardless of the selected range.
  const l7Since = addDays(today, -6);
  const p7Since = addDays(today, -13);
  const p7Until = addDays(today, -7);
  const weekRows = await rows(sql`
    select i.ad_meta_id,
      coalesce(sum(i.impressions) filter (where i.date >= ${l7Since}::date), 0) as imp_l7,
      coalesce(sum(i.clicks) filter (where i.date >= ${l7Since}::date), 0) as clk_l7,
      sum(i.frequency * i.impressions) filter (where i.date >= ${l7Since}::date and i.frequency is not null)
        / nullif(sum(i.impressions) filter (where i.date >= ${l7Since}::date and i.frequency is not null), 0) as freq_l7,
      coalesce(sum(i.impressions) filter (where i.date <= ${p7Until}::date), 0) as imp_p7,
      coalesce(sum(i.clicks) filter (where i.date <= ${p7Until}::date), 0) as clk_p7,
      sum(i.frequency * i.impressions) filter (where i.date <= ${p7Until}::date and i.frequency is not null)
        / nullif(sum(i.impressions) filter (where i.date <= ${p7Until}::date and i.frequency is not null), 0) as freq_p7
    from meta_ad_insights_daily i
    where ${base} and i.date between ${p7Since}::date and ${today}::date
    group by i.ad_meta_id`);
  const weeks = new Map(weekRows.map((w) => [String(w.ad_meta_id), w]));
  // Account averages over the whole period (all ads, not just the 200 shown).
  const averages: AccountAverages = { cpa: kpis.cpa, roas: kpis.roas, ctr: kpis.ctr };

  const signed = await signThumbnails(adRows.map((r) => r.stored_path as string).filter(Boolean));
  const ads: LeaderboardAd[] = adRows.map((r) => {
    const sums = sumsFrom(r);
    const k = deriveKpis(sums);
    const w = weeks.get(String(r.ad_meta_id));
    const score = scoreAd({
      adId: String(r.ad_meta_id), spend: sums.spend, impressions: sums.impressions, clicks: sums.clicks,
      purchases: sums.purchaseRows > 0 ? sums.purchases : null, revenue: sums.revenueRows > 0 ? sums.revenue : null,
      last7: { impressions: num(w?.imp_l7), clicks: num(w?.clk_l7), frequency: numOrNull(w?.freq_l7) },
      prev7: { impressions: num(w?.imp_p7), clicks: num(w?.clk_p7), frequency: numOrNull(w?.freq_p7) },
    }, averages, currency);
    return {
      score,
      adId: String(r.ad_meta_id), name: (r.name as string) ?? null, campaignName: (r.campaign_name as string) ?? null,
      status: (r.status as string) ?? null, madeBySkalx: r.made_by_skalx === true, skxReason: (r.skx_reason as string) ?? null,
      headline: (r.headline as string) ?? null, primaryText: (r.primary_text as string) ?? null,
      thumbnailUrl: r.stored_path ? signed.get(r.stored_path as string) ?? null : null,
      spend: k.spend, impressions: num(r.impressions), clicks: num(r.clicks), ctr: k.ctr, purchases: k.purchases,
      revenue: k.revenue, roas: k.roas, cpa: k.cpa, frequency: r.frequency != null ? r2(Number(r.frequency)) : null,
    };
  });

  const cmpRows = await rows(sql`
    select coalesce(a.made_by_skalx, false) as skx, count(distinct i.ad_meta_id)::int as ads, ${SUMS_SELECT}
    from meta_ad_insights_daily i
    left join meta_ads a on a.connection_id = i.connection_id and a.meta_id = i.ad_meta_id
    where ${base} and i.date between ${current.since}::date and ${current.until}::date
    group by 1`);
  const skxRow = cmpRows.find((r) => r.skx === true);
  const otherRow = cmpRows.find((r) => r.skx === false);
  const skxSums = skxRow ? sumsFrom(skxRow) : null;
  const otherSums = otherRow ? sumsFrom(otherRow) : null;
  const ready = comparisonReady(skxSums, otherSums, currency);

  // Organic: posts published in the period, latest metrics snapshot, ranked by engagement.
  const organicRows = await rows(sql`
    select p.meta_id, p.platform, p.media_type, p.caption, p.permalink, p.thumbnail_url, p.posted_at,
      s.views, s.reach, s.likes, s.comments, s.saves, s.shares, s.interactions
    from meta_organic_posts p
    left join lateral (
      select * from meta_organic_post_insights_daily s
      where s.connection_id = p.connection_id and s.post_meta_id = p.meta_id
      order by s.date desc limit 1
    ) s on true
    where p.connection_id = ${conn.id} and p.posted_at >= (${current.since}::date - interval '1 day')
    order by coalesce(s.interactions, coalesce(s.likes,0) + coalesce(s.comments,0) + coalesce(s.saves,0) + coalesce(s.shares,0)) desc nulls last,
      p.posted_at desc
    limit 6`);
  const organic: OrganicPost[] = organicRows.map((r) => ({
    postId: String(r.meta_id), platform: r.platform as 'instagram' | 'facebook', mediaType: (r.media_type as string) ?? null,
    caption: (r.caption as string) ?? null, permalink: (r.permalink as string) ?? null, thumbnailUrl: (r.thumbnail_url as string) ?? null,
    postedAt: r.posted_at ? new Date(r.posted_at as string).toISOString() : null,
    views: numOrNull(r.views), reach: numOrNull(r.reach), likes: numOrNull(r.likes), comments: numOrNull(r.comments),
    saves: numOrNull(r.saves), shares: numOrNull(r.shares),
    engagement: r.interactions != null ? num(r.interactions) : num(r.likes) + num(r.comments) + num(r.saves) + num(r.shares),
  }));

  const state: DashboardPayload['state'] = needsReconnect && !hasAnyData
    ? 'reconnect'
    : !hasAnyData && running ? 'syncing' : 'ready';

  return {
    state, range, period: current, previousPeriod: previous, currency, timezone,
    mixedCurrency: excluded.length > 0, excludedAccounts: excluded, hasAdAccounts: accounts.length > 0,
    hasOrganicAccounts: assets.some((a) => (a.kind === 'page' || a.kind === 'ig_account') && a.selected),
    dataState: dataState(curSums, currency), minSpend: minSpendFor(currency), lastSyncAt: conn.lastSyncAt, syncing: !!running, needsReconnect,
    kpis, previousKpis, averages, scoringMinSpend: minSpendThreshold(currency, averages.cpa), deltas: compareKpis(kpis, previousKpis),
    trend: fillDaily(trendRows.map((r) => ({ date: String(r.date), spend: num(r.spend), revenue: numOrNull(r.revenue) })), current),
    ads,
    comparison: {
      ready,
      skalx: ready && skxRow ? { ...deriveKpis(skxSums!), ads: num(skxRow.ads) } : null,
      others: ready && otherRow ? { ...deriveKpis(otherSums!), ads: num(otherRow.ads) } : null,
    },
    organic,
  };
}
