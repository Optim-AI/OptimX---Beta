/**
 * The ads and posts an AI insight points at, with the numbers to draw them: taken from the
 * analysis input SkalX stored (the same numbers the AI was given), never from the AI's text.
 * Shared by the insights API (builds it) and the panel (draws it). No runtime deps.
 */
export type InsightRef = {
  kind: 'ad' | 'post';
  label: string;
  thumbnailUrl: string | null;
  /** What the bar compares, in plain words, e.g. "engagements" or "cost of each sale". */
  metric: string;
  /** The item's own value, already formatted for display. */
  value: string | null;
  /** % difference from the account's (or platform's) average; null when there is no average. */
  vsAvgPct: number | null;
  /** true when a higher number is better (engagements, ROAS); false for costs. */
  higherIsBetter: boolean;
  /** "your average", "your Instagram average"… */
  baseline: string;
};

type Num = number | null | undefined;
const isNum = (v: Num): v is number => typeof v === 'number' && Number.isFinite(v);

function moneyText(v: number, currency: string | null): string {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', minimumFractionDigits: 0, maximumFractionDigits: Math.abs(v) >= 1000 ? 0 : 2 }).format(v);
  } catch {
    return v.toFixed(0);
  }
}

function adRef(a: Record<string, unknown>, currency: string | null): [string, InsightRef] | null {
  const id = typeof a.ad_id === 'string' ? a.ad_id : null;
  if (!id) return null;
  const cpaPct = a.cost_per_purchase_vs_account_pct as Num;
  const roasPct = a.roas_vs_account_pct as Num;
  const useCpa = isNum(cpaPct);
  return [id, {
    kind: 'ad',
    label: (a.name as string) || 'Ad',
    thumbnailUrl: null,
    metric: useCpa ? 'cost of each sale' : 'sales for the money',
    value: useCpa && isNum(a.cost_per_purchase as Num)
      ? `${moneyText(a.cost_per_purchase as number, currency)} per sale`
      : isNum(a.roas as Num) ? `${(a.roas as number).toFixed(2)}× back` : null,
    vsAvgPct: useCpa ? cpaPct : isNum(roasPct) ? roasPct : null,
    higherIsBetter: !useCpa,
    baseline: 'your average',
  }];
}

function postRef(p: Record<string, unknown>): [string, InsightRef] | null {
  const id = typeof p.post_id === 'string' ? p.post_id : null;
  if (!id) return null;
  const platform = p.platform === 'instagram' ? 'Instagram' : 'Facebook';
  const eng = p.engagement as Num;
  return [id, {
    kind: 'post',
    label: (p.name as string) || `${platform} post`,
    thumbnailUrl: null,
    metric: 'engagements',
    value: isNum(eng) ? `${eng} ${eng === 1 ? 'engagement' : 'engagements'}` : null,
    vsAvgPct: isNum(p.engagement_vs_platform_avg_pct as Num) ? (p.engagement_vs_platform_avg_pct as number) : null,
    higherIsBetter: true,
    baseline: `your ${platform} average`,
  }];
}

/** Refs for every ad/post in the stored analysis input. */
export function refsFromInput(input: unknown): Record<string, InsightRef> {
  const j = (input ?? {}) as Record<string, unknown>;
  const out: Record<string, InsightRef> = {};
  const list = (k: string) => (Array.isArray(j[k]) ? (j[k] as Record<string, unknown>[]) : []);
  for (const a of [...list('top_ads'), ...list('bottom_ads')]) {
    const r = adRef(a, typeof j.currency === 'string' ? j.currency : null);
    if (r) out[r[0]] = r[1];
  }
  for (const p of list('posts')) {
    const r = postRef(p);
    if (r) out[r[0]] = r[1];
  }
  return out;
}
