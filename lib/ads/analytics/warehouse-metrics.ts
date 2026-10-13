/**
 * Build warehouse-backed analytics payloads with explicit availability.
 */

import { IntegrationDAO } from "@/database/models/Integration.dao";
import {
  AdMetricsDAO,
  AdPlatformEntityDAO,
  AdSyncRunDAO,
} from "@/database/models/AdMetrics.dao";
import {
  daysAgo,
  deriveMetricRates,
  emptyAggregatedMetrics,
  isoDate,
} from "@/lib/ads/types";
import {
  changePctWhenAvailable,
  classifyAdsAnalyticsAvailability,
  type AdsAnalyticsAvailability,
} from "@/lib/ads/analytics/availability";
import {
  normalizeCurrencyCode,
  resolveDisplayCurrency,
} from "@/lib/ads/analytics/currency";
import { resolveWarehouseAccountScope } from "@/lib/ads/analytics/account-scope";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";

function daysForPreset(preset: string) {
  switch (preset) {
    case "1d":
      return 1;
    case "7d":
      return 7;
    case "15d":
      return 15;
    case "1m":
      return 30;
    case "3m":
      return 90;
    case "6m":
      return 180;
    case "1y":
      return 365;
    default:
      return null;
  }
}

export function resolveMetricsRange(query: {
  start?: string | string[];
  end?: string | string[];
  range?: string | string[];
}): {
  since: string;
  until: string;
  prevSince: string;
  prevUntil: string;
} {
  let since: string;
  let until: string;
  if (query.start && query.end) {
    since = String(query.start);
    until = String(query.end);
  } else {
    const preset = String(query.range || "7d");
    const days = daysForPreset(preset) || 7;
    until = daysAgo(1);
    since = daysAgo(days);
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  const sinceDate = new Date(since + "T00:00:00Z");
  const untilDate = new Date(until + "T00:00:00Z");
  const lengthDays =
    Math.round((untilDate.getTime() - sinceDate.getTime()) / msPerDay) + 1;
  const prevUntil = new Date(sinceDate.getTime() - msPerDay);
  const prevSince = new Date(prevUntil.getTime() - (lengthDays - 1) * msPerDay);
  return {
    since,
    until,
    prevSince: isoDate(prevSince),
    prevUntil: isoDate(prevUntil),
  };
}

export type WarehouseMetricsCurrent = {
  total_spend: number | null;
  total_reach: number | null;
  avg_ctr: number | null;
  conversions: number | null;
  roas: number | null;
  purchase_value: number | null;
  impressions: number | null;
  clicks: number | null;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
  cpl: number | null;
  frequency: number | null;
  budget_estimate_daily: number | null;
  /** ISO 4217 for spend; null when unknown or mixed */
  currency: string | null;
  mixed_currency: boolean;
  spend_by_currency: Record<string, number>;
};

export type WarehouseMetricsPayload = {
  ok: true;
  source: "warehouse" | "empty" | "none";
  provider: string;
  availability: AdsAnalyticsAvailability;
  ranges: {
    current: { since: string; until: string };
    previous: { since: string; until: string };
  };
  /** null when no rows in range / no data — never fabricated zeros */
  current: WarehouseMetricsCurrent | null;
  previous: Partial<WarehouseMetricsCurrent> | null;
  change: Record<string, number | null> | null;
  /** Account-level display currency (selected ad account), when known */
  currency: string | null;
  mixed_currency: boolean;
  spend_by_currency: Record<string, number>;
  time_series: Array<{
    date: string;
    spend: number | null;
    impressions: number;
    reach: number;
    clicks: number;
    conversions: number;
    ctr: number | null;
    currency: string | null;
  }>;
  campaigns: any[];
  integrationId?: string;
  /** Selected ad_accounts.id used for isolation (null when unavailable) */
  adAccountId?: string | null;
  selectedAccount?: {
    id: string;
    accountId: string | null;
    name: string | null;
    currency: string | null;
  } | null;
  meta?: {
    current: WarehouseMetricsCurrent | null;
    previous: Partial<WarehouseMetricsCurrent> | null;
    change: Record<string, number | null> | null;
    time_series: WarehouseMetricsPayload["time_series"];
  };
};

function mapCurrent(
  agg: Awaited<ReturnType<typeof AdMetricsDAO.aggregateRangeWithCoverage>>,
  accountCurrency?: string | null
): WarehouseMetricsCurrent {
  const currency =
    resolveDisplayCurrency({
      metricCurrencies: agg.currency ? [agg.currency] : Object.keys(agg.spendByCurrency),
      accountCurrency,
    }) ?? agg.currency;
  const mixed = agg.mixedCurrency;
  return {
    // Refuse a misleading grand total when currencies are mixed
    total_spend: mixed ? null : agg.spend,
    total_reach: agg.reach,
    avg_ctr: agg.ctr,
    conversions: agg.conversions,
    roas: mixed ? null : agg.roas,
    purchase_value: mixed ? null : agg.conversionValue,
    impressions: agg.impressions,
    clicks: agg.clicks,
    cpc: mixed ? null : agg.cpc,
    cpm: mixed ? null : agg.cpm,
    cpa: mixed ? null : agg.cpa,
    cpl: mixed ? null : agg.cpl,
    frequency: agg.frequency,
    budget_estimate_daily: null,
    currency: mixed ? null : currency,
    mixed_currency: mixed,
    spend_by_currency: agg.spendByCurrency,
  };
}

export async function buildWarehouseMetricsPayload(opts: {
  userId: string;
  provider?: string;
  query: {
    start?: string | string[];
    end?: string | string[];
    range?: string | string[];
  };
}): Promise<WarehouseMetricsPayload | null> {
  const provider = opts.provider || "meta";
  const integration = await IntegrationDAO.findByUserAndProvider(
    opts.userId,
    provider
  );

  const { since, until, prevSince, prevUntil } = resolveMetricsRange(opts.query);
  const ranges = {
    current: { since, until },
    previous: { since: prevSince, until: prevUntil },
  };

  if (!integration) {
    return {
      ok: true,
      source: "none",
      provider,
      availability: classifyAdsAnalyticsAvailability({
        hasWarehouseData: false,
        rowCountInRange: 0,
        syncStatus: null,
        lastSyncedAt: null,
      }),
      ranges,
      current: null,
      previous: null,
      change: null,
      currency: null,
      mixed_currency: false,
      spend_by_currency: {},
      time_series: [],
      campaigns: [],
      meta: {
        current: null,
        previous: null,
        change: null,
        time_series: [],
      },
    };
  }

  const syncStatus = (integration as any).syncStatus ?? null;
  const lastSyncedAt = (integration as any).lastSyncedAt ?? null;
  const selectedAccount = await AdAccountDAO.findSelected(integration.id);
  const scope = resolveWarehouseAccountScope(selectedAccount);

  // Prefer latest run status when present (PR F partial/error)
  const recent = await AdSyncRunDAO.listRecent(integration.id, 1);
  const latestRunStatus = recent[0]?.status ?? null;
  const effectiveSync =
    latestRunStatus && latestRunStatus !== "running"
      ? latestRunStatus
      : syncStatus;

  // No explicit selection → unavailable (do not blend accounts or guess)
  if (!scope.ok) {
    return {
      ok: true,
      source: "empty",
      provider,
      availability: {
        state: "unavailable",
        emptyRange: false,
        stale: false,
        rowCount: 0,
        syncStatus: effectiveSync,
        lastSyncedAt,
        message: scope.message,
      },
      ranges,
      current: null,
      previous: null,
      change: null,
      currency: null,
      mixed_currency: false,
      spend_by_currency: {},
      time_series: [],
      campaigns: [],
      integrationId: integration.id,
      adAccountId: null,
      selectedAccount: null,
      meta: {
        current: null,
        previous: null,
        change: null,
        time_series: [],
      },
    };
  }

  const accountCurrency = normalizeCurrencyCode(
    scope.currency ?? selectedAccount?.currency
  );
  const selectedMeta = {
    id: scope.adAccountId,
    accountId: scope.accountExternalId,
    name: scope.name,
    currency: accountCurrency,
  };

  const hasData = await AdMetricsDAO.hasData(
    integration.id,
    scope.adAccountId
  );

  if (!hasData) {
    const availability = classifyAdsAnalyticsAvailability({
      hasWarehouseData: false,
      rowCountInRange: 0,
      syncStatus: effectiveSync,
      lastSyncedAt,
    });
    return {
      ok: true,
      source: "empty",
      provider,
      availability,
      ranges,
      current: null,
      previous: null,
      change: null,
      currency: accountCurrency,
      mixed_currency: false,
      spend_by_currency: {},
      time_series: [],
      campaigns: [],
      integrationId: integration.id,
      adAccountId: scope.adAccountId,
      selectedAccount: selectedMeta,
      meta: {
        current: null,
        previous: null,
        change: null,
        time_series: [],
      },
    };
  }

  const current = await AdMetricsDAO.aggregateRangeWithCoverage(
    integration.id,
    scope.adAccountId,
    since,
    until,
    "account"
  );
  const previous = await AdMetricsDAO.aggregateRangeWithCoverage(
    integration.id,
    scope.adAccountId,
    prevSince,
    prevUntil,
    "account"
  );

  const availability = classifyAdsAnalyticsAvailability({
    hasWarehouseData: true,
    rowCountInRange: current.rowCount,
    syncStatus: effectiveSync,
    lastSyncedAt,
  });

  // Empty selected range: do not fabricate zero totals
  if (current.rowCount === 0) {
    const previousMapped =
      previous.rowCount > 0 ? mapCurrent(previous, accountCurrency) : null;
    return {
      ok: true,
      source: "warehouse",
      provider,
      availability,
      ranges,
      current: null,
      previous: previousMapped,
      change: null,
      currency: accountCurrency,
      mixed_currency: false,
      spend_by_currency: {},
      time_series: [],
      campaigns: [],
      integrationId: integration.id,
      adAccountId: scope.adAccountId,
      selectedAccount: selectedMeta,
      meta: {
        current: null,
        previous: previousMapped,
        change: null,
        time_series: [],
      },
    };
  }

  const campaignRows = await AdMetricsDAO.listCampaignMetrics(
    integration.id,
    scope.adAccountId,
    since,
    until
  );
  // Group campaign spend by currency so mixed totals are not summed blindly
  type CampaignBucket = {
    metrics: ReturnType<typeof emptyAggregatedMetrics>;
    currencies: Set<string>;
  };
  const byCampaign = new Map<string, CampaignBucket>();
  for (const row of campaignRows) {
    const id = row.entityExternalId;
    const bucket = byCampaign.get(id) || {
      metrics: emptyAggregatedMetrics(),
      currencies: new Set<string>(),
    };
    const code = normalizeCurrencyCode(row.currency);
    if (code) bucket.currencies.add(code);
    bucket.metrics.impressions += Number(row.impressions || 0);
    bucket.metrics.reach += Number(row.reach || 0);
    bucket.metrics.clicks += Number(row.clicks || 0);
    bucket.metrics.conversions += Number(row.conversions || 0);
    if (bucket.currencies.size <= 1) {
      bucket.metrics.spend += Number(row.spend || 0);
      bucket.metrics.conversionValue += Number(row.conversionValue || 0);
    }
    byCampaign.set(id, bucket);
  }
  const entities = await AdPlatformEntityDAO.listByIntegration(
    integration.id,
    "campaign",
    scope.adAccountId
  );
  const nameById = new Map(entities.map((e) => [e.externalId, e.name]));
  const campaigns = [...byCampaign.entries()].map(([id, bucket]) => {
    const mixed = bucket.currencies.size > 1;
    if (mixed) {
      bucket.metrics.spend = 0;
      bucket.metrics.conversionValue = 0;
    }
    const d = deriveMetricRates(bucket.metrics);
    const currency =
      bucket.currencies.size === 1 ? [...bucket.currencies][0] : null;
    return {
      id,
      name: nameById.get(id) || id,
      spend: mixed ? null : d.spend,
      impressions: d.impressions,
      clicks: d.clicks,
      conversions: d.conversions,
      conversion_value: mixed ? null : d.conversionValue,
      ctr: d.ctr,
      cpc: mixed ? null : d.cpc,
      cpa: mixed ? null : d.cpa,
      roas: mixed ? null : d.roas,
      currency: mixed ? null : currency || accountCurrency,
      mixed_currency: mixed,
    };
  });

  const dailyRows = await AdMetricsDAO.listAccountDaily(
    integration.id,
    scope.adAccountId,
    since,
    until
  );
  const byDate = new Map<
    string,
    {
      date: string;
      spend: number;
      impressions: number;
      reach: number;
      clicks: number;
      conversions: number;
      currencies: Set<string>;
    }
  >();
  for (const row of dailyRows) {
    const key = String(row.metricDate);
    const cur = byDate.get(key) || {
      date: key,
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      conversions: 0,
      currencies: new Set<string>(),
    };
    const code = normalizeCurrencyCode(row.currency);
    if (code) cur.currencies.add(code);
    cur.impressions += Number(row.impressions || 0);
    cur.reach += Number(row.reach || 0);
    cur.clicks += Number(row.clicks || 0);
    cur.conversions += Number(row.conversions || 0);
    if (cur.currencies.size <= 1) {
      cur.spend += Number(row.spend || 0);
    }
    byDate.set(key, cur);
  }
  // Only dates with warehouse rows — never invent missing calendar days as zero
  const time_series = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const mixed = d.currencies.size > 1;
      const currency =
        d.currencies.size === 1
          ? [...d.currencies][0]
          : d.currencies.size === 0
            ? accountCurrency
            : null;
      return {
        date: d.date,
        spend: mixed ? null : d.spend,
        impressions: d.impressions,
        reach: d.reach,
        clicks: d.clicks,
        conversions: d.conversions,
        currency: mixed ? null : currency,
        ctr:
          d.impressions > 0
            ? (d.clicks / d.impressions) * 100
            : null,
      };
    });

  const currentMapped = mapCurrent(current, accountCurrency);
  const previousMapped =
    previous.rowCount > 0 ? mapCurrent(previous, accountCurrency) : null;

  const canCompareSpend =
    !current.mixedCurrency &&
    !previous.mixedCurrency &&
    currentMapped.currency &&
    previousMapped?.currency &&
    currentMapped.currency === previousMapped.currency;

  const change = {
    total_spend_pct: canCompareSpend
      ? changePctWhenAvailable(
          current.spend,
          previous.rowCount > 0 ? previous.spend : null
        )
      : null,
    total_reach_pct: changePctWhenAvailable(
      current.reach,
      previous.rowCount > 0 ? previous.reach : null
    ),
    avg_ctr_pct: changePctWhenAvailable(
      current.ctr,
      previous.rowCount > 0 ? previous.ctr : null
    ),
    conversions_pct: changePctWhenAvailable(
      current.conversions,
      previous.rowCount > 0 ? previous.conversions : null
    ),
    roas_pct: canCompareSpend
      ? changePctWhenAvailable(
          current.roas,
          previous.rowCount > 0 ? previous.roas : null
        )
      : null,
  };

  return {
    ok: true,
    source: "warehouse",
    provider,
    availability,
    ranges,
    current: currentMapped,
    previous: previousMapped,
    change,
    currency: currentMapped.currency ?? accountCurrency,
    mixed_currency: currentMapped.mixed_currency,
    spend_by_currency: currentMapped.spend_by_currency,
    time_series,
    campaigns,
    integrationId: integration.id,
    adAccountId: scope.adAccountId,
    selectedAccount: selectedMeta,
    meta: {
      current: currentMapped,
      previous: previousMapped,
      change,
      time_series,
    },
  };
}
