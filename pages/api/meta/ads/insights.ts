// pages/api/meta/ads/insights.ts
import type { NextApiRequest, NextApiResponse} from "next";
import { getMetaIntegration, requireAdsAccount } from '@/integrations/meta/auth';
import { getInsights } from '@/integrations/meta/ads';

/**
 * Get Meta ad insights for authenticated user.
 * GET /api/meta/ads/insights?objectId=act_123&since=2025-01-01&until=2025-01-31
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const integration = await getMetaIntegration(req);
    await requireAdsAccount(integration);

    const { objectId, since, until, level } = req.query;

    const objectIdStr = Array.isArray(objectId) ? objectId[0] : objectId;
    const sinceStr = Array.isArray(since) ? since[0] : since;
    const untilStr = Array.isArray(until) ? until[0] : until;
    const levelStr = (Array.isArray(level) ? level[0] : level) as "account" | "campaign" | "adset" | "ad" | undefined;

    // Default to ad account if no objectId specified
    const targetObjectId = objectIdStr || `act_${integration.adAccountId}`;

    const timeRange = sinceStr && untilStr ? { since: sinceStr, until: untilStr } : undefined;

    const result = await getInsights({
      objectId: targetObjectId,
      accessToken: integration.userAccessToken,
      timeRange,
      level: levelStr || "account",
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("meta ads insights error:", err);
    return res.status(500).json({ error: err?.message || "Failed to get insights" });
  }
}
