// pages/api/meta/ads/ads.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireAdsAccount } from "../../../../lib/meta/auth";
import { getAds } from "../../../../lib/meta/ads";

/**
 * Get Meta ads for authenticated user's ad account, campaign, or ad set.
 * GET /api/meta/ads/ads?campaignId=123&adSetId=456 (both optional)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const integration = await getMetaIntegration(req);
    await requireAdsAccount(integration);

    const { campaignId, adSetId } = req.query;
    const campaignIdStr = Array.isArray(campaignId) ? campaignId[0] : campaignId;
    const adSetIdStr = Array.isArray(adSetId) ? adSetId[0] : adSetId;

    const result = await getAds({
      adAccountId: adSetIdStr || campaignIdStr ? undefined : integration.adAccountId!,
      campaignId: campaignIdStr || undefined,
      adSetId: adSetIdStr || undefined,
      accessToken: integration.userAccessToken,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("meta ads ads error:", err);
    return res.status(500).json({ error: err?.message || "Failed to get ads" });
  }
}
