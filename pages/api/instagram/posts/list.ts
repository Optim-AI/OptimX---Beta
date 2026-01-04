// pages/api/instagram/posts/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireInstagramAccount } from '@/integrations/meta/auth';
import { getInstagramPosts } from '@/integrations/meta/instagram';

/**
 * Get Instagram posts for authenticated user.
 * GET /api/instagram/posts/list?limit=25
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const integration = await getMetaIntegration(req);
    await requireInstagramAccount(integration);

    const { limit } = req.query;
    const limitNum = limit ? parseInt(Array.isArray(limit) ? limit[0] : limit, 10) : 25;

    const result = await getInstagramPosts({
      igUserId: integration.igUserId!,
      accessToken: integration.pageAccessToken,
      limit: limitNum,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("instagram posts list error:", err);
    return res.status(500).json({ error: err?.message || "Failed to get Instagram posts" });
  }
}
