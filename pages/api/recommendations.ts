// pages/api/ai/recommendationsMeta.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { readSavedIntegration } from "../../lib/integrationStore";
import { getUserIdFromRequest } from "../../lib/requestHelpers";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

type GraphResp = { ok: boolean; status: number; json: any | null; text: string; url: string };

async function graphFetchJson(url: string): Promise<GraphResp> {
  try {
    const r = await fetch(url);
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch { json = null; }
    return { ok: r.ok, status: r.status, json, text, url };
  } catch (err: any) {
    return { ok: false, status: 500, json: null, text: String(err), url };
  }
}

function take<T>(arr: T[] | undefined, n = 5): T[] {
  if (!arr) return [];
  return arr.slice(0, n);
}
function isoDate(d: Date) { return d.toISOString().slice(0,10); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  if (!OPENAI_KEY) {
    res.status(500).json({ ok: false, error: "Missing OPENAI_API_KEY in environment" });
    return;
  }

  try {
    // Try to resolve user from request (optional). If present, readSavedIntegration will prefer that user's row.
    let userId: string | null = null;
    try {
      userId = await getUserIdFromRequest(req);
    } catch (e) {
      userId = null;
    }

    const savedRaw = await readSavedIntegration({ userId: userId ?? undefined, provider: "meta" });

    if (!savedRaw) {
      return res.status(400).json({
        ok: false,
        error:
          "No integration found in Supabase (integrations table). Create/connect a Meta integration first."
      });
    }

    // Defensive cast so we can check multiple possible key names without TypeScript complaints:
    const s: any = savedRaw;

    // Preferred canonical keys from your helper:
    const userAccessToken: string | undefined =
      s.userAccessToken ?? s.longUserToken ?? s.user_access_token ?? s.refresh_token ?? undefined;

    const pageAccessToken: string | undefined =
      s.pageAccessToken ?? s.page_access_token ?? s.access_token ?? undefined;

    const adAccountRaw: string | undefined =
      s.adAccountId ?? s.ad_account_id ?? s.adAccountIdRaw ?? s.adAccount ?? undefined;

    const igUserId: string | undefined =
      s.igUserId ?? s.ig_user_id ?? s.provider_user_id ?? undefined;

    const pageId: string | undefined =
      s.pageId ?? s.page_id ?? undefined;

    // Strict: no local file fallback. Return clear errors if required pieces absent.
    if (!adAccountRaw) {
      return res.status(400).json({ ok: false, error: "Missing ad account id in integrations row (adAccountId / ad_account_id)." });
    }
    if (!igUserId) {
      return res.status(400).json({ ok: false, error: "Missing Instagram user id in integrations row (igUserId / ig_user_id)." });
    }
    if (!pageAccessToken && !userAccessToken) {
      return res.status(400).json({ ok: false, error: "Missing page or user access token in integration row (access_token/refresh_token)." });
    }

    // Normalize ad account id
    const numericAdId = String(adAccountRaw).replace(/^act_/, "").replace(/^act_act_/, "");
    const adAccountGraphId = `act_${numericAdId}`;

    // Range: last 7 days (ending yesterday)
    const today = new Date();
    const end = new Date(today); end.setDate(end.getDate() - 1);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    const range = { since: isoDate(start), until: isoDate(end) };

    // Choose token (prefer user token if present)
    const tokenToUse = encodeURIComponent(userAccessToken ?? pageAccessToken!);

    // 1) fetch campaigns
    const campaignsUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(adAccountGraphId)}/campaigns?fields=id,name,status,daily_budget,lifetime_budget&limit=50&access_token=${tokenToUse}`;
    const campResp = await graphFetchJson(campaignsUrl);
    const campaigns: any[] = Array.isArray(campResp.json?.data) ? campResp.json.data : [];

    const rankedCampaigns = campaigns
      .map((c:any) => ({ ...c, _daily: Number(c.daily_budget || 0) }))
      .sort((a:any,b:any) => b._daily - a._daily)
      .slice(0, 8);

    async function fetchInsightsFor(objectId: string, fields: string[], timeRange = range) {
      const timeRangeStr = encodeURIComponent(JSON.stringify(timeRange));
      const f = encodeURIComponent(fields.join(","));
      const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(objectId)}/insights?time_range=${timeRangeStr}&fields=${f}&access_token=${tokenToUse}&limit=500`;
      return await graphFetchJson(url);
    }

    const summary: any = {
      meta: { adAccount: adAccountGraphId, range, campaigns: [] },
      ig: { igUserId, recentMedia: [] },
      debug: { campaignsUrl: campResp.url, campaignsRaw: !!campResp.json, usedIntegrationRow: { id: s.savedRowId ?? null, pageId: !!pageId } }
    };

    // iterate campaigns -> adsets -> ads
    for (const c of rankedCampaigns) {
      const campId: string = c.id;
      const campName: string = c.name ?? "";
      const campStatus: string = c.status ?? "";

      const ci = await fetchInsightsFor(campId, ["impressions","spend","reach","clicks","ctr","actions","action_values"]);
      const campInsights = ci.json?.data ?? [];

      // adsets
      const adsetsUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(campId)}/adsets?fields=id,name,status,daily_budget,lifetime_budget&limit=20&access_token=${tokenToUse}`;
      const adsetsResp = await graphFetchJson(adsetsUrl);
      const adsets = Array.isArray(adsetsResp.json?.data) ? adsetsResp.json.data : [];
      const rankedAdsets = adsets
        .map((a:any) => ({ ...a, _daily: Number(a.daily_budget||0) }))
        .sort((a:any,b:any)=> b._daily - a._daily)
        .slice(0, 5);

      const adsetsWithInsights: any[] = [];
      for (const a of rankedAdsets) {
        const aId = a.id;
        const ai = await fetchInsightsFor(aId, ["impressions","spend","reach","clicks","ctr","actions","action_values"]);
        adsetsWithInsights.push({ ...a, insights: ai.json?.data ?? [] });
      }

      // ads
      const adsUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(campId)}/ads?fields=id,name,status,adset_id,effective_status&limit=50&access_token=${tokenToUse}`;
      const adsResp = await graphFetchJson(adsUrl);
      const ads = Array.isArray(adsResp.json?.data) ? adsResp.json.data : [];
      const rankedAds = ads.slice(0, 6);
      const adsWithInsights: any[] = [];
      for (const ad of rankedAds) {
        const adId = ad.id;
        const ai = await fetchInsightsFor(adId, ["impressions","spend","reach","clicks","ctr","actions","action_values"]);
        adsWithInsights.push({ ...ad, insights: ai.json?.data ?? [] });
      }

      summary.meta.campaigns.push({
        id: campId,
        name: campName,
        status: campStatus,
        daily_budget: c.daily_budget ?? null,
        lifetime_budget: c.lifetime_budget ?? null,
        insights: campInsights,
        adsets: adsetsWithInsights,
        ads: adsWithInsights,
        raw: { campaign: c, adsetsResp: adsetsResp.json, adsResp: adsResp.json, campInsightsRaw: ci.json }
      });
    }

    // 3) recent IG media
    const igUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=30&access_token=${tokenToUse}`;
    const igResp = await graphFetchJson(igUrl);
    const igMedia = Array.isArray(igResp.json?.data) ? igResp.json.data : [];
    summary.ig.recentMedia = take(igMedia, 12);
    summary.debug.igRaw = !!igResp.json;

    // compact payload
    function compactCampaign(c:any) {
      const lastIns = Array.isArray(c.insights) && c.insights.length > 0 ? c.insights[0] : null;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        daily_budget: c.daily_budget ?? null,
        lifetime_budget: c.lifetime_budget ?? null,
        last_insight: lastIns,
        top_adsets: (c.adsets || []).slice(0,3).map((as:any)=>({
          id: as.id, name: as.name, status: as.status, daily_budget: as.daily_budget ?? null, insight: (Array.isArray(as.insights) && as.insights.length>0) ? as.insights[0] : null
        })),
        top_ads: (c.ads || []).slice(0,3).map((ad:any)=>({
          id: ad.id, name: ad.name, status: ad.status, insight: (Array.isArray(ad.insights) && ad.insights.length>0) ? ad.insights[0] : null
        }))
      };
    }

    const compact = {
      ad_account: adAccountGraphId,
      range,
      campaigns: summary.meta.campaigns.map(compactCampaign),
      recent_media: summary.ig.recentMedia.map((m:any)=>({
        id: m.id, caption: m.caption, media_type: m.media_type, permalink: m.permalink, timestamp: m.timestamp, likes: m.like_count ?? 0, comments: m.comments_count ?? 0
      }))
    };

    // OpenAI prompt (strict JSON output)
    const systemPrompt = `
