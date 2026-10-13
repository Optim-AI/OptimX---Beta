/**
 * Ads analytics availability — distinguish genuine zeros from unknown data.
 * Pure helpers for warehouse APIs and Analytics UI.
 */

export const ADS_METRICS_STALE_AFTER_MS = 48 * 60 * 60 * 1000;

export type AdsAnalyticsState =
  | "available"
  | "empty_range"
  | "partial"
  | "unavailable"
  | "stale"
  | "no_data";

export type AdsAnalyticsAvailability = {
  state: AdsAnalyticsState;
  /** True when warehouse has historical rows but none in the selected range */
  emptyRange: boolean;
  /** True when last sync is older than freshness window (may still show numbers) */
  stale: boolean;
  rowCount: number;
  syncStatus: string | null;
  lastSyncedAt: string | null;
  message: string | null;
};

export type AggregatedMetricsWithCoverage = {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
  cpl: number | null;
  roas: number | null;
  frequency: number | null;
  /** Number of daily warehouse rows included in the aggregate */
  rowCount: number;
};

/**
 * Derived rates: return null when required inputs are unavailable (not zero).
 * Callers must pass nullish inputs for unknown metrics — never invent zeros first.
 */
export function deriveRatesWhenAvailable(opts: {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  conversionValue: number | null;
  reach: number | null;
}): {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
  roas: number | null;
  frequency: number | null;
} {
  const { spend, impressions, clicks, conversions, conversionValue, reach } = opts;

  const ctr =
    impressions != null && clicks != null && impressions > 0
      ? (clicks / impressions) * 100
      : impressions != null && clicks != null && impressions === 0
        ? null
        : null;

  const cpc =
    spend != null && clicks != null && clicks > 0 ? spend / clicks : null;

  const cpm =
    spend != null && impressions != null && impressions > 0
      ? (spend / impressions) * 1000
      : null;

  const cpa =
    spend != null && conversions != null && conversions > 0
      ? spend / conversions
      : null;

  const roas =
    spend != null &&
    conversionValue != null &&
    spend > 0 &&
    conversionValue > 0
      ? conversionValue / spend
      : null;

  const frequency =
    reach != null && impressions != null && reach > 0
      ? impressions / reach
      : null;

  return { ctr, cpc, cpm, cpa, roas, frequency };
}

export function changePctWhenAvailable(
  curr: number | null | undefined,
  prev: number | null | undefined
): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function isStaleLastSynced(
  lastSyncedAt: string | null | undefined,
  nowMs = Date.now(),
  staleAfterMs = ADS_METRICS_STALE_AFTER_MS
): boolean {
  if (!lastSyncedAt) return false;
  const t = new Date(lastSyncedAt).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs - t > staleAfterMs;
}

/**
 * Classify analytics availability from sync + warehouse coverage.
 * Does NOT treat missing calendar days as incomplete Meta coverage
 * (Insights typically omit zero-activity days).
 */
export function classifyAdsAnalyticsAvailability(opts: {
  hasWarehouseData: boolean;
  rowCountInRange: number;
  syncStatus?: string | null;
  lastSyncedAt?: string | null;
  nowMs?: number;
}): AdsAnalyticsAvailability {
  const syncStatus = opts.syncStatus ? String(opts.syncStatus).toLowerCase() : null;
  const stale = isStaleLastSynced(opts.lastSyncedAt, opts.nowMs);
  const base = {
    emptyRange: false,
    stale,
    rowCount: opts.rowCountInRange,
    syncStatus,
    lastSyncedAt: opts.lastSyncedAt ?? null,
  };

  if (!opts.hasWarehouseData) {
    return {
      ...base,
      state: "no_data",
      message: "No synced metrics yet. Run Ads sync to pull performance data.",
    };
  }

  if (opts.rowCountInRange === 0) {
    return {
      ...base,
      state: "empty_range",
      emptyRange: true,
      message:
        "No metrics in this date range. Try another range or re-sync your ad account.",
    };
  }

  // Failed sync with previously stored metrics still shown
  if (syncStatus === "error" || syncStatus === "failed") {
    return {
      ...base,
      state: "unavailable",
      message:
        "Last sync failed. Showing previously stored metrics when available — figures may be incomplete.",
    };
  }

  if (syncStatus === "partial") {
    return {
      ...base,
      state: "partial",
      message:
        "Last sync completed only partially. Totals may be incomplete for some insight levels.",
    };
  }

  if (stale) {
    return {
      ...base,
      state: "stale",
      message:
        "Metrics may be stale. Re-sync to refresh performance data.",
    };
  }

  return {
    ...base,
    state: "available",
    message: null,
  };
}

/** Format a known metric for UI; unknown → em dash (never invent "0"). */
export function formatKnownMetric(
  value: number | null | undefined,
  opts?: { suffix?: string; asInt?: boolean; asMoney?: (n: number) => string }
): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  if (opts?.asMoney) return opts.asMoney(n);
  if (opts?.asInt) return Math.round(n).toLocaleString();
  if (opts?.suffix) return `${n.toFixed(2)}${opts.suffix}`;
  return String(n);
}

/**
 * Whether a warehouse aggregate with rowCount>0 and all additive metrics at 0
 * is a legitimate actual-zero result (vs unknown).
 */
export function isActualZeroAggregate(agg: {
  rowCount: number;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  conversions: number;
}): boolean {
  return (
    agg.rowCount > 0 &&
    agg.spend === 0 &&
    agg.impressions === 0 &&
    agg.reach === 0 &&
    agg.clicks === 0 &&
    agg.conversions === 0
  );
}
