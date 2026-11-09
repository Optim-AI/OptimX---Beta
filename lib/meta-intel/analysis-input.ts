/**
 * Builds the compact JSON summary Claude interprets, plus the ad images to show it.
 * Numbers come from the same SQL + scoring the dashboard uses, so the AI and the
 * dashboard always agree.
 */
import { createHash } from 'crypto';
import { buildDashboard, type DashboardPayload, type LeaderboardAd } from './summary';
import { getUserBrand } from '@/lib/brand-kit/server';
import { getBrandResearch } from '@/lib/research/store';
import { metaLog } from '@/lib/meta/log';

export const ANALYSIS_RANGE_DAYS = 30 as const;
export const PROMPT_VERSION = 'meta-insights-v1';
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024;

const cut = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null);

export type AnalysisImage = { adId: string; label: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string };

export type AnalysisInput = {
  json: Record<string, unknown>;
  hash: string;
  images: AnalysisImage[];
  adIds: Set<string>;
  dashboard: DashboardPayload;
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

export async function buildAnalysisInput(userId: string, deps: { fetchImpl?: typeof fetch } = {}): Promise<AnalysisInput | null> {
  const d = await buildDashboard(userId, ANALYSIS_RANGE_DAYS);
  if (d.state !== 'ready' || d.dataState === 'empty' || !d.hasAdAccounts) return null;

  const ranked = rankAds(d);
  const top = ranked.slice(0, 5);
  const bottom = ranked.slice(5).slice(-5).reverse();
  const fatigue = d.ads.filter((a) => a.score.fatiguing).slice(0, 5);

  const [{ snapshot }, research] = await Promise.all([
    getUserBrand(userId).catch(() => ({ snapshot: null })),
    getBrandResearch(userId).catch(() => null),
  ]);

  const json: Record<string, unknown> = {
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

  const hash = createHash('sha256').update(PROMPT_VERSION).update(JSON.stringify(json)).digest('hex');

  const fetchImpl = deps.fetchImpl ?? fetch;
  const wanted = [...top.map((a) => ({ a, label: 'top ad' })), ...bottom.map((a) => ({ a, label: 'bottom ad' }))].slice(0, MAX_IMAGES);
  const images = (await Promise.all(wanted.map(({ a, label }) => loadImage(a, label, fetchImpl)))).filter((x): x is AnalysisImage => !!x);

  const adIds = new Set(d.ads.map((a) => a.adId));
  return { json, hash, images, adIds, dashboard: d };
}
