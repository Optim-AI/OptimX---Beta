// pages/api/facebook/ads.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const version = process.env.FACEBOOK_API_VERSION || "23.0";

async function readSaved(): Promise<any> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function writeSaved(obj: any) {
  try { await fs.writeFile(DATA_FILE, JSON.stringify(obj, null, 2), "utf8"); } catch (e) { /* ignore */ }
}

async function discoverAdAccount(accessToken: string) {
  const resp = await fetch(`https://graph.facebook.com/v${version}/me/adaccounts?access_token=${accessToken}`);
  const json = await resp.json();
  if (json.error) throw json;
  if (json.data && json.data.length) return String(json.data[0].id).replace(/^act_/, "");
  throw { message: "No ad account found for token", details: json };
}

async function discoverPageId(accessToken: string) {
  const resp = await fetch(`https://graph.facebook.com/v${version}/me/accounts?access_token=${accessToken}`);
  const json = await resp.json();
  if (json.error) throw json;
  if (json.data && json.data.length) return json.data[0].id;
  throw { message: "No page found for token", details: json };
}

async function uploadImageGetHash(adAccountId: string, accessToken: string, imageUrl: string) {
  // Use the adimages edge with url param (Graph supports posting url to /act_<id>/adimages).
  const url = `https://graph.facebook.com/v${version}/act_${adAccountId}/adimages`;
  const body = new URLSearchParams({ url: imageUrl, access_token: accessToken });
  const resp = await fetch(url, { method: "POST", body });
  const json = await resp.json();
  if (json.error) throw json;
  if (!json.images || Object.keys(json.images).length === 0) throw { message: "No images returned from upload", details: json };
  const hash = Object.keys(json.images)[0];
  return hash;
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
    destinationLink, // optional
  } = req.body ?? {};

  if (!campaignName || !budget || !adSetName || !creativeImageUrl) {
    return res.status(400).json({ error: "Missing required fields. Required: campaignName, budget, adSetName, creativeImageUrl" });
  }

  try {
    const saved = await readSaved();

    // tokens and account/page discovery
    let adAccountId = saved.adAccountId ? String(saved.adAccountId).replace(/^act_/, "") : "";
    const accessToken = saved.userAccessToken || saved.pageAccessToken;
    if (!accessToken) return res.status(400).json({ error: "No access token available (userAccessToken or pageAccessToken required in data file)" });

    if (!adAccountId) {
      try {
        adAccountId = await discoverAdAccount(accessToken);
        saved.adAccountId = adAccountId;
        await writeSaved(saved);
      } catch (e) {
        return res.status(400).json({ step: "discoverAdAccount", error: e });
      }
    }

    // ensure we have pageId for object_story_spec (required for page posts/creatives)
    let pageId = saved.pageId;
    if (!pageId) {
      try {
        pageId = await discoverPageId(accessToken);
        saved.pageId = pageId;
        await writeSaved(saved);
      } catch (e) {
        return res.status(400).json({ step: "discoverPage", error: e, note: "Ensure token has pages access (pages_show_list / pages_read_engagement / manage_pages as required)." });
      }
    }

    // Safe default targeting when none provided (prevents "missing location" errors)
    const defaultTargeting = {
      geo_locations: { countries: ["IN"] }, // change as needed
      age_min: 18,
      age_max: 65,
    };
    const finalTargeting = targeting && Object.keys(targeting).length ? targeting : defaultTargeting;

    // 1) Create Campaign
    const campaignUrl = `https://graph.facebook.com/v${version}/act_${adAccountId}/campaigns`;
    const campaignParams = new URLSearchParams({
      name: campaignName,
      objective: "OUTCOME_TRAFFIC",
      status: "PAUSED",
      special_ad_categories: JSON.stringify(["NONE"]),
      access_token: accessToken,
    });
    const campaignResp = await fetch(campaignUrl, { method: "POST", body: campaignParams });
    const campaignJson = await campaignResp.json();
    if (campaignJson.error) return res.status(400).json({ step: "createCampaign", error: campaignJson });

    // 2) Create Ad Set (use lowest-cost strategy so bid params aren't required)
    const adsetUrl = `https://graph.facebook.com/v${version}/act_${adAccountId}/adsets`;
    const adsetParams = new URLSearchParams({
      name: adSetName,
      campaign_id: campaignJson.id,
      daily_budget: String(budget),
      billing_event: "IMPRESSIONS",
      optimization_goal: "REACH",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      status: "PAUSED",
      targeting: JSON.stringify(finalTargeting),
      access_token: accessToken,
    });
    const adsetResp = await fetch(adsetUrl, { method: "POST", body: adsetParams });
    const adsetJson = await adsetResp.json();
    if (adsetJson.error) return res.status(400).json({ step: "createAdSet", error: adsetJson });

    // 3) Upload image and get image_hash
    let imageHash: string;
    try {
      imageHash = await uploadImageGetHash(adAccountId, accessToken, creativeImageUrl);
    } catch (e) {
      return res.status(400).json({ step: "uploadImage", error: e });
    }

    // 4) Build object_story_spec:
    // - If destinationLink present => link_data (link ad)
    // - If no destinationLink => photo_data (photo post ad)
    const object_story_spec: any = { page_id: pageId };
    if (destinationLink && String(destinationLink).trim()) {
      object_story_spec.link_data = {
        message: creativeCaption || "",
        link: String(destinationLink),
        image_hash: imageHash,
        call_to_action: {
          type: "LEARN_MORE",
          value: { link: String(destinationLink) },
        },
      };
    } else {
      object_story_spec.photo_data = {
        image_hash: imageHash,
        caption: creativeCaption || "",
      };
    }

    // 5) Create Creative
    const creativeUrl = `https://graph.facebook.com/v${version}/act_${adAccountId}/adcreatives`;
    const creativeParams = new URLSearchParams({
      name: "AutoCreative",
      object_story_spec: JSON.stringify(object_story_spec),
      access_token: accessToken,
    });
    const creativeResp = await fetch(creativeUrl, { method: "POST", body: creativeParams });
    const creativeJson = await creativeResp.json();
    if (creativeJson.error) return res.status(400).json({ step: "createCreative", error: creativeJson });

    // 6) Create Ad
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
    if (adJson.error) return res.status(400).json({ step: "createAd", error: adJson });

    return res.status(200).json({
      campaign: campaignJson,
      adset: adsetJson,
      image_hash: imageHash,
      creative: creativeJson,
      ad: adJson,
    });

  } catch (err) {
    console.error("ads handler error:", err);
    return res.status(500).json({ error: "Internal server error", details: (err as any).toString() });
  }
}
