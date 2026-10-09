import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { SocialPostDAO } from "@/database/models/SocialPost.dao";
import { getMetaPublishIntegration } from "@/lib/social/facebook-publish/auth";
import {
  validateCaption,
  validatePublishableImageUrl,
} from "@/lib/social/facebook-publish/media";
import { publishFacebookPagePhoto } from "@/lib/social/facebook-publish/publish";
import { mapPublishPermissionError } from "@/lib/social/facebook-publish/permissions";
import { META_PUBLISH_PROVIDER } from "@/lib/social/facebook-publish/scopes";

/**
 * POST /api/social/facebook/publish
 * Body: {
 *   imageUrl: string;
 *   caption?: string;
 *   sourceImageId?: string;
 *   sourceImagePath?: string;
 *   draft?: boolean;
 *   socialPostId?: string; // resume a draft
 * }
 *
 * Never auto-retries Meta publish on ambiguous failures.
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
      caption,
      sourceImageId,
      sourceImagePath,
      draft,
      socialPostId,
    } = req.body ?? {};

    const mediaCheck = await validatePublishableImageUrl(imageUrl);
    if (!mediaCheck.ok) {
      res.status(400).json({ error: mediaCheck.error, code: "invalid_media" });
      return;
    }

    const cap = validateCaption(caption);
    if (!cap.ok) {
      res.status(400).json({ error: cap.error, code: "invalid_caption" });
      return;
    }

    let integration;
    try {
      integration = await getMetaPublishIntegration(req);
    } catch (e: any) {
      res.status(401).json({
        error: e?.message || "Publishing not connected",
        code: "not_connected",
        needsReconnect: true,
      });
      return;
    }

    if (!integration.pageId || !integration.pageAccessToken) {
      res.status(400).json({
        error: "No Facebook Page selected for publishing",
        code: "missing_page",
        needsReconnect: true,
      });
      return;
    }

    // Save draft only
    if (draft === true) {
      let row;
      if (socialPostId) {
        const existing = await SocialPostDAO.findByIdForUser(
          socialPostId,
          userId
        );
        if (!existing) {
          res.status(404).json({ error: "Draft not found" });
          return;
        }
        if (existing.status === "published") {
          res.status(400).json({ error: "Cannot edit a published post as draft" });
          return;
        }
        row = await SocialPostDAO.update(socialPostId, userId, {
          caption: cap.caption,
          sourceImageUrl: mediaCheck.url,
          sourceImageId: sourceImageId || existing.sourceImageId,
          sourceImagePath: sourceImagePath ?? existing.sourceImagePath,
          status: "draft",
          destinationPageId: integration.pageId,
          destinationPageName: integration.pageName,
          integrationId: integration.integrationId || null,
        });
      } else {
        row = await SocialPostDAO.create({
          userId,
          integrationId: integration.integrationId || null,
          provider: META_PUBLISH_PROVIDER,
          destinationPageId: integration.pageId,
          destinationPageName: integration.pageName,
          sourceImageId: sourceImageId || null,
          sourceImageUrl: mediaCheck.url,
          sourceImagePath: sourceImagePath || null,
          caption: cap.caption,
          status: "draft",
        });
      }

      res.status(200).json({
        success: true,
        status: "draft",
        socialPost: sanitizePost(row),
      });
      return;
    }

    // Prevent duplicate publish of an already-published record
    if (socialPostId) {
      const existing = await SocialPostDAO.findByIdForUser(socialPostId, userId);
      if (!existing) {
        res.status(404).json({ error: "Social post not found" });
        return;
      }
      if (existing.status === "published" && existing.metaPostId) {
        res.status(409).json({
          error: "This post was already published",
          code: "already_published",
          socialPost: sanitizePost(existing),
        });
        return;
      }
      if (existing.status === "publishing") {
        res.status(409).json({
          error:
            "A publish is already in progress for this post. Do not retry until status is known.",
          code: "publish_in_progress",
          socialPost: sanitizePost(existing),
          ambiguous: true,
        });
        return;
      }
    }

    let postRow =
      socialPostId
        ? await SocialPostDAO.update(socialPostId, userId, {
            status: "publishing",
            caption: cap.caption,
            sourceImageUrl: mediaCheck.url,
            sourceImageId: sourceImageId || undefined,
            sourceImagePath: sourceImagePath || undefined,
            destinationPageId: integration.pageId,
            destinationPageName: integration.pageName,
            integrationId: integration.integrationId || null,
            errorMessage: null,
          })
        : await SocialPostDAO.create({
            userId,
            integrationId: integration.integrationId || null,
            provider: META_PUBLISH_PROVIDER,
            destinationPageId: integration.pageId,
            destinationPageName: integration.pageName,
            sourceImageId: sourceImageId || null,
            sourceImageUrl: mediaCheck.url,
            sourceImagePath: sourceImagePath || null,
            caption: cap.caption,
            status: "publishing",
          });

    if (!postRow) {
      res.status(500).json({ error: "Failed to create publishing record" });
      return;
    }

    const result = await publishFacebookPagePhoto({
      pageId: integration.pageId,
      pageAccessToken: integration.pageAccessToken,
      userId,
      imageUrl: mediaCheck.url,
      sourceImageId: sourceImageId || null,
      sourceImagePath: sourceImagePath || null,
      caption: cap.caption,
    });

    if (!result.ok) {
      const mapped = mapPublishPermissionError(result.error);
      const userError = mapped.code !== "meta_api_error" ? mapped.error : result.error;
      const failed = await SocialPostDAO.update(postRow.id, userId, {
        status: "failed",
        errorMessage: userError.slice(0, 500),
        metadata: {
          code: mapped.code !== "meta_api_error" ? mapped.code : result.code,
          ambiguous: Boolean(result.ambiguous),
          needsAppReview: mapped.needsAppReview,
        },
      });

      res.status(result.ambiguous ? 502 : 400).json({
        success: false,
        error: userError,
        code: mapped.code !== "meta_api_error" ? mapped.code : result.code,
        ambiguous: Boolean(result.ambiguous),
        needsReconnect: mapped.needsReconnect,
        needsAppReview: mapped.needsAppReview,
        socialPost: sanitizePost(failed || postRow),
        // Instruct client: do not auto-retry if ambiguous
        retrySafe: !result.ambiguous && !mapped.needsAppReview,
      });
      return;
    }

    const permalink =
      result.postId && integration.pageId
        ? `https://www.facebook.com/${result.postId}`
        : null;

    const published = await SocialPostDAO.update(postRow.id, userId, {
      status: "published",
      metaPostId: result.postId,
      metaPhotoId: result.photoId,
      sourceImageUrl: result.canonicalUrl || mediaCheck.url,
      permalink,
      publishedAt: new Date().toISOString(),
      errorMessage: null,
      metadata: {
        rawIds: result.raw,
        uploadMode: result.uploadMode,
      },
    });

    res.status(200).json({
      success: true,
      status: "published",
      metaPostId: result.postId,
      metaPhotoId: result.photoId,
      permalink,
      uploadMode: result.uploadMode,
      socialPost: sanitizePost(published),
    });
  } catch (err: any) {
    console.error("social facebook publish error:", err);
    res.status(500).json({
      error: err?.message || "Failed to publish",
    });
  }
}

function sanitizePost(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    caption: row.caption,
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
  };
}
