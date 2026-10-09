/** Shared types for the Marketing Performance Data Layer */

export type AdsProviderId = "meta" | "google-ads" | "linkedin";

export type AdEntityType =
  | "campaign"
  | "adset"
  | "ad_group"
  | "ad"
  | "creative"
  | "keyword"
  | "lead_form"
  | "page"
  | "business"
  | "customer"
  | "account";

export type MetricEntityType =
  | "account"
  | "campaign"
  | "adset"
  | "ad_group"
  | "ad"
  | "creative"
  | "keyword";

export interface DiscoveredAdAccount {
  accountId: string;
  name?: string | null;
  currency?: string | null;
  timezone?: string | null;
  status?: string | null;
  raw?: unknown;
  metadata?: Record<string, unknown>;
}

export interface DiscoveredAsset {
  type: AdEntityType;
  externalId: string;
  name?: string | null;
  status?: string | null;
  parentExternalId?: string | null;
  raw?: unknown;
  metadata?: Record<string, unknown>;
}

export interface PlatformEntityInput {
  entityType: AdEntityType;
  externalId: string;
  parentExternalId?: string | null;
  name?: string | null;
  status?: string | null;
  objective?: string | null;
  dailyBudget?: string | number | null;
  lifetimeBudget?: string | number | null;
  currency?: string | null;
  raw?: unknown;
  metadata?: Record<string, unknown>;
}

export interface DailyMetricInput {
  entityType: MetricEntityType;
  entityExternalId: string;
  metricDate: string; // YYYY-MM-DD
  spend?: number;
  impressions?: number;
  reach?: number;
  frequency?: number | null;
  clicks?: number;
  ctr?: number | null;
  cpc?: number | null;
  cpm?: number | null;
  conversions?: number;
  conversionValue?: number;
  cpa?: number | null;
  cpl?: number | null;
  roas?: number | null;
  currency?: string | null;
  raw?: unknown;
}

export interface SyncDateRange {
  since: string; // YYYY-MM-DD
  until: string;
}

export interface SyncResult {
  entitiesUpserted: number;
  metricsUpserted: number;
  warnings?: string[];
  details?: Record<string, unknown>;
}

export interface AggregatedMetrics {
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
}

export function emptyAggregatedMetrics(): AggregatedMetrics {
  return {
    spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    conversions: 0,
    conversionValue: 0,
    ctr: null,
    cpc: null,
    cpm: null,
    cpa: null,
    cpl: null,
    roas: null,
    frequency: null,
  };
}

export function deriveMetricRates(m: AggregatedMetrics): AggregatedMetrics {
  const ctr = m.impressions > 0 ? (m.clicks / m.impressions) * 100 : null;
  const cpc = m.clicks > 0 ? m.spend / m.clicks : null;
  const cpm = m.impressions > 0 ? (m.spend / m.impressions) * 1000 : null;
  const cpa = m.conversions > 0 ? m.spend / m.conversions : null;
  const cpl = cpa;
  const roas = m.spend > 0 && m.conversionValue > 0 ? m.conversionValue / m.spend : null;
  const frequency =
    m.reach > 0 && m.impressions > 0 ? m.impressions / m.reach : m.frequency;
  return { ...m, ctr, cpc, cpm, cpa, cpl, roas, frequency };
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function daysAgo(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - n);
  return isoDate(d);
}
