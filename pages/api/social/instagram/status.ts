import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { getMetaInstagramIntegrationOptional } from "@/lib/social/instagram/auth";
import { inspectInstagramAccessTokenPermissions } from "@/lib/social/instagram/permissions";

/**
 * GET /api/social/instagram/status
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

    const integration = await getMetaInstagramIntegrationOptional(req);
    if (!integration) {
      res.status(200).json({
        connected: false,
        canPublish: false,
        canManageComments: false,
        canManageInsights: false,
        available: true,
        reason: "Connect an Instagram Business or Creator account to publish.",
      });
      return;
    }

    let live = null as Awaited<
      ReturnType<typeof inspectInstagramAccessTokenPermissions>
    > | null;
    try {
      const token =
        integration.userAccessToken || integration.pageAccessToken;
      if (token) live = await inspectInstagramAccessTokenPermissions(token);
    } catch {
      live = null;
    }

    const scopes = live?.scopes?.length
      ? live.scopes
      : integration.scopes || [];
    const canPublish =
      scopes.length === 0 ||
      scopes.includes("instagram_content_publish");
    const canManageComments =
      scopes.length === 0 || scopes.includes("instagram_manage_comments");
    const canManageInsights =
      scopes.length === 0 || scopes.includes("instagram_manage_insights");

    const missingRecommended = live?.missingRecommended || [];

    res.status(200).json({
      connected: true,
      available: true,
      canPublish,
      canManageComments,
      canManageInsights,
      igUserId: integration.igUserId,
      igUsername: integration.igUsername,
      pageId: integration.pageId,
      pageName: integration.pageName,
      healthStatus: integration.healthStatus,
      scopes,
      warning:
        missingRecommended.length > 0
          ? `Recommended permission not granted: ${missingRecommended.join(", ")}.`
          : null,
      reason: canPublish
        ? null
        : "instagram_content_publish was not granted. Update the Instagram Login configuration and reconnect.",
    });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || "Failed to load Instagram status",
    });
  }
}