You are an expert Facebook/Instagram ads analyst. You will receive a JSON object named "data" that contains:
- ad_account id and a list of campaigns (each with id, name, status, budgets and last_insight),
- for each campaign a few top adsets and top ads with their latest insights,
- a list of recent instagram media (likes/comments).

Your task: analyze the actual metrics and content, identify the **top issues and opportunities**, and produce **actionable, prioritized** recommendations tied to the exact object that motivated the recommendation (campaign/adset/ad/post).

Return **ONLY** strict JSON in this exact schema:

{
  "recommendations": [
    {
      "title": "Short title",
      "impact": "High" | "Medium" | "Low",
      "related_to": { "type": "campaign"|"adset"|"ad"|"post"|"account", "id": "<id>" },
      "reason": "1-line explanation referencing metrics (e.g. campaign X CTR 0.3% vs avg 1.2%)",
      "actions": ["concrete step 1", "concrete step 2"],
      "estimate": "Estimated impact (e.g. ~10% lift in conversions) or 'unknown'"
    }
  ],
  "notes": "short freeform notes (optional)"
}

Prioritize high impact items first. Use metrics in 'last_insight' / adset/ad insight / post likes/comments to explain reasons. If data is missing for an object, recommend collecting the data or fixing permissions. Keep output JSON-only (no surrounding text).
`;
    const userPrompt = `Data (compact):\n${JSON.stringify(compact, null, 2)}\n\nProduce recommendations as JSON per schema. Limit to ~8 recommendations.`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt.trim() },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 900,
        top_p: 1
      })
    });

    const rawText = await openaiRes.text();

    let parsed: any = null;
    let assistantText: string | null = null;
    try {
      const wrapper = JSON.parse(rawText);
      assistantText = wrapper?.choices?.[0]?.message?.content ?? wrapper?.choices?.[0]?.text ?? null;
    } catch {
      assistantText = rawText;
    }

    if (typeof assistantText === "string") {
      const cleaned = assistantText.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");
        if (first !== -1 && last !== -1 && last > first) {
          try { parsed = JSON.parse(cleaned.slice(first, last + 1)); } catch { parsed = null; }
        } else parsed = null;
      }
    }

    return res.status(200).json({
      ok: true,
      compact,
      parsed,
      assistantText,
      rawOpenAI: rawText,
      debug: { campaignCount: summary.meta.campaigns.length, usedIntegrationRowId: s.savedRowId ?? null }
    });

  } catch (err: any) {
    console.error("recommendationsMeta error:", err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
}
