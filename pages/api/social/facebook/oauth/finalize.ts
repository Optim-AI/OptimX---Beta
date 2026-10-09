import type { NextApiRequest, NextApiResponse } from "next";
import {
  getOAuthSession,
  clearOAuthSession,
} from "@/integrations/meta/oauth-session";
import { saveIntegration } from "@/integrations/store";
import {
  META_PUBLISH_PROVIDER,
  META_PUBLISH_SCOPES,
} from "@/lib/social/facebook-publish/scopes";
import {
  inspectAccessTokenPermissions,
  sanitizePermissionDiagnosticsForLog,
} from "@/lib/social/facebook-publish/permissions";

/**
 * POST /api/social/facebook/oauth/finalize
 * Body: { sessionId: string, pageId: string }
 * Saves meta-publish integration without touching Meta Ads.
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
    const { sessionId, pageId } = req.body ?? {};

    if (!sessionId || !pageId) {
      res.status(400).json({
        error: "missing_parameters",
        message: "sessionId and pageId are required",
      });
      return;
    }

    const session = await getOAuthSession(sessionId);
    if (!session) {
      res.status(400).json({
        error: "session_expired",
        message:
          "Session not found or expired. Please reconnect Facebook Page publishing.",
      });
      return;
    }

    const selectedPage = session.pages.find((p) => p.id === pageId);
    if (!selectedPage) {
      res.status(400).json({
        error: "page_not_found",
        message: "Selected page not found in session. Please try again.",
      });
      return;
    }

    if (!selectedPage.access_token) {
      res.status(400).json({
        error: "missing_page_token",
        message:
          "Selected Page has no access token. Reconnect with the SkalX Publish Login configuration (pages_manage_posts).",
      });
      return;
    }

    // Inspect user-token grants (Page tokens often omit full scope lists).
    // debug_token.scopes alone is insufficient — FLB puts Page perms in granular_scopes.
    // /me/permissions is queried with the same user token (not the app token).
    const granted = await inspectAccessTokenPermissions(
      session.userAccessToken || selectedPage.access_token,
      { selectedPageId: selectedPage.id }
    );
    const effectiveScopes =
      granted.scopes.length > 0 ? granted.scopes : [...META_PUBLISH_SCOPES];
    const safeDiag = sanitizePermissionDiagnosticsForLog(granted.diagnostics);

    // Hard-fail only when we successfully inspected grants AND hard requirements are missing.
    // Soft-warn for recommended pages_read_engagement (Meta dependency docs; not our API calls).
    if (granted.missingRequired.length > 0 && granted.scopes.length > 0) {
      console.warn("[meta-publish] finalize missing required grants", {
        missingRequired: granted.missingRequired,
        missingRecommended: granted.missingRecommended,
        grantedCount: granted.scopes.length,
        source: granted.source,
        // Sanitized only: permission names, statuses, target-ID counts — never tokens/IDs.
        diagnostics: safeDiag,
      });
      res.status(400).json({
        error: "missing_permissions",
        message:
          `Facebook did not grant required publishing permissions: ${granted.missingRequired.join(", ")}. ` +
          `Granted on this token: ${granted.scopes.sort().join(", ") || "(none)"}. ` +
          `Update the SkalX Publish Login configuration to include at least pages_show_list and pages_manage_posts ` +
          `(include pages_read_engagement when available — Meta documents it as a dependency), then reconnect. ` +
          `If pages_manage_posts still cannot be granted, check this app's access level for that permission ` +
          `and that your Meta user is an app Admin/Developer/Tester with CREATE_CONTENT on the Page.`,
        missing: granted.missingRequired,
        missingRecommended: granted.missingRecommended,
        granted: granted.scopes,
        source: granted.source,
        diagnostics: safeDiag,
        needsReconnect: true,
      });
      return;
    }

    // Granted by name but granular target_ids exclude the selected Page.
    if (
      granted.hasManagePosts &&
      granted.diagnostics?.selectedPageCoveredByManagePosts === false
    ) {
      console.warn("[meta-publish] finalize manage_posts not covering selected page", {
        managePostsTargetIdCount:
          granted.diagnostics.managePostsTargetIdCount,
        source: granted.source,
      });
      res.status(400).json({
        error: "page_not_in_manage_posts_targets",
        message:
          "pages_manage_posts was granted, but not for the selected Page. " +
          "Reconnect and approve publishing for that Page, or pick a Page included in the Login grant.",
        granted: granted.scopes,
        source: granted.source,
        diagnostics: safeDiag,
        needsReconnect: true,
      });
      return;
    }

    if (granted.missingRecommended.length > 0 && granted.scopes.length > 0) {
      console.warn("[meta-publish] finalize missing recommended grants", {
        missingRecommended: granted.missingRecommended,
        source: granted.source,
        diagnostics: safeDiag,
      });
    }

    const integrationData = {
      createdAt: new Date().toISOString(),
      userAccessToken: session.userAccessToken,
      pageAccessToken: selectedPage.access_token,
      pageId: selectedPage.id,
      pageName: selectedPage.name,
      pageCategory: selectedPage.category || "",
      igUserId: null,
      adAccountId: null,
      allPages: session.pages.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
      })),
      tokenExpiresAt: session.tokenExpiresAt,
      healthStatus: "healthy",
      lastHealthCheck: new Date().toISOString(),
      scopes: effectiveScopes,
      metadata: {
        purpose: "facebook_page_publish",
        pageName: selectedPage.name,
        grantedScopes: granted.scopes,
        permissionCheckError: granted.rawError || null,
      },
      raw: {
        selectedPage: {
          id: selectedPage.id,
          name: selectedPage.name,
          category: selectedPage.category,
        },
        pagesCount: session.pages.length,
        purpose: "facebook_page_publish",
        grantedScopes: granted.scopes,
      },
    };

    let integration;
    try {
      integration = await saveIntegration(integrationData, {
        provider: META_PUBLISH_PROVIDER,
        userId: session.userId,
      });
    } catch (dbErr: any) {
      console.error("saveIntegration meta-publish failed:", dbErr);
      res.status(500).json({
        error: "db_save_failed",
        message: "Failed to save publishing connection",
        details: dbErr.message,
      });
      return;
    }

    try {
      await clearOAuthSession(sessionId);
    } catch {
      // non-fatal
    }

    res.status(200).json({
      success: true,
      provider: META_PUBLISH_PROVIDER,
      pageId: selectedPage.id,
      pageName: selectedPage.name,
      integrationId: integration?.id ?? null,
      grantedScopes: granted.scopes,
      canPublish: granted.scopes.length === 0 || granted.hasManagePosts,
    });
  } catch (err: any) {
    console.error("meta-publish finalize error:", err);
    res.status(500).json({
      error: "finalize_failed",
      message: err?.message || "Failed to finalize publishing connection",
    });
  }
}
