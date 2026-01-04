// pages/api/meta/ads/adsets.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireAdsAccount } from '@/integrations/meta/auth';
import { getAdSets } from '@/integrations/meta/ads';

/**
 * Get Meta ad sets for authenticated user's ad account or campaign.
 * GET /api/meta/ads/adsets?campaignId=123 (optional)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const integration = await getMetaIntegration(req);
    await requireAdsAccount(integration);

    const { campaignId } = req.query;
    const campaignIdStr = Array.isArray(campaignId) ? campaignId[0] : campaignId;

    const result = await getAdSets({
      adAccountId: campaignIdStr ? undefined : integration.adAccountId!,
      campaignId: campaignIdStr || undefined,
      accessToken: integration.userAccessToken,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("meta ads adsets error:", err);
    return res.status(500).json({ error: err?.message || "Failed to get ad sets" });
  }
}
