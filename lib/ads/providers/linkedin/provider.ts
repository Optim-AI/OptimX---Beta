import type { AdsProvider, AdsProviderContext } from "@/lib/ads/providers/types";
import type {
  DailyMetricInput,
  DiscoveredAdAccount,
  PlatformEntityInput,
  SyncDateRange,
} from "@/lib/ads/types";
import { deriveMetricRates, emptyAggregatedMetrics } from "@/lib/ads/types";
import {
  linkedInGet,
  refreshLinkedInAccessToken,
} from "@/lib/ads/providers/linkedin/client";

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * LinkedIn Ads provider — full adapter shape.
 * Reporting endpoints vary by LinkedIn API version / product access;
 * failures are surfaced as empty results with warnings rather than hard crashes.
 */
export const linkedInAdsProvider: AdsProvider = {
  id: "linkedin",

  async listAdAccounts(ctx: AdsProviderContext): Promise<DiscoveredAdAccount[]> {
    const json = await linkedInGet("adAccounts", ctx.accessToken, {
      q: "search",
    });
    const elements = json.elements || json.accounts || [];
    return (Array.isArray(elements) ? elements : []).map((a: any) => ({
      accountId: String(a.id || a.account || "").replace(/^urn:li:sponsoredAccount:/, ""),
      name: a.name || a.reference || `Account ${a.id}`,
      currency: a.currency || a.currencyCode || null,
      status: a.status || a.servingStatuses?.[0] || null,
      raw: a,
      metadata: {
        urn: a.id?.startsWith?.("urn:")
          ? a.id
          : `urn:li:sponsoredAccount:${a.id}`,
      },
    }));
  },

  async fetchEntities(
    ctx: AdsProviderContext,
    accountId: string
  ): Promise<PlatformEntityInput[]> {
    const urn = accountId.startsWith("urn:")
      ? accountId
      : `urn:li:sponsoredAccount:${accountId}`;
    const entities: PlatformEntityInput[] = [];

    try {
      const campaigns = await linkedInGet("adCampaigns", ctx.accessToken, {
        q: "search",
        search: `(account:(values:List(${encodeURIComponent(urn)})))`,
      });
      for (const c of campaigns.elements || []) {
        entities.push({
          entityType: "campaign",
          externalId: String(c.id),
          name: c.name,
          status: c.status,
          objective: c.objectiveType || c.type,
          dailyBudget: c.dailyBudget?.amount,
          raw: c,
        });
      }
    } catch (e: any) {
      console.warn("[linkedin] campaigns fetch failed:", e?.message);
    }

    try {
      const creatives = await linkedInGet("creatives", ctx.accessToken, {
        q: "criteria",
        // account-scoped creative search varies by API version
      });
      for (const cr of creatives.elements || []) {
        entities.push({
          entityType: "creative",
          externalId: String(cr.id),
          name: cr.name || `Creative ${cr.id}`,
          status: cr.intendedStatus || cr.status,
          raw: cr,
        });
      }
    } catch (e: any) {
      console.warn("[linkedin] creatives fetch failed:", e?.message);
    }

    return entities;
  },

  async fetchDailyMetrics(
    ctx: AdsProviderContext,
    accountId: string,
    range: SyncDateRange
  ): Promise<DailyMetricInput[]> {
    const urn = accountId.startsWith("urn:")
      ? accountId
      : `urn:li:sponsoredAccount:${accountId}`;
    const metrics: DailyMetricInput[] = [];

    try {
      // LinkedIn Analytics finder — field names depend on API version
      const path =
        `adAnalytics?q=analytics` +
        `&pivot=ACCOUNT` +
        `&timeGranularity=DAILY` +
        `&dateRange=(start:(year:${range.since.slice(0, 4)},month:${Number(range.since.slice(5, 7))},day:${Number(range.since.slice(8, 10))}),` +
        `end:(year:${range.until.slice(0, 4)},month:${Number(range.until.slice(5, 7))},day:${Number(range.until.slice(8, 10))}))` +
        `&accounts=List(${encodeURIComponent(urn)})` +
        `&fields=impressions,clicks,costInLocalCurrency,externalWebsiteConversions,externalWebsiteConversionAmount,dateRange`;

      const json = await linkedInGet(path.replace(/^adAnalytics\?/, "adAnalytics?"), ctx.accessToken);
      // linkedInGet expects path without full query in some cases — use raw fetch path
      void json;
    } catch {
      // fall through to raw analytics call
    }

    try {
      const resp = await fetch(
        `https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=ACCOUNT&timeGranularity=DAILY` +
          `&dateRange=(start:(year:${range.since.slice(0, 4)},month:${Number(range.since.slice(5, 7))},day:${Number(range.since.slice(8, 10))}),` +
          `end:(year:${range.until.slice(0, 4)},month:${Number(range.until.slice(5, 7))},day:${Number(range.until.slice(8, 10))}))` +
          `&accounts=List(${encodeURIComponent(urn)})`,
        {
          headers: {
            Authorization: `Bearer ${ctx.accessToken}`,
            "LinkedIn-Version": process.env.LINKEDIN_API_VERSION || "202405",
            "X-Restli-Protocol-Version": "2.0.0",
          },
        }
      );
      const json = await resp.json();
      if (!resp.ok) {
        console.warn("[linkedin] adAnalytics error:", json?.message || resp.status);
        return metrics;
      }
      for (const el of json.elements || []) {
        const start = el.dateRange?.start;
        const metricDate = start
          ? `${start.year}-${String(start.month).padStart(2, "0")}-${String(start.day).padStart(2, "0")}`
          : range.since;
        const base = emptyAggregatedMetrics();
        base.impressions = num(el.impressions);
        base.clicks = num(el.clicks);
        base.spend = num(el.costInLocalCurrency);
        base.conversions = num(el.externalWebsiteConversions);
        base.conversionValue = num(el.externalWebsiteConversionAmount);
        const derived = deriveMetricRates(base);
        metrics.push({
          entityType: "account",
          entityExternalId: String(accountId).replace(/^urn:li:sponsoredAccount:/, ""),
          metricDate,
          ...derived,
          raw: el,
        });
      }
    } catch (e: any) {
      console.warn("[linkedin] metrics fetch failed:", e?.message);
    }

    return metrics;
  },

  async refreshAccessToken(ctx: AdsProviderContext) {
    if (!ctx.refreshToken) return null;
    const refreshed = await refreshLinkedInAccessToken(ctx.refreshToken);
    return {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken || ctx.refreshToken,
      expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    };
  },
};
