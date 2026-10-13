import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { GeneratedImageDAO } from "@/database/models/GeneratedImage.dao";
import { extractPublicStorageObjectPath } from "@/lib/social/facebook-publish/resolve-media";
import { assertEnsureableStoragePath } from "@/lib/social/generated-contents/ensure-ownership";
import { recordGeneratedCreative } from "@/lib/social/generated-contents/record";

/**
 * POST /api/generated-contents/ensure
 * Ensure a storage-backed creative is in the user's Generated Contents library
 * so Instagram/Facebook publish ownership checks succeed.
 *
 * Auth: session user only — client-supplied user ids are ignored.
 * Body: { mediaUrl: string, mediaType?: 'image'|'video', source?: string }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const mediaUrl =
      typeof req.body?.mediaUrl === "string" ? req.body.mediaUrl.trim() : "";
    const mediaType =
      req.body?.mediaType === "video" || req.body?.mediaType === "image"
        ? req.body.mediaType
        : "image";
    const source =
      typeof req.body?.source === "string" ? req.body.source : "ensure";

    if (!mediaUrl) {
      res.status(400).json({ error: "mediaUrl is required", code: "invalid_media" });
      return;
    }
    if (mediaUrl.startsWith("data:") || mediaUrl.startsWith("blob:")) {
      res.status(400).json({
        error:
          "Inline media cannot be published. The creative must be stored first.",
        code: "invalid_media",
      });
      return;
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(mediaUrl);
    } catch {
      res.status(400).json({ error: "Invalid mediaUrl", code: "invalid_url" });
      return;
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      res.status(400).json({ error: "Unsupported media URL", code: "invalid_url" });
      return;
    }

    const storage = extractPublicStorageObjectPath(mediaUrl);
    if (!storage) {
      res.status(400).json({
        error:
          "Only Supabase public storage creatives can be registered for publishing.",
        code: "invalid_media",
      });
      return;
    }

    const pathOwned = assertEnsureableStoragePath({
      userId,
      storagePath: storage.path,
    });
    if (!pathOwned.ok) {
      res.status(403).json({
        error: pathOwned.error,
        code: "not_owned",
      });
      return;
    }

    const existingAny = await GeneratedImageDAO.findAnyByPathOrUrl({
      imagePath: storage.path,
      imageUrl: mediaUrl,
    });
    if (existingAny && existingAny.userId !== userId) {
      res.status(403).json({
        error:
          "This creative belongs to another account and cannot be registered for publishing.",
        code: "not_owned",
      });
      return;
    }

    const recorded = await recordGeneratedCreative({
      userId,
      mediaUrl,
      storagePath: storage.path,
      mediaType,
      source,
      metadata: { bucket: storage.bucket, ensuredAt: new Date().toISOString() },
    });

    if (!recorded) {
      res.status(500).json({
        error: "Failed to register creative in your library",
        code: "ensure_failed",
      });
      return;
    }

    res.status(200).json({
      success: true,
      id: recorded.id,
      created: recorded.created,
      storagePath: storage.path,
      bucket: storage.bucket,
      mediaUrl,
      mediaType,
    });
  } catch (err: any) {
    console.error("generated-contents ensure error:", err);
    res.status(500).json({
      error: err?.message || "Failed to ensure library creative",
    });
  }
}
