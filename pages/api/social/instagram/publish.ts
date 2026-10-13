import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { SocialPostDAO } from "@/database/models/SocialPost.dao";
import { getMetaInstagramIntegration } from "@/lib/social/instagram/auth";
import { validateCaption } from "@/lib/social/instagram/media";
import { publishInstagramCreative } from "@/lib/social/instagram/publish";
import {
  createDefaultInstagramMediaResolveDeps,
  resolveInstagramPublishableMedia,
} from "@/lib/social/instagram/resolve-public-media";
import { META_INSTAGRAM_PROVIDER } from "@/lib/social/instagram/scopes";
import { evaluateSocialPostForPublish } from "@/lib/social/publishing/social-post-guards";

/**
 * POST /api/social/instagram/publish
 * Body: {
 *   imageUrl / mediaUrl: string (library hint),
 *   caption?, sourceImageId?, sourceImagePath?,
 *   mediaType?: 'image'|'video',
 *   draft?, socialPostId?,
 *   forceRetry?: boolean
 * }
 *
 * Resolves owned library creatives to a Meta-fetchable public HTTPS URL
 * (reuse hosted asset or mirror to INSTAGRAM_MEDIA_HOST_* / primary Supabase).
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

    const {
      imageUrl,
      mediaUrl,
      caption,
      sourceImageId,
      sourceImagePath,
      mediaType,
      draft,
      socialPostId,
      forceRetry,
    } = req.body ?? {};

    const rawUrl = mediaUrl || imageUrl;
    const hint: "image" | "video" | undefined =
      mediaType === "video" || mediaType === "image" ? mediaType : undefined;

    const mediaDeps = await createDefaultInstagramMediaResolveDeps();
    const mediaCheck = await resolveInstagramPublishableMedia({
      userId,
      sourceImageId: sourceImageId ? String(sourceImageId) : null,
      sourceImagePath:
        typeof sourceImagePath === "string" ? sourceImagePath : null,
      mediaUrl: typeof rawUrl === "string" ? rawUrl : null,
      mediaTypeHint: hint,
      deps: mediaDeps,
    });
    if (!mediaCheck.ok) {
      const status = mediaCheck.code === "not_owned" ? 403 : 400;
      res.status(status).json({
        error: mediaCheck.error,
        code: mediaCheck.code,
      });
      return;
    }

    const resolvedPath = mediaCheck.sourceImagePath;
    const resolvedSourceId = mediaCheck.sourceImageId;

    const cap = validateCaption(caption);
    if (!cap.ok) {
      res.status(400).json({ error: cap.error, code: "invalid_caption" });
      return;
    }

    let integration;
    try {
      integration = await getMetaInstagramIntegration(req);
    } catch (e: any) {
      res.status(401).json({
        error: e?.message || "Instagram not connected",
        code: "not_connected",
        needsReconnect: true,
      });
      return;
    }

    if (draft === true) {
      let row;
      if (socialPostId) {
        const existing = await SocialPostDAO.findByIdForUser(
          socialPostId,
          userId
        );
        if (!existing) {
          res.status(404).json({ error: "Draft not found", code: "not_found" });
          return;
        }
        if (existing.provider && existing.provider !== META_INSTAGRAM_PROVIDER) {
          res.status(400).json({
            error: "This social post belongs to a different platform.",
            code: "provider_mismatch",
          });
          return;
        }
        if (existing.status === "published") {
          res.status(400).json({ error: "Cannot edit a published post as draft" });
          return;
        }
        if (existing.status === "publishing") {
          res.status(409).json({
            error: "A publish is already in progress for this post.",
            code: "publish_in_progress",
            ambiguous: true,
            socialPost: sanitizePost(existing),
          });
          return;
        }
        row = await SocialPostDAO.update(socialPostId, userId, {
          caption: cap.caption,
          sourceImageUrl: mediaCheck.url,
          sourceImageId: resolvedSourceId || existing.sourceImageId,
          sourceImagePath: resolvedPath ?? existing.sourceImagePath,
          status: "draft",
          destinationPageId: integration.igUserId,
          destinationPageName:
            integration.igUsername || integration.pageName,
          integrationId: integration.integrationId || null,
          provider: META_INSTAGRAM_PROVIDER,
          metadata: {
            ...(typeof existing.metadata === "object" && existing.metadata
              ? (existing.metadata as object)
              : {}),
            mediaKind: mediaCheck.mediaKind,
            platform: "instagram",
            mediaMirrored: mediaCheck.mirrored,
            mediaReusedExisting: mediaCheck.reusedExisting,
            libraryUrl: mediaCheck.canonicalLibraryUrl,
          },
        });
      } else {
        row = await SocialPostDAO.create({
          userId,
          integrationId: integration.integrationId || null,
          provider: META_INSTAGRAM_PROVIDER,
          destinationPageId: integration.igUserId,
          destinationPageName:
            integration.igUsername || integration.pageName,
          sourceImageId: resolvedSourceId || null,
          sourceImageUrl: mediaCheck.url,
          sourceImagePath: resolvedPath,
          caption: cap.caption,
          status: "draft",
          metadata: {
            mediaKind: mediaCheck.mediaKind,
            platform: "instagram",
            mediaMirrored: mediaCheck.mirrored,
            mediaReusedExisting: mediaCheck.reusedExisting,
            libraryUrl: mediaCheck.canonicalLibraryUrl,
          },
        });
      }
      res.status(200).json({
        success: true,
        status: "draft",
        socialPost: sanitizePost(row),
      });
      return;
    }

    let postRow;
    if (socialPostId) {
      const existing = await SocialPostDAO.findByIdForUser(
        socialPostId,
        userId
      );
      if (!existing) {
        res.status(404).json({ error: "Social post not found", code: "not_found" });
        return;
      }
      const guard = evaluateSocialPostForPublish({
        existing,
        expectedProvider: META_INSTAGRAM_PROVIDER,
        userId,
        sourceImageId: resolvedSourceId || null,
        forceRetry: forceRetry === true,
      });
      if (!guard.ok) {
        res.status(guard.status).json({
          error: guard.error,
          code: guard.code,
          ambiguous: guard.ambiguous,
          retrySafe: guard.retrySafe,
          socialPost: sanitizePost(existing),
        });
        return;
      }

      postRow = await SocialPostDAO.claimForPublish(socialPostId, userId, {
        caption: cap.caption,
        sourceImageUrl: mediaCheck.url,
        sourceImageId: resolvedSourceId || undefined,
        sourceImagePath: resolvedPath || undefined,
        destinationPageId: integration.igUserId,
        destinationPageName:
          integration.igUsername || integration.pageName,
        integrationId: integration.integrationId || null,
        provider: META_INSTAGRAM_PROVIDER,
        metadata: {
          mediaKind: mediaCheck.mediaKind,
          platform: "instagram",
          mediaMirrored: mediaCheck.mirrored,
          mediaReusedExisting: mediaCheck.reusedExisting,
          libraryUrl: mediaCheck.canonicalLibraryUrl,
          ambiguous: false,
          forceRetry: forceRetry === true,
        },
      });
      if (!postRow) {
        const raced = await SocialPostDAO.findByIdForUser(socialPostId, userId);
        res.status(409).json({
          error:
            "A publish is already in progress. Do not retry until status is known.",
          code: "publish_in_progress",
          ambiguous: true,
          retrySafe: false,
          socialPost: sanitizePost(raced),
        });
        return;
      }
    } else {
      postRow = await SocialPostDAO.create({
        userId,
        integrationId: integration.integrationId || null,
        provider: META_INSTAGRAM_PROVIDER,
        destinationPageId: integration.igUserId,
        destinationPageName:
          integration.igUsername || integration.pageName,
        sourceImageId: resolvedSourceId || null,
        sourceImageUrl: mediaCheck.url,
        sourceImagePath: resolvedPath,
        caption: cap.caption,
        status: "publishing",
        metadata: {
          mediaKind: mediaCheck.mediaKind,
          platform: "instagram",
          mediaMirrored: mediaCheck.mirrored,
          mediaReusedExisting: mediaCheck.reusedExisting,
          libraryUrl: mediaCheck.canonicalLibraryUrl,
        },
      });
    }

    if (!postRow) {
      res.status(500).json({ error: "Failed to create publishing record" });
      return;
    }

    const result = await publishInstagramCreative({
      igUserId: integration.igUserId,
      accessToken: integration.pageAccessToken,
      mediaUrl: mediaCheck.url,
      mediaType: mediaCheck.mediaKind,
      caption: cap.caption,
    });

    if (!result.ok) {
      const failed = await SocialPostDAO.update(postRow.id, userId, {
        status: "failed",
        errorMessage: result.error.slice(0, 500),
        metadata: {
          code: result.code,
          ambiguous: Boolean(result.ambiguous),
          platform: "instagram",
          mediaKind: mediaCheck.mediaKind,
        },
      });
      res.status(result.ambiguous ? 502 : 400).json({
        success: false,
        error: result.error,
        code: result.code,
        ambiguous: Boolean(result.ambiguous),
        socialPost: sanitizePost(failed || postRow),
        retrySafe: !result.ambiguous,
      });
      return;
    }

    const published = await SocialPostDAO.update(postRow.id, userId, {
      status: "published",
      metaPostId: result.mediaId,
      metaPhotoId: result.containerId,
      permalink: result.permalink,
      publishedAt: new Date().toISOString(),
      errorMessage: null,
      metadata: {
        platform: "instagram",
        mediaKind: result.mediaType,
        containerId: result.containerId,
      },
    });

    res.status(200).json({
      success: true,
      status: "published",
      metaPostId: result.mediaId,
      containerId: result.containerId,
      permalink: result.permalink,
      mediaType: result.mediaType,
      socialPost: sanitizePost(published),
    });
  } catch (err: any) {
    console.error("social instagram publish error:", err);
    res.status(500).json({
      error: err?.message || "Failed to publish to Instagram",
    });
  }
}

function sanitizePost(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    caption: row.caption,
    provider: row.provider,
    sourceImageUrl: row.sourceImageUrl ?? row.source_image_url,
    destinationPageId: row.destinationPageId ?? row.destination_page_id,
    destinationPageName: row.destinationPageName ?? row.destination_page_name,
    metaPostId: row.metaPostId ?? row.meta_post_id,
    metaPhotoId: row.metaPhotoId ?? row.meta_photo_id,
    permalink: row.permalink,
    errorMessage: row.errorMessage ?? row.error_message,
    publishedAt: row.publishedAt ?? row.published_at,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
    metadata: row.metadata,
  };
}
