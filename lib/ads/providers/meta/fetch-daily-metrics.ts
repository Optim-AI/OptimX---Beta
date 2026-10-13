/**
 * Meta Ads daily insights collection with per-level failure reporting.
 * Injectable Graph pager for unit tests.
 */

import type {
  DailyMetricInput,
  FetchDailyMetricsResult,
  MetricsFetchFailure,
  SyncDateRange,
} from "@/lib/ads/types";
import { deriveMetricRates, emptyAggregatedMetrics } from "@/lib/ads/types";
import {
  ensureActPrefix,
  META_INSIGHT_FIELDS,
  metaGraphGetAllWithMeta,
  stripActPrefix,
  type MetaGraphPageResult,
} from "@/lib/ads/providers/meta/client";
import { normalizeCurrencyCode } from "@/lib/ads/analytics/currency";

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseActions(row: any): { conversions: number; conversionValue: number } {
  let conversions = 0;
  let conversionValue = 0;
  if (Array.isArray(row.actions)) {
    for (const a of row.actions) {
      const t = String(a.action_type || "").toLowerCase();
      if (
        ["purchase", "lead", "omni_purchase", "offsite_conversion", "conversion"].some((k) =>
          t.includes(k)
        )
      ) {
        conversions += num(a.value);
      }
    }
  }
  if (Array.isArray(row.action_values)) {
    for (const av of row.action_values) {
      const t = String(av.action_type || "").toLowerCase();
      if (["purchase", "offsite_conversion", "omni_purchase"].some((k) => t.includes(k))) {
        conversionValue += num(av.value);
      }
    }
  }
  return { conversions, conversionValue };
}

export function insightToMetric(
  row: any,
  entityType: DailyMetricInput["entityType"],
  entityExternalId: string,
  currency?: string | null
): DailyMetricInput {
  const { conversions, conversionValue } = parseActions(row);
  const base = emptyAggregatedMetrics();
  base.spend = num(row.spend);
  base.impressions = num(row.impressions);
  base.reach = num(row.reach);
  base.clicks = num(row.clicks);
  base.conversions = conversions;
  base.conversionValue = conversionValue;
  base.frequency = row.frequency != null ? num(row.frequency) : null;
  const derived = deriveMetricRates(base);
  if (row.ctr != null) derived.ctr = num(row.ctr);
  if (row.cpc != null) derived.cpc = num(row.cpc);
  if (row.cpm != null) derived.cpm = num(row.cpm);

  return {
    entityType,
    entityExternalId,
    metricDate: String(row.date_start || row.date_stop).slice(0, 10),
    spend: derived.spend,
    impressions: derived.impressions,
    reach: derived.reach,
    frequency: derived.frequency,
    clicks: derived.clicks,
    ctr: derived.ctr,
    cpc: derived.cpc,
    cpm: derived.cpm,
    conversions: derived.conversions,
    conversionValue: derived.conversionValue,
    cpa: derived.cpa,
    cpl: derived.cpl,
    roas: derived.roas,
    currency: normalizeCurrencyCode(currency) ?? null,
    raw: row,
  };
}

export type MetaInsightsPager = (
  path: string,
  accessToken: string,
  params: Record<string, string | number | undefined>,
  maxPages?: number
) => Promise<MetaGraphPageResult<any>>;

function sanitizeError(e: any): { message: string; code?: string | number } {
  const message = String(e?.message || e || "insights_failed").slice(0, 300);
  const code = e?.code ?? e?.type;
  return { message, code };
}

/**
 * Fetch account / campaign / ad daily insights. Never swallows failures as empty success.
 */
export async function collectMetaDailyMetrics(opts: {
  accountId: string;
  accessToken: string;
  range: SyncDateRange;
  /** Selected ad account currency from Meta discovery (e.g. USD, INR) */
  currency?: string | null;
  getAll?: MetaInsightsPager;
}): Promise<FetchDailyMetricsResult> {
  const getAll = opts.getAll ?? metaGraphGetAllWithMeta;
  const currency = normalizeCurrencyCode(opts.currency);
  const act = ensureActPrefix(opts.accountId);
  if (!act) {
    return {
      metrics: [],
      failures: [
        {
          level: "account",
          message: "Invalid Meta ad account id",
          code: "invalid_account",
        },
      ],
      levelsAttempted: ["account"],
      levelsSucceeded: [],
    };
  }

  const timeRange = JSON.stringify({
    since: opts.range.since,
    until: opts.range.until,
  });
  const metrics: DailyMetricInput[] = [];
  const failures: MetricsFetchFailure[] = [];
  const levelsAttempted: string[] = [];
  const levelsSucceeded: string[] = [];

  async function fetchLevel(
    level: "account" | "campaign" | "ad",
    fields: string,
    maxPages: number,
    mapRow: (row: any) => DailyMetricInput | null
  ) {
    levelsAttempted.push(level);
    try {
      const page = await getAll(
        `${act}/insights`,
        opts.accessToken,
        {
          fields,
          time_range: timeRange,
          time_increment: 1,
          level,
          limit: 500,
        },
        maxPages
      );
      for (const row of page.items) {
        const m = mapRow(row);
        if (m) metrics.push(m);
      }
      if (page.truncated) {
        failures.push({
          level,
          message: `Insights pagination truncated after ${page.pagesFetched} pages`,
          code: "pagination_truncated",
          truncated: true,
        });
        // Still count as succeeded with incomplete data → overall partial
        levelsSucceeded.push(level);
      } else {
        levelsSucceeded.push(level);
      }
    } catch (e: any) {
      const { message, code } = sanitizeError(e);
      failures.push({
        level,
        message,
        code: code ?? "insights_error",
      });
      console.warn(`[meta] ${level} insights failed:`, message);
    }
  }

  const accountExternal =
    stripActPrefix(opts.accountId) || opts.accountId;

  await fetchLevel("account", META_INSIGHT_FIELDS, 10, (row) =>
    insightToMetric(row, "account", accountExternal, currency)
  );

  await fetchLevel(
    "campaign",
    META_INSIGHT_FIELDS + ",campaign_id,campaign_name",
    10,
    (row) => {
      const id = String(row.campaign_id || "");
      if (!id) return null;
      return insightToMetric(row, "campaign", id, currency);
    }
  );

  await fetchLevel(
    "ad",
    META_INSIGHT_FIELDS + ",ad_id,ad_name",
    5,
    (row) => {
      const id = String(row.ad_id || "");
      if (!id) return null;
      return insightToMetric(row, "ad", id, currency);
    }
  );

  return { metrics, failures, levelsAttempted, levelsSucceeded };
}
