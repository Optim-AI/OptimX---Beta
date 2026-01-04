// pages/api/facebook/posts/[id]/comments.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireFacebookPage } from '@/integrations/meta/auth';
import { getFacebookComments, postFacebookComment } from '@/integrations/meta/facebook';

/**
 * Get or post comments on Facebook post for authenticated user.
 * GET /api/facebook/posts/[id]/comments?limit=25
 * POST /api/facebook/posts/[id]/comments (body: { message: string })
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const integration = await getMetaIntegration(req);
    await requireFacebookPage(integration);

    const { id } = req.query;
    const postId = Array.isArray(id) ? id[0] : id;

    if (!postId) {
      return res.status(400).json({ error: "Post ID is required" });
    }

    if (req.method === "GET") {
      const { limit } = req.query;
      const limitNum = limit ? parseInt(Array.isArray(limit) ? limit[0] : limit, 10) : 25;

      const result = await getFacebookComments({
        postId,
        accessToken: integration.pageAccessToken,
        limit: limitNum,
      });
      return res.status(200).json(result);
    } else if (req.method === "POST") {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }

      const result = await postFacebookComment({
        postId,
        message,
        accessToken: integration.pageAccessToken,
      });
      return res.status(200).json(result);
    } else {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err: any) {
    console.error("facebook comments error:", err);
    return res.status(500).json({ error: err?.message || "Failed to process comments" });
  }
}
