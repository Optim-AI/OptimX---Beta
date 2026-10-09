import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { getMetaPublishIntegrationOptional } from "@/lib/social/facebook-publish/auth";
import { inspectAccessTokenPermissions } from "@/lib/social/facebook-publish/permissions";
import { META_PUBLISH_SCOPES } from "@/lib/social/facebook-publish/scopes";

/**
 * GET /api/social/facebook/status
 * Returns whether Facebook Page publishing is connected (no tokens).
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

    const integration = await getMetaPublishIntegrationOptional(req);

    if (!integration) {
      res.status(200).json({
        connected: false,
        requiredScopes: [...META_PUBLISH_SCOPES],
        connectPath: "/api/social/facebook/oauth/start",
      });
      return;
    }

    const storedScopes = Array.isArray(integration.scopes)
      ? integration.scopes
      : [];

    // Live check against Meta when possible (user token preferred)
    let live = null as Awaited<
      ReturnType<typeof inspectAccessTokenPermissions>
    > | null;
    try {
      const token =
        integration.userAccessToken || integration.pageAccessToken;
      if (token) {
        live = await inspectAccessTokenPermissions(token);
      }
    } catch {
      live = null;
    }

    const scopes =
      live && live.scopes.length > 0 ? live.scopes : storedScopes;
    const hasManagePosts =
      live?.hasManagePosts ??
      (scopes.includes("pages_manage_posts") || scopes.length === 0);
    const missingRequired = live?.missingRequired ?? [];
    const missingRecommended = live?.missingRecommended ?? [];

    res.status(200).json({
      connected: true,
      pageId: integration.pageId,
      pageName: integration.pageName,
      healthStatus: integration.healthStatus || "healthy",
      hasManagePosts,
      missingRequired,
      missingRecommended,
      requiredScopes: [...META_PUBLISH_SCOPES],
      canPublish: Boolean(
        integration.pageId &&
          integration.pageAccessToken &&
          hasManagePosts &&
          missingRequired.length === 0
      ),
      warning:
        missingRequired.length > 0
          ? `Missing Facebook permissions: ${missingRequired.join(", ")}. Update the Publish Login configuration and reconnect.`
          : missingRecommended.length > 0
            ? `Recommended permission not granted: ${missingRecommended.join(", ")}. Publishing may still work; include it in the Login configuration if Meta omits pages_manage_posts.`
            : null,
    });
  } catch (err: any) {
    console.error("social facebook status error:", err);
    res.status(500).json({
      error: err?.message || "Failed to load publishing status",
    });
  }
}
