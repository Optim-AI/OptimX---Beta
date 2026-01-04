// pages/api/instagram/posts/[id]/comments.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireInstagramAccount } from '@/integrations/meta/auth';
import { getInstagramComments, postInstagramComment } from '@/integrations/meta/instagram';

/**
 * Get or post comments on Instagram media for authenticated user.
 * GET /api/instagram/posts/[id]/comments
 * POST /api/instagram/posts/[id]/comments (body: { message: string })
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const integration = await getMetaIntegration(req);
    await requireInstagramAccount(integration);

    const { id } = req.query;
    const mediaId = Array.isArray(id) ? id[0] : id;

    if (!mediaId) {
      return res.status(400).json({ error: "Media ID is required" });
    }

    if (req.method === "GET") {
      const result = await getInstagramComments({
        mediaId,
        accessToken: integration.pageAccessToken,
      });
      return res.status(200).json(result);
    } else if (req.method === "POST") {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: "message is required" });
      }

      const result = await postInstagramComment({
        mediaId,
        message,
        accessToken: integration.pageAccessToken,
      });
      return res.status(200).json(result);
    } else {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err: any) {
    console.error("instagram comments error:", err);
    return res.status(500).json({ error: err?.message || "Failed to process comments" });
  }
}
