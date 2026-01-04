// pages/api/facebook/posts/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireFacebookPage } from '@/integrations/meta/auth';
import { getFacebookPost, deleteFacebookPost } from '@/integrations/meta/facebook';

/**
 * Get or delete single Facebook post for authenticated user.
 * GET /api/facebook/posts/[id]
 * DELETE /api/facebook/posts/[id]
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
      const result = await getFacebookPost({
        postId,
        accessToken: integration.pageAccessToken,
      });
      return res.status(200).json(result);
    } else if (req.method === "DELETE") {
      const result = await deleteFacebookPost({
        postId,
        accessToken: integration.pageAccessToken,
      });
      return res.status(200).json(result);
    } else {
      res.setHeader("Allow", "GET, DELETE");
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err: any) {
    console.error("facebook post [id] error:", err);
    return res.status(500).json({ error: err?.message || "Failed to process request" });
  }
}
