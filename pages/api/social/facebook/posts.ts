import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { SocialPostDAO } from "@/database/models/SocialPost.dao";

/**
 * GET /api/social/facebook/posts?limit=50
 * List the authenticated user's social publishing history.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const limitRaw = Array.isArray(req.query.limit)
      ? req.query.limit[0]
      : req.query.limit;
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 100);

    const rows = await SocialPostDAO.listByUser(userId, limit);

    res.status(200).json({
      posts: rows.map((row) => ({
        id: row.id,
        status: row.status,
        caption: row.caption,
        sourceImageUrl: row.sourceImageUrl,
        destinationPageId: row.destinationPageId,
        destinationPageName: row.destinationPageName,
        metaPostId: row.metaPostId,
        metaPhotoId: row.metaPhotoId,
        permalink: row.permalink,
        errorMessage: row.errorMessage,
        publishedAt: row.publishedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    });
  } catch (err: any) {
    console.error("social facebook posts list error:", err);
    res.status(500).json({
      error: err?.message || "Failed to list posts",
    });
  }
}
