// pages/api/auth/facebook/ads.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import { readSavedIntegration } from '@/integrations/store';
import { supabaseAdmin } from '@/auth/supabase/client';

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

/** discover the first ad account for token */
async function discoverAdAccount(accessToken: string) {
  const resp = await fetch(`https://graph.facebook.com/v${VERSION}/me/adaccounts?access_token=${accessToken}`);
  const json = await resp.json();
  if (json.error) throw json;
  if (json.data && json.data.length) return String(json.data[0].id).replace(/^act_/, "");
  throw { message: "No ad account found for token", details: json };
}

/** upload image to ad account and return image hash */
async function uploadImageGetHash(adAccountId: string, accessToken: string, imageUrl: string) {
  const url = `https://graph.facebook.com/v${VERSION}/act_${adAccountId}/adimages`;
  const body = new URLSearchParams({ url: imageUrl, access_token: accessToken });
  const resp = await fetch(url, { method: "POST", body });
  const json = await resp.json();
  if (json.error) throw json;
  if (!json.images || Object.keys(json.images).length === 0) throw { message: "No images returned from upload", details: json };
  return Object.keys(json.images)[0];
}

/** upload local data-url to Supabase and return a public URL (so Facebook can fetch) */
async function uploadDataUrlToSupabase(dataUrl: string, filenamePrefix = "fb_upload") {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  const contentType = m[1];
  const buf = Buffer.from(m[2], "base64");
  const path = `temp/${filenamePrefix}_${Date.now()}.png`;
  const { error } = await supabaseAdmin.storage.from("campaign-assets").upload(path, buf, {
    cacheControl: "3600",
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from("campaign-assets").getPublicUrl(path);
  return (data as any)?.publicUrl ?? null;
}

/** sanitize ad account id so we never end up with act_act_123 etc.
 *  This will strip repeated 'act_' prefixes and any non-digit chars,
 *  leaving only the numeric account id expected by Facebook.
 */
function sanitizeAdAccountId(raw: string | undefined | null): string {
  if (!raw) return "";
  // remove repeated act_ prefixes (act_act_act_123 -> 123)
  let s = String(raw).trim();
  s = s.replace(/^(act_)+/i, ""); // remove one or more leading act_ (case-insensitive)
  // keep only digits (ad account ids are numeric)
  s = s.replace(/\D/g, "");
  return s;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) return res.status(400).json({ error: "no_integration", message: "No meta integration saved for this user." });

    // Prefer saved ad account id but sanitize it aggressively
    let rawAdAccount = saved.adAccountId ? String(saved.adAccountId) : "";
    let adAccountId = sanitizeAdAccountId(rawAdAccount);

    // token: prefer explicit user access token, fallback to page access token
    const accessToken = saved.userAccessToken ?? saved.pageAccessToken;
    if (!accessToken) return res.status(400).json({ error: "no_token", message: "No access token available (userAccessToken or pageAccessToken required in saved integration)" });

    // Accept expanded inputs from client
    const {
      campaignName,
      objective,
      platforms,
      adSetName,
      targeting,
      creativeCaption,
      creativeImageUrl,
      creativeImageDataUrl, // optional data URL if client provided image inline
      destinationLink,
      budget,
      budgetType = "daily",
      startDate,
      endDate,
      delivery,
      campaignType,
      brandName,
      tagline,
      tone,
      primaryCTA,
      location,
      ageRange,
      gender,
      interests,
      autoTarget = true,
      autoOptimise = true,
    } = req.body ?? {};

    if (!campaignName || !budget || !adSetName) {
      return res.status(400).json({ error: "missing_fields", message: "Missing required fields. Required: campaignName, budget, adSetName" });
    }

    // discover ad account if missing or invalid
    if (!adAccountId) {
      try {
        adAccountId = await discoverAdAccount(accessToken);
        adAccountId = sanitizeAdAccountId(adAccountId);
      } catch (e) {
        console.error("discoverAdAccount failed:", e);
        return res.status(400).json({ step: "discoverAdAccount", error: e });
      }
    }

    if (!adAccountId) {
      return res.status(400).json({ error: "no_ad_account", message: "Could not determine an ad account ID. Ensure your Meta integration includes an ad account." });
    }

    // Normalize budget to smallest currency unit (example uses multiplier 100 for INR -> paise)
    const budgetMultiplier = 100;
    const budgetMinor = Math.round(Number(budget) * budgetMultiplier);

    // Build targeting object
    let finalTargeting: any = {};
    if (autoTarget || (!location && !ageRange && !interests && !gender && !targeting)) {
      finalTargeting = { geo_locations: { countries: ["IN"] }, age_min: 18, age_max: 65 };
    } else {
      finalTargeting = targeting && Object.keys(targeting || {}).length ? targeting : {};
      if (location && !finalTargeting.geo_locations) {
        finalTargeting.geo_locations = { regions: [], countries: [], cities: [] };
        if (/^[A-Z]{2}$/.test(String(location).trim())) finalTargeting.geo_locations.countries = [String(location).trim()];
        else finalTargeting.geo_locations.city = [{ key: String(location) }];
      }
      if (ageRange && Array.isArray(ageRange) && ageRange.length === 2) {
        finalTargeting.age_min = Number(ageRange[0]);
        finalTargeting.age_max = Number(ageRange[1]);
      }
      if (gender && String(gender).toLowerCase() !== "all") {
        const g = String(gender).toLowerCase();
        finalTargeting.genders = g === "male" ? [1] : g === "female" ? [2] : [];
      }
      if (interests && String(interests).trim()) {
        finalTargeting.flexible_spec = [{ interests: [{ id: null, name: String(interests) }] }];
      }
    }

    // Create campaign
    const campaignUrl = `https://graph.facebook.com/v${VERSION}/act_${adAccountId}/campaigns`;
    const campaignParams = new URLSearchParams({
      name: campaignName,
      objective: objective || "LINK_CLICKS",
      status: "PAUSED",
      special_ad_categories: JSON.stringify(["NONE"]),
      access_token: accessToken,
    });

    const campaignResp = await fetch(campaignUrl, { method: "POST", body: campaignParams });
    const campaignJson = await campaignResp.json();
    if (campaignJson.error) {
      console.error("facebook createCampaign error:", campaignJson);
      return res.status(400).json({ step: "createCampaign", error: campaignJson });
    }

    // Create adset
    const adsetUrl = `https://graph.facebook.com/v${VERSION}/act_${adAccountId}/adsets`;
    const adsetParams: any = {
      name: adSetName,
      campaign_id: campaignJson.id,
      billing_event: "IMPRESSIONS",
      Optimisation_goal: autoOptimise ? "REACH" : "IMPRESSIONS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      status: "PAUSED",
      targeting: JSON.stringify(finalTargeting),
      access_token: accessToken,
    };

    if (budgetType === "lifetime") adsetParams.lifetime_budget = String(budgetMinor);
    else adsetParams.daily_budget = String(budgetMinor);

    if (startDate) adsetParams.start_time = new Date(startDate).toISOString();
    if (endDate) adsetParams.end_time = new Date(endDate).toISOString();
    if (delivery) adsetParams.delivery_type = delivery;

    const adsetResp = await fetch(adsetUrl, { method: "POST", body: new URLSearchParams(adsetParams) });
    const adsetJson = await adsetResp.json();
    if (adsetJson.error) {
      console.error("facebook createAdSet error:", adsetJson);
      return res.status(400).json({ step: "createAdSet", error: adsetJson });
    }

    // Prepare creative image: either a public URL or upload data URL to supabase then give FB the public url
    let creativeImagePublicUrl = creativeImageUrl ?? null;
    if (!creativeImagePublicUrl && creativeImageDataUrl) {
      try {
        creativeImagePublicUrl = await uploadDataUrlToSupabase(creativeImageDataUrl, `fb_image_${adAccountId}`);
      } catch (e) {
        console.error("uploadDataUrlToSupabase error:", e);
        return res.status(400).json({ step: "uploadDataUrl", error: String(e) });
      }
    }
    if (!creativeImagePublicUrl) {
      return res.status(400).json({ step: "missingImage", error: "creativeImageUrl or creativeImageDataUrl is required" });
    }

    // Upload image to FB and get image_hash
    let imageHash: string;
    try {
      imageHash = await uploadImageGetHash(adAccountId, accessToken, creativeImagePublicUrl);
    } catch (e) {
      console.error("uploadImageGetHash error:", e);
      return res.status(400).json({ step: "uploadImage", error: e });
    }

    // Build object_story_spec
    const object_story_spec: any = {};
    // prefer pageId from saved integration
    if (saved.pageId) object_story_spec.page_id = saved.pageId;
    if (!object_story_spec.page_id) {
      console.warn("No saved.pageId for user integration; object_story_spec.page_id missing.");
    }

    if (destinationLink && String(destinationLink).trim()) {
      object_story_spec.link_data = {
        message: creativeCaption || `${tagline || ""}`.trim(),
        link: String(destinationLink),
        image_hash: imageHash,
        call_to_action: { type: (primaryCTA?.toUpperCase() || "LEARN_MORE"), value: { link: String(destinationLink) } },
      };
    } else {
      object_story_spec.photo_data = { image_hash: imageHash, caption: creativeCaption || `${tagline || ""}`.trim() };
    }

    // Create creative
    const creativeUrl = `https://graph.facebook.com/v${VERSION}/act_${adAccountId}/adcreatives`;
    const creativeParams = new URLSearchParams({ name: "AutoCreative", object_story_spec: JSON.stringify(object_story_spec), access_token: accessToken });
    const creativeResp = await fetch(creativeUrl, { method: "POST", body: creativeParams });
    const creativeJson = await creativeResp.json();
    if (creativeJson.error) {
      console.error("facebook createCreative error:", creativeJson);
      return res.status(400).json({ step: "createCreative", error: creativeJson });
    }

    // Create ad
    const adUrl = `https://graph.facebook.com/v${VERSION}/act_${adAccountId}/ads`;
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
      console.error("facebook createAd error:", adJson);
      return res.status(400).json({ step: "createAd", error: adJson });
    }

    // Return created objects
    return res.status(200).json({
      ok: true,
      campaign: campaignJson,
      adset: adsetJson,
      image_hash: imageHash,
      creative: creativeJson,
      ad: adJson,
    });
  } catch (err: any) {
    console.error("facebook/ads handler error:", err);
    return res.status(500).json({ error: "Internal server error", details: String(err) });
  }
}
