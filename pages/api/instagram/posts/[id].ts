// pages/api/instagram/posts/[id].ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireInstagramAccount } from "../../../../lib/meta/auth";
import { getInstagramMedia, deleteInstagramMedia } from "../../../../lib/meta/instagram";

/**
 * Get or delete single Instagram post for authenticated user.
 * GET /api/instagram/posts/[id]
 * DELETE /api/instagram/posts/[id]
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
      const result = await getInstagramMedia({
        mediaId,
        accessToken: integration.pageAccessToken,
      });
      return res.status(200).json(result);
    } else if (req.method === "DELETE") {
      const result = await deleteInstagramMedia({
        mediaId,
        accessToken: integration.pageAccessToken,
      });
      return res.status(200).json(result);
    } else {
      res.setHeader("Allow", "GET, DELETE");
      return res.status(405).json({ error: "Method not allowed" });
    }
  } catch (err: any) {
    console.error("instagram post [id] error:", err);
    return res.status(500).json({ error: err?.message || "Failed to process request" });
  }
}
