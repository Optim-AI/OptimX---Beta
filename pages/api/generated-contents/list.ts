import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { GeneratedImageDAO } from "@/database/models/GeneratedImage.dao";
import { SocialPostDAO } from "@/database/models/SocialPost.dao";

/**
 * GET /api/generated-contents/list
 * Query: mediaType=all|image|video, q=, limit=, offset=
 * Returns library items with latest social publish status (owner-scoped).
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

    const mediaTypeRaw = Array.isArray(req.query.mediaType)
      ? req.query.mediaType[0]
      : req.query.mediaType;
    const mediaType =
      mediaTypeRaw === "image" || mediaTypeRaw === "video"
        ? mediaTypeRaw
        : "all";

    const q = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 48, 1),
      100
    );
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const { rows, total } = await GeneratedImageDAO.listForUser({
      userId,
      mediaType,
      search: typeof q === "string" ? q : undefined,
      limit,
      offset,
    });

    // Attach latest social_posts status per creative (by sourceImageId or URL)
    let posts: Awaited<ReturnType<typeof SocialPostDAO.listByUser>> = [];
    try {
      posts = await SocialPostDAO.listByUser(userId, 200);
    } catch {
      posts = [];
    }

    const byImageId = new Map<string, (typeof posts)[0]>();
    const byUrl = new Map<string, (typeof posts)[0]>();
    for (const p of posts) {
      if (p.sourceImageId && !byImageId.has(p.sourceImageId)) {
        byImageId.set(p.sourceImageId, p);
      }
      if (p.sourceImageUrl && !byUrl.has(p.sourceImageUrl)) {
        byUrl.set(p.sourceImageUrl, p);
      }
    }

    const items = rows.map((row) => {
      const pub =
        byImageId.get(row.id) || byUrl.get(row.imageUrl) || null;
      const meta = (row.metadata as Record<string, unknown>) || {};
      return {
        id: row.id,
        mediaUrl: row.imageUrl,
        storagePath: row.imagePath,
        mediaType: (row.mediaType as "image" | "video") || "image",
        source: row.source,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        metadata: meta,
        label:
          (typeof meta.brandName === "string" && meta.brandName) ||
          (typeof meta.name === "string" && meta.name) ||
          (typeof meta.prompt === "string" &&
            String(meta.prompt).slice(0, 60)) ||
          null,
        association:
          (typeof meta.sessionId === "string" && {
            type: "session",
            id: meta.sessionId,
          }) ||
          (typeof meta.campaignId === "string" && {
            type: "campaign",
            id: meta.campaignId,
          }) ||
          null,
        publish: pub
          ? {
              status: pub.status,
              destinationPageName: pub.destinationPageName,
              destinationPageId: pub.destinationPageId,
              permalink: pub.permalink,
              metaPostId: pub.metaPostId,
              publishedAt: pub.publishedAt,
              errorMessage: pub.errorMessage,
              socialPostId: pub.id,
            }
          : { status: "unpublished" as const },
      };
    });

    res.status(200).json({
      success: true,
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    });
  } catch (err: any) {
    console.error("generated-contents list error:", err);
    res.status(500).json({
      error: err?.message || "Failed to list generated contents",
    });
  }
}
