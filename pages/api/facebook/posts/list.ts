// pages/api/facebook/posts/list.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireFacebookPage } from "../../../../lib/meta/auth";
import { getFacebookPosts } from "../../../../lib/meta/facebook";

/**
 * Get Facebook Page posts for authenticated user.
 * GET /api/facebook/posts/list?limit=25
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const integration = await getMetaIntegration(req);
    await requireFacebookPage(integration);

    const { limit } = req.query;
    const limitNum = limit ? parseInt(Array.isArray(limit) ? limit[0] : limit, 10) : 25;

    const result = await getFacebookPosts({
      pageId: integration.pageId!,
      accessToken: integration.pageAccessToken,
      limit: limitNum,
    });

    return res.status(200).json(result);
  } catch (err: any) {
    console.error("facebook posts list error:", err);
    return res.status(500).json({ error: err?.message || "Failed to get Facebook posts" });
  }
}
