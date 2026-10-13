/**
 * Analytics page presentation helpers — never invent zeros for unknown metrics.
 */

import type { AdsAnalyticsAvailability, AdsAnalyticsState } from "@/lib/ads/analytics/availability";
import { formatKnownMetric } from "@/lib/ads/analytics/availability";

export type AnalyticsFetchOutcome =
  | { kind: "success"; payload: any }
  | { kind: "http_error"; status: number; payload?: any }
  | { kind: "network_error"; message: string }
  | { kind: "disconnected" };

export function availabilityFromPayload(payload: any): AdsAnalyticsAvailability | null {
  if (payload?.availability && typeof payload.availability.state === "string") {
    return payload.availability as AdsAnalyticsAvailability;
  }
  return null;
}

/** Banner copy for the availability state. */
export function availabilityBanner(
  state: AdsAnalyticsState | null | undefined,
  opts?: { mixedCurrency?: boolean }
): {
  tone: "info" | "warning" | "error" | "none";
  text: string | null;
} {
  if (opts?.mixedCurrency) {
    return {
      tone: "warning",
      text: "Spend includes multiple currencies — totals are shown per currency, not combined.",
    };
  }
  switch (state) {
    case "no_data":
      return {
        tone: "info",
        text: "No synced metrics yet. Connect Meta Ads and run a sync to see performance.",
      };
    case "empty_range":
      return {
        tone: "info",
        text: "No metrics in this date range. Try another range or re-sync.",
      };
    case "partial":
      return {
        tone: "warning",
        text: "Last sync was partial — totals may be incomplete.",
      };
    case "unavailable":
      return {
        tone: "error",
        text: "Metrics unavailable or last sync failed. Showing stored data only when present.",
      };
    case "stale":
      return {
        tone: "warning",
        text: "Metrics may be stale. Re-sync to refresh.",
      };
    case "available":
    default:
      return { tone: "none", text: null };
  }
}

export function metricCardValue(
  value: number | null | undefined,
  opts?: { money?: (n: number) => string; pct?: boolean; compactK?: boolean }
): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  if (opts?.money) return opts.money(n);
  if (opts?.pct) return `${n.toFixed(2)}%`;
  if (opts?.compactK) {
    if (n >= 1000) return `${Math.round(n / 1000)}K`;
    return Math.round(n).toLocaleString();
  }
  return formatKnownMetric(n, { asInt: true });
}

/**
 * Build overview cards from a metrics payload without coercing null → 0.
 */
export function buildOverviewCards(
  current: Record<string, number | null> | null | undefined,
  change: Record<string, number | null> | null | undefined,
  fmtMoney: (n: number | null | undefined) => string,
  pctDisplay: (n: number | null | undefined) => string
) {
  const c = current || null;
  const ch = change || {};

  const trend = (pct: number | null | undefined) =>
    pct == null ? "flat" : pct > 0 ? "up" : pct < 0 ? "down" : "flat";

  return [
    {
      label: "Impressions",
      value: metricCardValue(c?.impressions ?? c?.total_reach, { compactK: true }),
      change: pctDisplay(ch.total_reach_pct),
      trend: trend(ch.total_reach_pct),
    },
    {
      label: "Clicks",
      value: metricCardValue(c?.clicks),
      change: pctDisplay(ch.avg_ctr_pct),
      trend: trend(ch.avg_ctr_pct),
    },
    {
      label: "CTR",
      value: metricCardValue(c?.avg_ctr, { pct: true }),
      change: pctDisplay(ch.avg_ctr_pct),
      trend: trend(ch.avg_ctr_pct),
    },
    {
      label: "Spend",
      value: c?.total_spend == null ? "—" : fmtMoney(c.total_spend),
      change: pctDisplay(ch.total_spend_pct),
      trend: trend(ch.total_spend_pct),
    },
    {
      label: "Budget (daily est.)",
      value:
        c?.budget_estimate_daily == null ? "—" : fmtMoney(c.budget_estimate_daily),
      change: "—",
      trend: "flat" as const,
    },
    {
      label: "Conversions",
      value: metricCardValue(c?.conversions),
      change: pctDisplay(ch.conversions_pct),
      trend: trend(ch.conversions_pct),
    },
  ];
}
