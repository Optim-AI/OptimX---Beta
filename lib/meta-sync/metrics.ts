/**
 * Turns a raw Ads Insights row into the numbers we store.
 * Purchases / revenue come from `actions` / `action_values`, picking ONE action
 * type by priority (Meta reports overlapping types, so summing would double count).
 * ROAS uses Meta's `purchase_roas` when present, else revenue / spend. CPA = spend / purchases.
 * Missing metrics stay null (never 0) so the UI can show "—".
 */

export type MetaActionEntry = { action_type?: string; value?: string | number; [k: string]: unknown };

export type RawInsightRow = {
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  account_currency?: string;
  date_start?: string;
  date_stop?: string;
  spend?: string | number;
  impressions?: string | number;
  reach?: string | number;
  frequency?: string | number;
  clicks?: string | number;
  inline_link_clicks?: string | number;
  ctr?: string | number;
  cpc?: string | number;
  cpm?: string | number;
  actions?: MetaActionEntry[];
  action_values?: MetaActionEntry[];
  purchase_roas?: MetaActionEntry[];
  [k: string]: unknown;
};

export type NormalizedInsight = {
  adMetaId: string;
  adsetMetaId: string | null;
  campaignMetaId: string | null;
  date: string;
  currency: string | null;
  spend: number;
  impressions: number;
  reach: number | null;
  frequency: number | null;
  clicks: number | null;
  linkClicks: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  purchases: number | null;
  revenue: number | null;
  roas: number | null;
  cpa: number | null;
  purchaseSource: string | null;
  roasSource: 'meta' | 'derived' | null;
  actions: MetaActionEntry[];
  actionValues: MetaActionEntry[];
};

/** Highest priority first. omni_purchase is Meta's de-duplicated cross-channel purchase count. */
export const PURCHASE_ACTION_TYPES = [
  'omni_purchase',
  'purchase',
  'offsite_conversion.fb_pixel_purchase',
  'onsite_web_purchase',
  'onsite_conversion.purchase',
] as const;

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

const round = (n: number, dp = 4) => Math.round(n * 10 ** dp) / 10 ** dp;

export function pickAction(entries: MetaActionEntry[] | undefined): { type: string; value: number } | null {
  if (!Array.isArray(entries) || !entries.length) return null;
  for (const type of PURCHASE_ACTION_TYPES) {
    const hit = entries.find((e) => e?.action_type === type);
    const value = hit ? toNum(hit.value) : null;
    if (value !== null) return { type, value };
  }
  return null;
}

export function normalizeInsight(raw: RawInsightRow, fallbackCurrency: string | null = null): NormalizedInsight | null {
  if (!raw?.ad_id || !raw?.date_start) return null;
  const spend = toNum(raw.spend) ?? 0;
  const impressions = toNum(raw.impressions) ?? 0;
  const clicks = toNum(raw.clicks);

  const purchaseHit = pickAction(raw.actions);
  // Revenue should use the same action type as purchases when possible.
  const valueHit = purchaseHit
    ? (() => {
        const same = raw.action_values?.find((e) => e?.action_type === purchaseHit.type);
        const v = same ? toNum(same.value) : null;
        return v !== null ? { type: purchaseHit.type, value: v } : pickAction(raw.action_values);
      })()
    : pickAction(raw.action_values);

  const purchases = purchaseHit?.value ?? null;
  const revenue = valueHit?.value ?? null;

  let roas: number | null = null;
  let roasSource: NormalizedInsight['roasSource'] = null;
  const metaRoas =
    (purchaseHit && raw.purchase_roas?.find((e) => e?.action_type === purchaseHit.type)) || raw.purchase_roas?.[0];
  const metaRoasValue = metaRoas ? toNum(metaRoas.value) : null;
  if (metaRoasValue !== null) {
    roas = metaRoasValue;
    roasSource = 'meta';
  } else if (revenue !== null && spend > 0) {
    roas = round(revenue / spend);
    roasSource = 'derived';
  }

  const ctr = toNum(raw.ctr) ?? (clicks !== null && impressions > 0 ? round((clicks / impressions) * 100) : null);
  const cpc = toNum(raw.cpc) ?? (clicks ? round(spend / clicks) : null);
  const cpm = toNum(raw.cpm) ?? (impressions > 0 ? round((spend / impressions) * 1000) : null);

  return {
    adMetaId: String(raw.ad_id),
    adsetMetaId: raw.adset_id ? String(raw.adset_id) : null,
    campaignMetaId: raw.campaign_id ? String(raw.campaign_id) : null,
    date: String(raw.date_start).slice(0, 10),
    currency: raw.account_currency ?? fallbackCurrency,
    spend,
    impressions,
    reach: toNum(raw.reach),
    frequency: toNum(raw.frequency),
    clicks,
    linkClicks: toNum(raw.inline_link_clicks),
    ctr,
    cpc,
    cpm,
    purchases,
    revenue,
    roas,
    cpa: purchases && purchases > 0 ? round(spend / purchases, 2) : null,
    purchaseSource: purchaseHit?.type ?? null,
    roasSource,
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    actionValues: Array.isArray(raw.action_values) ? raw.action_values : [],
  };
}
