import type { AdsProvider, AdsProviderContext } from "@/lib/ads/providers/types";
import type {
  DiscoveredAdAccount,
  DiscoveredAsset,
  FetchDailyMetricsResult,
  PlatformEntityInput,
  SyncDateRange,
} from "@/lib/ads/types";
import {
  ensureActPrefix,
  metaGraphGet,
  metaGraphGetAll,
  stripActPrefix,
} from "@/lib/ads/providers/meta/client";
import { collectMetaDailyMetrics } from "@/lib/ads/providers/meta/fetch-daily-metrics";

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
  ): Promise<FetchDailyMetricsResult> {
    return collectMetaDailyMetrics({
      accountId,
      accessToken: ctx.accessToken,
      range,
      currency: ctx.accountCurrency ?? null,
    });
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
