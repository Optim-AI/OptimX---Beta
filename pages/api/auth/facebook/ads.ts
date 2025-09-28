// pages/api/facebook/ads.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const version = process.env.FACEBOOK_API_VERSION || "23.0";

async function readSaved(): Promise<{
  pageAccessToken?: string;
  userAccessToken?: string;
  pageId?: string;
  adAccountId?: string;
}> {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

async function writeSaved(obj: any) {
  await fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 2), "utf8");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const {
    campaignName,
    budget,
    adSetName,
    targeting,
    creativeCaption,
    creativeImageUrl,
  } = req.body;

  if (!campaignName || !budget || !adSetName || !creativeImageUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const saved = await readSaved();

    // Normalize adAccountId, strip "act_" if present
    let rawAd = saved.adAccountId || "";
    if (typeof rawAd === "number") rawAd = String(rawAd);
    rawAd = rawAd.replace(/^act_/, "");

    const accessToken = saved.userAccessToken || saved.pageAccessToken;
    if (!rawAd) {
      if (!accessToken) {
        return res.status(400).json({ error: "No ad account configured and no token available to discover it" });
      }

      // Auto-discover ad accounts via Graph API
      const accountsResp = await fetch(
        `https://graph.facebook.com/v${version}/me/adaccounts?access_token=${accessToken}`
      );
      const accountsJson = await accountsResp.json();

      if (accountsJson.error) {
        return res.status(400).json({ error: "Error fetching ad accounts", details: accountsJson });
      }

      if (accountsJson.data && accountsJson.data.length > 0) {
        const acctId = accountsJson.data[0].id.replace(/^act_/, "");
        rawAd = acctId;
        saved.adAccountId = acctId;
        try {
          await writeSaved(saved);
        } catch (e) {
          console.warn("Warning: Could not write saved file (maybe running in serverless environment)", e);
        }
      } else {
        return res.status(400).json({ error: "No ad account found for this user/token", details: accountsJson });
      }
    }

    const adAccountId = rawAd;
    if (!adAccountId) {
      return res.status(400).json({ error: "No ad account configured" });
    }

    if (!accessToken) {
      return res.status(400).json({ error: "No access token available with required permissions" });
    }

    // 1) Create Campaign
    const campaignUrl = `https://graph.facebook.com/v${version}/act_${adAccountId}/campaigns`;
    const campaignParams = new URLSearchParams({
      name: campaignName,
      objective: "OUTCOME_TRAFFIC",   // changed from LINK_CLICKS to supported objective
      status: "PAUSED",
      access_token: accessToken,
      special_ad_categories: JSON.stringify(["NONE"]),  // since this is for testing / non-special
    });

    const campaignResp = await fetch(campaignUrl, { method: "POST", body: campaignParams });
    const campaignJson = await campaignResp.json();
    if (campaignJson.error) {
      return res.status(400).json({ step: "createCampaign", error: campaignJson });
    }

    // 2) Create Ad Set
    const adsetUrl = `https://graph.facebook.com/v${version}/act_${adAccountId}/adsets`;
    const adsetParams = new URLSearchParams({
      name: adSetName,
      campaign_id: campaignJson.id,
      daily_budget: String(budget),
      billing_event: "IMPRESSIONS",
      optimization_goal: "REACH",  // or choose appropriate goal
      status: "PAUSED",
      targeting: JSON.stringify(targeting || {}),
      access_token: accessToken,
    });

    const adsetResp = await fetch(adsetUrl, { method: "POST", body: adsetParams });
    const adsetJson = await adsetResp.json();
    if (adsetJson.error) {
      return res.status(400).json({ step: "createAdSet", error: adsetJson });
    }

    // 3) Create Creative
    const creativeUrl = `https://graph.facebook.com/v${version}/act_${adAccountId}/adcreatives`;
    const object_story_spec = {
      page_id: saved.pageId,
      link_data: {
        image_url: creativeImageUrl,
        message: creativeCaption || "",
        link: creativeImageUrl,
      },
    };

    const creativeParams = new URLSearchParams({
      name: "AutoCreative",
      object_story_spec: JSON.stringify(object_story_spec),
      access_token: accessToken,
    });

    const creativeResp = await fetch(creativeUrl, { method: "POST", body: creativeParams });
    const creativeJson = await creativeResp.json();
    if (creativeJson.error) {
      return res.status(400).json({ step: "createCreative", error: creativeJson });
    }

    // 4) Create Ad
    const adUrl = `https://graph.facebook.com/v${version}/act_${adAccountId}/ads`;
    const adParams = new URLSearchParams({
      name: "AutoAd",
      adset_id: adsetJson.id,
      creative: JSON.stringify({ creative_id: creativeJson.id }),
      status: "PAUSED",
      access_token: accessToken,
    });

    const adResp = await fetch(adUrl, { method: "POST", body: adParams });
    const adJson = await adResp.json();
    if (adJson.error) {
      return res.status(400).json({ step: "createAd", error: adJson });
    }

    return res.status(200).json({
      campaign: campaignJson,
      adset: adsetJson,
      creative: creativeJson,
      ad: adJson,
    });

  } catch (err) {
    console.error("ads handler error:", err);
    return res.status(500).json({ error: "Internal server error", details: (err as any).toString() });
  }
}
