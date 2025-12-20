// pages/api/meta/integration/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegrationOptional } from "../../../../lib/meta/auth";

/**
 * Get Meta integration connection status for authenticated user.
 * Returns which Meta services are connected (Facebook, Instagram, Ads).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const integration = await getMetaIntegrationOptional(req);

    if (!integration) {
      return res.status(200).json({
        connected: false,
        hasFacebook: false,
        hasInstagram: false,
        hasAds: false,
      });
    }

    return res.status(200).json({
      connected: true,
      hasFacebook: !!integration.pageId,
      hasInstagram: !!integration.igUserId,
      hasAds: !!integration.adAccountId,
      pageId: integration.pageId,
      igUserId: integration.igUserId,
      adAccountId: integration.adAccountId,
    });
  } catch (err: any) {
    console.error("meta integration status error:", err);
    return res.status(500).json({ error: err?.message || "server_error" });
  }
}
