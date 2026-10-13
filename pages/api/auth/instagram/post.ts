/**
 * Legacy Instagram image publish.
 *
 * Security (PR A):
 * - Requires authenticated Supabase user
 * - Loads only that user's meta-instagram (organic) row
 * - Never uses Ads provider `meta` / getLatestByProvider
 *
 * Prefer Social Studio: POST /api/social/instagram/publish
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { readSavedIntegration } from "@/integrations/store";
import {
  executeLegacyInstagramImagePost,
  legacyInstagramOrganicProvider,
  resolveLegacyInstagramOrganicCreds,
  sanitizeLegacyPostClientPayload,
} from "@/lib/social/instagram/legacy-auth-post";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed", code: "method_not_allowed" });
    return;
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({
        error: "Authentication required",
        code: "unauthorized",
      });
      return;
    }

    const imageUrl =
      typeof req.body?.image_url === "string" ? req.body.image_url.trim() : "";
    const caption =
      typeof req.body?.caption === "string" ? req.body.caption : "";
    const alsoPostToFacebook = Boolean(req.body?.alsoPostToFacebook);

    if (!imageUrl) {
      res.status(400).json({
        error: "image_url required",
        code: "invalid_media",
      });
      return;
    }

    if (imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
      res.status(400).json({
        error:
          "Inline media is not supported. Provide a public HTTPS image URL.",
        code: "invalid_media",
      });
      return;
    }

    const provider = legacyInstagramOrganicProvider();
    const integration = await readSavedIntegration({
      userId,
      provider,
    });

    const resolved = resolveLegacyInstagramOrganicCreds({
      userId,
      integration,
    });
    if (!resolved.ok) {
      res.status(resolved.status).json({
        error: resolved.error,
        code: resolved.code,
      });
      return;
    }

    const result = await executeLegacyInstagramImagePost(
      {
        creds: resolved.creds,
        imageUrl,
        caption,
        alsoPostToFacebook,
      },
      {
        createMediaContainer: async ({
          igUserId,
          imageUrl: url,
          caption: cap,
          accessToken,
        }) => {
          const createUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media`;
          const params = new URLSearchParams({
            image_url: url,
            access_token: accessToken,
          });
          if (cap) params.append("caption", cap);
          const createResp = await fetch(createUrl, {
            method: "POST",
            body: params,
          });
          return createResp.json();
        },
        publishMedia: async ({ igUserId, creationId, accessToken }) => {
          const publishUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media_publish`;
          const params = new URLSearchParams({
            creation_id: creationId,
            access_token: accessToken,
          });
          const publishResp = await fetch(publishUrl, {
            method: "POST",
            body: params,
          });
          return publishResp.json();
        },
        createFacebookPhoto: async ({
          pageId,
          imageUrl: url,
          caption: cap,
          accessToken,
        }) => {
          const fbUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}/photos`;
          const params = new URLSearchParams({
            url,
            caption: cap || "",
            access_token: accessToken,
          });
          const fbResp = await fetch(fbUrl, {
            method: "POST",
            body: params,
          });
          return fbResp.json();
        },
      }
    );

    if (!result.ok) {
      res.status(result.status).json({
        error: result.error,
        code: result.code,
      });
      return;
    }

    res.status(200).json(
      sanitizeLegacyPostClientPayload({
        success: true,
        provider,
        creationId: result.creationId,
        mediaId: result.mediaId,
        // Legacy shape keys for integrationsInstagram.tsx
        createJson: { id: result.creationId },
        publishJson: result.mediaId ? { id: result.mediaId } : {},
        fbPostResult: result.facebookPost,
      })
    );
  } catch (err) {
    console.error("[auth/instagram/post]", err);
    res.status(500).json({
      error: "Instagram publish failed",
      code: "post_failed",
    });
  }
}
