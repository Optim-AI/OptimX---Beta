// pages/api/meta/integration/me.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegrationOptional } from "../../../../lib/meta/auth";

/**
 * Get authenticated user's Meta integration details.
 * This replaces /api/auth/instagram/me
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const integration = await getMetaIntegrationOptional(req);

    if (!integration) {
      return res.status(200).json({ connected: false });
    }

    return res.status(200).json({
      connected: true,
      pageId: integration.pageId,
      igUserId: integration.igUserId,
      adAccountId: integration.adAccountId,
      createdAt: integration.createdAt,
    });
  } catch (err: any) {
    console.error("meta integration me error:", err);
    return res.status(200).json({ connected: false });
  }
}
