import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { getInstagramPosts } from "@/integrations/meta/instagram";
import { getMetaInstagramIntegration } from "@/lib/social/instagram/auth";

/**
 * GET /api/social/instagram/media/list?limit=&after=
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

    const integration = await getMetaInstagramIntegration(req);
    const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 50);
    const after = Array.isArray(req.query.after)
      ? req.query.after[0]
      : req.query.after;

    const result = await getInstagramPosts({
      igUserId: integration.igUserId,
      accessToken: integration.pageAccessToken,
      limit,
      after: typeof after === "string" ? after : undefined,
    });

    res.status(200).json({
      success: true,
      items: (result.data || []).map((m) => ({
        id: m.id,
        caption: m.caption || null,
        mediaType: m.media_type || null,
        mediaUrl: m.media_url || null,
        thumbnailUrl: m.thumbnail_url || null,
        permalink: m.permalink || null,
        timestamp: m.timestamp || null,
        likeCount:
          typeof m.like_count === "number"
            ? { available: true, value: m.like_count }
            : { available: false, value: null },
        commentsCount:
          typeof m.comments_count === "number"
            ? { available: true, value: m.comments_count }
            : { available: false, value: null },
      })),
      paging: result.paging || null,
      igUsername: integration.igUsername,
    });
  } catch (err: any) {
    const msg = err?.message || "Failed to list Instagram media";
    const status = /not connected|Unauthorized|incomplete/i.test(msg)
      ? 401
      : 500;
    res.status(status).json({ error: msg });
  }
}
