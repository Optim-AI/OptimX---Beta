// pages/api/meta/ads/campaigns.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireAdsAccount } from '@/integrations/meta/auth';
import { getCampaigns } from '@/integrations/meta/ads';

/**
 * Get Meta ad campaigns for authenticated user's ad account.
 * GET /api/meta/ads/campaigns
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const integration = await getMetaIntegration(req);
    await requireAdsAccount(integration);

    const result = await getCampaigns({
      adAccountId: integration.adAccountId!,
      accessToken: integration.userAccessToken,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("meta ads campaigns error:", err);
    return res.status(500).json({ error: err?.message || "Failed to get campaigns" });
  }
}
