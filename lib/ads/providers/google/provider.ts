import type { AdsProvider, AdsProviderContext } from "@/lib/ads/providers/types";
import type {
  DailyMetricInput,
  DiscoveredAdAccount,
  PlatformEntityInput,
  SyncDateRange,
} from "@/lib/ads/types";
import { deriveMetricRates, emptyAggregatedMetrics } from "@/lib/ads/types";
import {
  googleAdsSearch,
  listAccessibleCustomers,
  refreshGoogleAdsAccessToken,
} from "@/lib/ads/providers/google/client";

function microsToCurrency(micros: unknown): number {
  const n = Number(micros ?? 0);
  if (!Number.isFinite(n)) return 0;
  return n / 1_000_000;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export const googleAdsProvider: AdsProvider = {
  id: "google-ads",

  async listAdAccounts(ctx: AdsProviderContext): Promise<DiscoveredAdAccount[]> {
    const customerIds = await listAccessibleCustomers(ctx.accessToken);
    const accounts: DiscoveredAdAccount[] = [];
    const loginId =
      ctx.managerCustomerId ||
      (ctx.metadata?.managerCustomerId as string | undefined) ||
      process.env.GOOGLE_ADS_MANAGER_ID ||
      null;

    for (const cid of customerIds) {
      try {
        const rows = await googleAdsSearch(
          cid,
          ctx.accessToken,
          `
          SELECT
            customer.id,
            customer.descriptive_name,
            customer.currency_code,
            customer.time_zone,
            customer.manager,
            customer.status
          FROM customer
          LIMIT 1
          `,
          // When querying a client under MCC, pass login-customer-id
          loginId && loginId !== cid ? loginId : cid === loginId ? null : loginId
        );
        const c = rows[0]?.customer;
        accounts.push({
          accountId: String(c?.id || cid),
          name: c?.descriptiveName || c?.descriptive_name || `Customer ${cid}`,
          currency: c?.currencyCode || c?.currency_code || null,
          timezone: c?.timeZone || c?.time_zone || null,
          status: String(c?.status ?? "UNKNOWN"),
          raw: c || { id: cid },
          metadata: {
            isManager: !!(c?.manager),
            resourceName: `customers/${cid}`,
          },
        });
      } catch (e: any) {
        // Still surface the accessible id even if detail query fails
        accounts.push({
          accountId: cid,
          name: `Customer ${cid}`,
          status: "UNKNOWN",
          raw: { id: cid, error: e?.message },
          metadata: { detailError: e?.message },
        });
      }
    }

    // Also list client accounts under MCC when a manager is known
    const managers = accounts.filter((a) => a.metadata?.isManager);
    for (const m of managers) {
      try {
        const rows = await googleAdsSearch(
          m.accountId,
          ctx.accessToken,
          `
          SELECT
            customer_client.client_customer,
            customer_client.descriptive_name,
            customer_client.currency_code,
            customer_client.time_zone,
            customer_client.status,
            customer_client.manager,
            customer_client.id
          FROM customer_client
          WHERE customer_client.level <= 1
          `,
          m.accountId
        );
        for (const row of rows) {
          const cc = row.customerClient || row.customer_client;
          if (!cc) continue;
          const id = String(cc.id || "").replace(/-/g, "");
          if (!id || accounts.some((a) => a.accountId === id)) continue;
          accounts.push({
            accountId: id,
            name: cc.descriptiveName || cc.descriptive_name || `Client ${id}`,
            currency: cc.currencyCode || cc.currency_code || null,
            timezone: cc.timeZone || cc.time_zone || null,
            status: String(cc.status ?? "UNKNOWN"),
            raw: cc,
            metadata: {
              isManager: !!(cc.manager),
              managerId: m.accountId,
            },
          });
        }
      } catch (e: any) {
        console.warn("[google-ads] customer_client list failed:", e?.message);
      }
    }

    return accounts;
  },

  async fetchEntities(
    ctx: AdsProviderContext,
    accountId: string
  ): Promise<PlatformEntityInput[]> {
    const loginId =
      ctx.managerCustomerId ||
      (ctx.metadata?.managerCustomerId as string | undefined) ||
      null;
    const entities: PlatformEntityInput[] = [];

    const campaignRows = await googleAdsSearch(
      accountId,
      ctx.accessToken,
      `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign.advertising_channel_type,
        campaign_budget.amount_micros
      FROM campaign
      ORDER BY campaign.id
      `,
      loginId
    );
    for (const row of campaignRows) {
      const c = row.campaign;
      if (!c?.id) continue;
      entities.push({
        entityType: "campaign",
        externalId: String(c.id),
        name: c.name,
        status: String(c.status ?? ""),
        objective: c.advertisingChannelType || c.advertising_channel_type || null,
        dailyBudget: microsToCurrency(
          row.campaignBudget?.amountMicros ?? row.campaign_budget?.amount_micros
        ),
        currency: null,
        raw: row,
      });
    }

    const adGroupRows = await googleAdsSearch(
      accountId,
      ctx.accessToken,
      `
      SELECT
        ad_group.id,
        ad_group.name,
        ad_group.status,
        campaign.id
      FROM ad_group
      `,
      loginId
    );
    for (const row of adGroupRows) {
      const ag = row.adGroup || row.ad_group;
      if (!ag?.id) continue;
      entities.push({
        entityType: "ad_group",
        externalId: String(ag.id),
        parentExternalId: row.campaign?.id != null ? String(row.campaign.id) : null,
        name: ag.name,
        status: String(ag.status ?? ""),
        raw: row,
      });
    }

    try {
      const adRows = await googleAdsSearch(
        accountId,
        ctx.accessToken,
        `
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          ad_group_ad.status,
          ad_group.id,
          campaign.id
        FROM ad_group_ad
        `,
        loginId
      );
      for (const row of adRows) {
        const ad = row.adGroupAd?.ad || row.ad_group_ad?.ad;
        const ag = row.adGroup || row.ad_group;
        if (!ad?.id) continue;
        entities.push({
          entityType: "ad",
          externalId: String(ad.id),
          parentExternalId: ag?.id != null ? String(ag.id) : null,
          name: ad.name || `Ad ${ad.id}`,
          status: String(row.adGroupAd?.status || row.ad_group_ad?.status || ""),
          raw: row,
        });
      }
    } catch (e: any) {
      console.warn("[google-ads] ad_group_ad fetch failed:", e?.message);
    }

    try {
      const kwRows = await googleAdsSearch(
        accountId,
        ctx.accessToken,
        `
        SELECT
          ad_group_criterion.criterion_id,
          ad_group_criterion.keyword.text,
          ad_group_criterion.keyword.match_type,
          ad_group_criterion.status,
          ad_group.id
        FROM ad_group_criterion
        WHERE ad_group_criterion.type = 'KEYWORD'
        `,
        loginId
      );
      for (const row of kwRows) {
        const crit = row.adGroupCriterion || row.ad_group_criterion;
        const id = crit?.criterionId || crit?.criterion_id;
        if (!id) continue;
        const kw = crit.keyword;
        entities.push({
          entityType: "keyword",
          externalId: String(id),
          parentExternalId:
            row.adGroup?.id != null || row.ad_group?.id != null
              ? String(row.adGroup?.id || row.ad_group?.id)
              : null,
          name: kw?.text || `Keyword ${id}`,
          status: String(crit.status ?? ""),
          raw: row,
          metadata: { matchType: kw?.matchType || kw?.match_type },
        });
      }
    } catch (e: any) {
      console.warn("[google-ads] keyword fetch failed:", e?.message);
    }

    return entities;
  },

  async fetchDailyMetrics(
    ctx: AdsProviderContext,
    accountId: string,
    range: SyncDateRange
  ): Promise<DailyMetricInput[]> {
    const loginId =
      ctx.managerCustomerId ||
      (ctx.metadata?.managerCustomerId as string | undefined) ||
      null;
    const metrics: DailyMetricInput[] = [];

    const accountRows = await googleAdsSearch(
      accountId,
      ctx.accessToken,
      `
      SELECT
        customer.id,
        segments.date,
        metrics.cost_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc
      FROM customer
      WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'
      `,
      loginId
    );

    for (const row of accountRows) {
      const date = row.segments?.date;
      if (!date) continue;
      const m = row.metrics || {};
      const base = emptyAggregatedMetrics();
      base.spend = microsToCurrency(m.costMicros ?? m.cost_micros);
      base.impressions = num(m.impressions);
      base.clicks = num(m.clicks);
      base.conversions = num(m.conversions);
      base.conversionValue = num(m.conversionsValue ?? m.conversions_value);
      const derived = deriveMetricRates(base);
      if (m.ctr != null) derived.ctr = num(m.ctr) * (num(m.ctr) <= 1 ? 100 : 1);
      if (m.averageCpc != null || m.average_cpc != null) {
        derived.cpc = microsToCurrency(m.averageCpc ?? m.average_cpc);
      }
      metrics.push({
        entityType: "account",
        entityExternalId: accountId,
        metricDate: String(date).slice(0, 10),
        ...derived,
        raw: row,
      });
    }

    try {
      const campaignRows = await googleAdsSearch(
        accountId,
        ctx.accessToken,
        `
        SELECT
          campaign.id,
          campaign.name,
          segments.date,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.conversions,
          metrics.conversions_value,
          metrics.ctr,
          metrics.average_cpc
        FROM campaign
        WHERE segments.date BETWEEN '${range.since}' AND '${range.until}'
        `,
        loginId
      );
      for (const row of campaignRows) {
        const date = row.segments?.date;
        const cid = row.campaign?.id;
        if (!date || !cid) continue;
        const m = row.metrics || {};
        const base = emptyAggregatedMetrics();
        base.spend = microsToCurrency(m.costMicros ?? m.cost_micros);
        base.impressions = num(m.impressions);
        base.clicks = num(m.clicks);
        base.conversions = num(m.conversions);
        base.conversionValue = num(m.conversionsValue ?? m.conversions_value);
        const derived = deriveMetricRates(base);
        metrics.push({
          entityType: "campaign",
          entityExternalId: String(cid),
          metricDate: String(date).slice(0, 10),
          ...derived,
          raw: row,
        });
      }
    } catch (e: any) {
      console.warn("[google-ads] campaign metrics failed:", e?.message);
    }

    return metrics;
  },

  async refreshAccessToken(ctx: AdsProviderContext) {
    if (!ctx.refreshToken) return null;
    const refreshed = await refreshGoogleAdsAccessToken(ctx.refreshToken);
    const expiresAt = new Date(
      Date.now() + refreshed.expiresIn * 1000
    ).toISOString();
    return {
      accessToken: refreshed.accessToken,
      refreshToken: ctx.refreshToken,
      expiresAt,
    };
  },
};
