/**
 * Pure helpers for the Meta Intelligence dashboard: periods, KPI ratios, deltas,
 * daily series filling, and the minimum-data gates. No DB / network here.
 */
import { addDays } from '@/lib/meta-sync/dates';

export const RANGES = [7, 14, 30, 90] as const;
export type RangeDays = (typeof RANGES)[number];

/** Minimum spend before numbers are treated as meaningful (Phase 4 refines with 3× avg CPA). */
export const MIN_SPEND_BY_CURRENCY: Record<string, number> = { INR: 1500, USD: 20, EUR: 20, GBP: 15, AED: 75 };
export const DEFAULT_MIN_SPEND = 20;
export const MIN_IMPRESSIONS = 1000;

export function minSpendFor(currency: string | null | undefined): number {
  return (currency && MIN_SPEND_BY_CURRENCY[currency.toUpperCase()]) || DEFAULT_MIN_SPEND;
}

export function parseRange(v: unknown): RangeDays {
  const n = Number(v);
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : 30;
}

export type Period = { since: string; until: string };

/** Current period ends today (account timezone); previous is the same length just before it. */
export function periods(days: RangeDays, today: string): { current: Period; previous: Period } {
  const curSince = addDays(today, -(days - 1));
  return {
    current: { since: curSince, until: today },
    previous: { since: addDays(curSince, -days), until: addDays(curSince, -1) },
  };
}

export type Sums = {
  spend: number;
  revenue: number;
  revenueRows: number;
  purchases: number;
  purchaseRows: number;
  clicks: number;
  impressions: number;
};

export const emptySums = (): Sums => ({ spend: 0, revenue: 0, revenueRows: 0, purchases: 0, purchaseRows: 0, clicks: 0, impressions: 0 });

export type Kpis = {
  spend: number;
  revenue: number | null;
  roas: number | null;
  cpa: number | null;
  purchases: number | null;
  ctr: number | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Ratios from sums. Unknown (no rows reported it) → null, never 0. */
export function deriveKpis(s: Sums): Kpis {
  const revenue = s.revenueRows > 0 ? r2(s.revenue) : null;
  const purchases = s.purchaseRows > 0 ? s.purchases : null;
  return {
    spend: r2(s.spend),
    revenue,
    roas: revenue !== null && s.spend > 0 ? r2(revenue / s.spend) : null,
    cpa: purchases && purchases > 0 ? r2(s.spend / purchases) : null,
    purchases,
    ctr: s.impressions > 0 ? r2((s.clicks / s.impressions) * 100) : null,
  };
}

/** % change vs previous; null when there is nothing to compare against. */
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

export type KpiKey = keyof Kpis;
/** For these, going down is good. */
export const LOWER_IS_BETTER: ReadonlySet<KpiKey> = new Set(['cpa']);

export function compareKpis(cur: Kpis, prev: Kpis): Record<KpiKey, number | null> {
  const keys: KpiKey[] = ['spend', 'revenue', 'roas', 'cpa', 'purchases', 'ctr'];
  return Object.fromEntries(keys.map((k) => [k, pctChange(cur[k], prev[k])])) as Record<KpiKey, number | null>;
}

export type DailyPoint = { date: string; spend: number; revenue: number | null };

/** One point per day in the period; days with no rows get spend 0 and revenue null. */
export function fillDaily(rows: { date: string; spend: number; revenue: number | null }[], period: Period): DailyPoint[] {
  const by = new Map(rows.map((r) => [r.date, r]));
  const out: DailyPoint[] = [];
  for (let d = period.since; d <= period.until; d = addDays(d, 1)) {
    const r = by.get(d);
    out.push({ date: d, spend: r ? r2(r.spend) : 0, revenue: r?.revenue != null ? r2(r.revenue) : null });
  }
  return out;
}

/** SkalX-vs-others needs both sides to have spent enough to say anything. */
export function comparisonReady(skx: Sums | null, others: Sums | null, currency: string | null): boolean {
  const min = minSpendFor(currency);
  return !!skx && !!others && skx.spend >= min && others.spend >= min && skx.impressions >= MIN_IMPRESSIONS && others.impressions >= MIN_IMPRESSIONS;
}

export type DataState = 'ok' | 'limited' | 'empty';

export function dataState(current: Sums, currency: string | null): DataState {
  if (current.impressions === 0 && current.spend === 0) return 'empty';
  if (current.spend < minSpendFor(currency) || current.impressions < MIN_IMPRESSIONS) return 'limited';
  return 'ok';
}
