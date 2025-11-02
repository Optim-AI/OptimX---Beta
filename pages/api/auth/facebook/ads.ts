// pages/api/auth/facebook/ads.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../../lib/integrationStore";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

async function discoverAdAccount(accessToken: string) {
  const resp = await fetch(`https://graph.facebook.com/v${VERSION}/me/adaccounts?access_token=${accessToken}`);
  const json = await resp.json();
  if (json.error) throw json;
  if (json.data && json.data.length) return String(json.data[0].id).replace(/^act_/, "");
  throw { message: "No ad account found for token", details: json };
}

async function uploadImageGetHash(adAccountId: string, accessToken: string, imageUrl: string) {
  const url = `https://graph.facebook.com/v${VERSION}/act_${adAccountId}/adimages`;
  const body = new URLSearchParams({ url: imageUrl, access_token: accessToken });
  const resp = await fetch(url, { method: "POST", body });
  const json = await resp.json();
  if (json.error) throw json;
  if (!json.images || Object.keys(json.images).length === 0) throw { message: "No images returned from upload", details: json };
  return Object.keys(json.images)[0];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.setHeader("Allow", "POST"), res.status(405).json({ error: "Method Not Allowed" });

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) return res.status(400).json({ error: "no_integration" });

    let adAccountId = saved.adAccountId ? String(saved.adAccountId).replace(/^act_/, "") : "";
    const accessToken = saved.userAccessToken ?? saved.pageAccessToken;
    if (!accessToken) return res.status(400).json({ error: "No access token available (userAccessToken or pageAccessToken required)" });

    // create with posted body
    const { campaignName, budget, adSetName, targeting, creativeCaption, creativeImageUrl, destinationLink } = req.body ?? {};
    if (!campaignName || !budget || !adSetName || !creativeImageUrl) {
      return res.status(400).json({ error: "Missing required fields. Required: campaignName, budget, adSetName, creativeImageUrl" });
    }

    // discover ad account if missing
    if (!adAccountId) {
      try {
        adAccountId = await discoverAdAccount(accessToken);
      } catch (e) {
        return res.status(400).json({ step: "discoverAdAccount", error: e });
      }
    }

    // create campaign
    const campaignUrl = `https://graph.facebook.com/v${VERSION}/act_${adAccountId}/campaigns`;
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

    // create ad set
    const adsetUrl = `https://graph.facebook.com/v${VERSION}/act_${adAccountId}/adsets`;
    const defaultTargeting = { geo_locations: { countries: ["IN"] }, age_min: 18, age_max: 65 };
    const finalTargeting = targeting && Object.keys(targeting).length ? targeting : defaultTargeting;
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

    // upload image
    let imageHash: string;
    try { imageHash = await uploadImageGetHash(adAccountId, accessToken, creativeImageUrl); }
    catch (e) { return res.status(400).json({ step: "uploadImage", error: e }); }

    // object_story_spec
    const object_story_spec: any = { page_id: saved.pageId };
    if (destinationLink && String(destinationLink).trim()) {
      object_story_spec.link_data = { message: creativeCaption || "", link: String(destinationLink), image_hash: imageHash, call_to_action: { type: "LEARN_MORE", value: { link: String(destinationLink) } } };
    } else {
      object_story_spec.photo_data = { image_hash: imageHash, caption: creativeCaption || "" };
    }

    // create creative
    const creativeUrl = `https://graph.facebook.com/v${VERSION}/act_${adAccountId}/adcreatives`;
    const creativeParams = new URLSearchParams({ name: "AutoCreative", object_story_spec: JSON.stringify(object_story_spec), access_token: accessToken });
    const creativeResp = await fetch(creativeUrl, { method: "POST", body: creativeParams });
    const creativeJson = await creativeResp.json();
    if (creativeJson.error) return res.status(400).json({ step: "createCreative", error: creativeJson });

    // create ad
    const adUrl = `https://graph.facebook.com/v${VERSION}/act_${adAccountId}/ads`;
    const adParams = new URLSearchParams({ name: "AutoAd", adset_id: adsetJson.id, creative: JSON.stringify({ creative_id: creativeJson.id }), status: "PAUSED", access_token: accessToken });
    const adResp = await fetch(adUrl, { method: "POST", body: adParams });
    const adJson = await adResp.json();
    if (adJson.error) return res.status(400).json({ step: "createAd", error: adJson });

    return res.status(200).json({ campaign: campaignJson, adset: adsetJson, image_hash: imageHash, creative: creativeJson, ad: adJson });
  } catch (err: any) {
    console.error("facebook/ads handler error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
