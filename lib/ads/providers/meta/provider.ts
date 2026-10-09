import type { AdsProvider, AdsProviderContext } from "@/lib/ads/providers/types";
import type {
  DailyMetricInput,
  DiscoveredAdAccount,
  DiscoveredAsset,
  PlatformEntityInput,
  SyncDateRange,
} from "@/lib/ads/types";
import { deriveMetricRates, emptyAggregatedMetrics } from "@/lib/ads/types";
import {
  ensureActPrefix,
  metaGraphGet,
  metaGraphGetAll,
  META_INSIGHT_FIELDS,
  stripActPrefix,
} from "@/lib/ads/providers/meta/client";

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

function insightToMetric(
  row: any,
  entityType: DailyMetricInput["entityType"],
  entityExternalId: string
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
  // Prefer API-provided rates when present
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
    raw: row,
  };
}

export const metaAdsProvider: AdsProvider = {
  id: "meta",

  async listAdAccounts(ctx: AdsProviderContext): Promise<DiscoveredAdAccount[]> {
    const data = await metaGraphGetAll<any>(
      "me/adaccounts",
      ctx.accessToken,
      {
        fields: "id,account_id,name,currency,timezone_name,account_status,business",
        limit: 100,
      }
    );
    return data.map((a) => ({
      accountId: stripActPrefix(a.account_id || a.id) || String(a.id),
      name: a.name ?? null,
      currency: a.currency ?? null,
      timezone: a.timezone_name ?? null,
      status: a.account_status != null ? String(a.account_status) : null,
      raw: a,
      metadata: { business: a.business ?? null },
    }));
  },

  async listAssets(ctx: AdsProviderContext): Promise<DiscoveredAsset[]> {
    const assets: DiscoveredAsset[] = [];
    try {
      const pages = await metaGraphGetAll<any>("me/accounts", ctx.accessToken, {
        fields: "id,name,category,access_token,tasks,instagram_business_account",
        limit: 100,
      });
      for (const p of pages) {
        assets.push({
          type: "page",
          externalId: String(p.id),
          name: p.name,
          status: "active",
          raw: { ...p, access_token: undefined },
          metadata: {
            category: p.category,
            tasks: p.tasks,
            hasPageToken: !!p.access_token,
            igUserId: p.instagram_business_account?.id ?? null,
          },
        });
      }
    } catch (e: any) {
      console.warn("[meta] list pages failed:", e?.message);
    }

    try {
      const businesses = await metaGraphGetAll<any>("me/businesses", ctx.accessToken, {
        fields: "id,name",
        limit: 50,
      });
      for (const b of businesses) {
        assets.push({
          type: "business",
          externalId: String(b.id),
          name: b.name,
          raw: b,
        });
      }
    } catch (e: any) {
      // business_management may be pending review
      console.warn("[meta] list businesses failed (may need advanced access):", e?.message);
    }

    return assets;
  },

  async fetchEntities(
    ctx: AdsProviderContext,
    accountId: string
  ): Promise<PlatformEntityInput[]> {
    const act = ensureActPrefix(accountId);
    if (!act) throw new Error("Invalid Meta ad account id");
    const entities: PlatformEntityInput[] = [];

    const campaigns = await metaGraphGetAll<any>(`${act}/campaigns`, ctx.accessToken, {
      fields: "id,name,objective,status,daily_budget,lifetime_budget,start_time,stop_time",
      limit: 100,
    });
    for (const c of campaigns) {
      entities.push({
        entityType: "campaign",
        externalId: String(c.id),
        name: c.name,
        status: c.status,
        objective: c.objective,
        dailyBudget: c.daily_budget,
        lifetimeBudget: c.lifetime_budget,
        raw: c,
      });
    }

    const adsets = await metaGraphGetAll<any>(`${act}/adsets`, ctx.accessToken, {
      fields: "id,name,status,campaign_id,daily_budget,lifetime_budget,start_time,end_time",
      limit: 100,
    });
    for (const a of adsets) {
      entities.push({
        entityType: "adset",
        externalId: String(a.id),
        parentExternalId: a.campaign_id ? String(a.campaign_id) : null,
        name: a.name,
        status: a.status,
        dailyBudget: a.daily_budget,
        lifetimeBudget: a.lifetime_budget,
        raw: a,
      });
    }

    const ads = await metaGraphGetAll<any>(`${act}/ads`, ctx.accessToken, {
      fields: "id,name,status,effective_status,adset_id,campaign_id,creative{id,name,thumbnail_url,object_story_spec}",
      limit: 100,
    });
    for (const ad of ads) {
      entities.push({
        entityType: "ad",
        externalId: String(ad.id),
        parentExternalId: ad.adset_id ? String(ad.adset_id) : null,
        name: ad.name,
        status: ad.effective_status || ad.status,
        raw: ad,
        metadata: { campaignId: ad.campaign_id, creative: ad.creative ?? null },
      });
      if (ad.creative?.id) {
        entities.push({
          entityType: "creative",
          externalId: String(ad.creative.id),
          parentExternalId: String(ad.id),
          name: ad.creative.name ?? null,
          raw: ad.creative,
        });
      }
    }

    try {
      const forms = await metaGraphGetAll<any>(`${act}/leadgen_forms`, ctx.accessToken, {
        fields: "id,name,status",
        limit: 50,
      });
      for (const f of forms) {
        entities.push({
          entityType: "lead_form",
          externalId: String(f.id),
          name: f.name,
          status: f.status,
          raw: f,
        });
      }
    } catch (e: any) {
      console.warn("[meta] lead forms unavailable:", e?.message);
    }

    return entities;
  },

  async fetchDailyMetrics(
    ctx: AdsProviderContext,
    accountId: string,
    range: SyncDateRange
  ): Promise<DailyMetricInput[]> {
    const act = ensureActPrefix(accountId);
    if (!act) throw new Error("Invalid Meta ad account id");
    const timeRange = JSON.stringify({ since: range.since, until: range.until });
    const metrics: DailyMetricInput[] = [];

    // Account-level daily
    try {
      const accountRows = await metaGraphGetAll<any>(`${act}/insights`, ctx.accessToken, {
        fields: META_INSIGHT_FIELDS,
        time_range: timeRange,
        time_increment: 1,
        level: "account",
        limit: 500,
      });
      for (const row of accountRows) {
        metrics.push(
          insightToMetric(row, "account", stripActPrefix(accountId) || accountId)
        );
      }
    } catch (e: any) {
      console.warn("[meta] account insights failed:", e?.message);
    }

    // Campaign-level daily
    try {
      const campaignRows = await metaGraphGetAll<any>(`${act}/insights`, ctx.accessToken, {
        fields: META_INSIGHT_FIELDS + ",campaign_id,campaign_name",
        time_range: timeRange,
        time_increment: 1,
        level: "campaign",
        limit: 500,
      });
      for (const row of campaignRows) {
        const id = String(row.campaign_id || "");
        if (!id) continue;
        metrics.push(insightToMetric(row, "campaign", id));
      }
    } catch (e: any) {
      console.warn("[meta] campaign insights failed:", e?.message);
    }

    // Ad-level (optional, may be large)
    try {
      const adRows = await metaGraphGetAll<any>(
        `${act}/insights`,
        ctx.accessToken,
        {
          fields: META_INSIGHT_FIELDS + ",ad_id,ad_name",
          time_range: timeRange,
          time_increment: 1,
          level: "ad",
          limit: 500,
        },
        5
      );
      for (const row of adRows) {
        const id = String(row.ad_id || "");
        if (!id) continue;
        metrics.push(insightToMetric(row, "ad", id));
      }
    } catch (e: any) {
      console.warn("[meta] ad insights failed:", e?.message);
    }

    return metrics;
  },
};

/** Exchange short-lived token for long-lived (~60d) user token. */
export async function exchangeMetaLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn?: number }> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const version = process.env.FACEBOOK_API_VERSION || "23.0";
  if (!appId || !appSecret) throw new Error("FACEBOOK_APP_ID/SECRET not configured");

  const qs = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLivedToken,
  });
  const res = await fetch(
    `https://graph.facebook.com/v${version}/oauth/access_token?${qs}`
  );
  const json = await res.json();
  if (json.error || !json.access_token) {
    throw new Error(json.error?.message || "Meta long-lived token exchange failed");
  }
  return { accessToken: json.access_token, expiresIn: json.expires_in };
}

export async function debugMetaToken(inputToken: string): Promise<any> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) return null;
  const appToken = `${appId}|${appSecret}`;
  return metaGraphGet("debug_token", appToken, { input_token: inputToken });
}
