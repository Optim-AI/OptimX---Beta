// pages/api/ai/recommendationsMeta.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";
const OPENAI_KEY = process.env.OPENAI_API_KEY ?? "";

type GraphResp = { ok: boolean; status: number; json: any | null; text: string; url: string };

async function readSaved(): Promise<any | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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

// limit helper
function take<T>(arr: T[] | undefined, n = 5): T[] {
  if (!arr) return [];
  return arr.slice(0, n);
}

// tiny formatter
function isoDate(d: Date) { return d.toISOString().slice(0,10); }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!OPENAI_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY env var" });

  try {
    const saved = await readSaved();
    if (!saved) return res.status(500).json({ error: "Missing data/instagram.json" });

    const userAccessToken: string | undefined =
      saved?.userAccessToken ??
      saved?.user_access_token ??
      saved?.tokenJson?.access_token ??
      process.env.PAGE_ACCESS_TOKEN ??
      process.env.USER_ACCESS_TOKEN;

    const pageAccessToken: string | undefined = saved?.pageAccessToken ?? saved?.page_access_token;
    const adAccountRaw: string | undefined = saved?.adAccountId ?? saved?.raw?.adAccountsJson?.data?.[0]?.account_id ?? process.env.AD_ACCOUNT_ID;
    const igUserId: string | undefined = saved?.igUserId ?? saved?.instagram_business_account?.id ?? process.env.IG_USER_ID;
    const pageId: string | undefined = saved?.pageId ?? process.env.PAGE_ID;

    if (!userAccessToken || !adAccountRaw || !igUserId) {
      return res.status(400).json({ error: "Missing userAccessToken/adAccountId/igUserId in data/instagram.json or env" });
    }

    // normalize ad account id
    const numericAdId = String(adAccountRaw).replace(/^act_/, "");
    const adAccountGraphId = `act_${numericAdId}`;

    // date range (last 7 days)
    const today = new Date();
    const end = new Date(today); end.setDate(end.getDate() - 1);
    const start = new Date(end); start.setDate(start.getDate() - 6);
    const range = { since: isoDate(start), until: isoDate(end) };

    const tokenEnc = encodeURIComponent(userAccessToken);

    // 1) Fetch campaigns (limited)
    const campaignsUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(adAccountGraphId)}/campaigns?fields=id,name,status,daily_budget,lifetime_budget&limit=50&access_token=${tokenEnc}`;
    const campResp = await graphFetchJson(campaignsUrl);

    const campaigns: any[] = Array.isArray(campResp.json?.data) ? campResp.json.data : [];

    // pick top campaigns by daily_budget or fallback first ones
    const rankedCampaigns = campaigns
      .map((c:any) => ({ ...c, _daily: Number(c.daily_budget || 0) }))
      .sort((a,b) => b._daily - a._daily)
      .slice(0, 8); // limit to 8 campaigns

    // helper to fetch insights for object id (campaign/adset/ad)
    async function fetchInsightsFor(objectId: string, fields: string[], timeRange = range) {
      const timeRangeStr = encodeURIComponent(JSON.stringify(timeRange));
      const f = encodeURIComponent(fields.join(","));
      const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(objectId)}/insights?time_range=${timeRangeStr}&fields=${f}&access_token=${tokenEnc}&limit=500`;
      return await graphFetchJson(url);
    }

    // prepare structure
    const summary: any = { meta: { adAccount: adAccountGraphId, range, campaigns: [] }, ig: { igUserId, recentMedia: [] }, debug: { campaignsUrl: campResp.url, campaignsRaw: campResp.json ? true : false } };

    // 2) For each campaign fetch campaign insights + adsets + ads (limit)
    for (const c of rankedCampaigns) {
      const campId: string = c.id;
      const campName: string = c.name ?? "";
      const campStatus: string = c.status ?? "";
      // campaign insights
      const ci = await fetchInsightsFor(campId, ["impressions","spend","reach","clicks","ctr","actions","action_values"]);
      const campInsights = ci.json?.data ?? [];

      // adsets under campaign
      const adsetsUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(campId)}/adsets?fields=id,name,status,daily_budget,lifetime_budget&limit=20&access_token=${tokenEnc}`;
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

      // ads under campaign (limit)
      const adsUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(campId)}/ads?fields=id,name,status,adset_id,effective_status&limit=50&access_token=${tokenEnc}`;
      const adsResp = await graphFetchJson(adsUrl);
      const ads = Array.isArray(adsResp.json?.data) ? adsResp.json.data : [];
      // rank ads by name or status (fetch insights for top few)
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

    // 3) Fetch recent IG media (likes/comments)
    const igUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&limit=30&access_token=${tokenEnc}`;
    const igResp = await graphFetchJson(igUrl);
    const igMedia = Array.isArray(igResp.json?.data) ? igResp.json.data : [];
    // Keep top 12 recent
    summary.ig.recentMedia = take(igMedia, 12);
    summary.debug.igRaw = !!igResp.json;

    // Build a compact payload to send to OpenAI — keep size bounded
    // We'll include top campaigns, their last insight row (if exists), top adset/ad metrics, and recent media stats.
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

    // -- Prepare prompt for OpenAI --
    // Instructions: analyze the campaigns/posts and return strict JSON recommendations.
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

Prioritize high impact items first. Use the metrics in 'last_insight' / adset/ad insight / post likes/comments to explain reasons. If data is missing for an object, recommend collecting the data or fixing permissions. Keep output JSON-only (no surrounding text).
`;

    const userPrompt = `Data (compact):\n${JSON.stringify(compact, null, 2)}\n\nProduce recommendations as JSON per schema. Limit to ~8 recommendations.`;

    // call OpenAI Chat API
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // change if needed or not available
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

    // Attempt to parse assistant output from the chat-completions wrapper or raw
    let parsed: any = null;
    let assistantText: string | null = null;
    try {
      const wrapper = JSON.parse(rawText);
      assistantText = wrapper?.choices?.[0]?.message?.content ?? wrapper?.choices?.[0]?.text ?? null;
    } catch {
      assistantText = rawText;
    }

    // Clean assistant text (strip fences)
    if (typeof assistantText === "string") {
      const cleaned = assistantText.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // try to find first {...}
        const first = cleaned.indexOf("{");
        const last = cleaned.lastIndexOf("}");
        if (first !== -1 && last !== -1 && last > first) {
          try {
            parsed = JSON.parse(cleaned.slice(first, last+1));
          } catch {
            parsed = null;
          }
        } else {
          parsed = null;
        }
      }
    }

    return res.status(200).json({
      ok: true,
      compact,
      parsed,
      assistantText,
      rawOpenAI: rawText,
      debug: { campaignCount: summary.meta.campaigns.length }
    });

  } catch (err: any) {
    console.error("recommendationsMeta error:", err);
    return res.status(500).json({ ok: false, error: err?.message ?? String(err) });
  }
}
