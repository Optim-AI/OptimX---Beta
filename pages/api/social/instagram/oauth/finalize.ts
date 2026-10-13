import type { NextApiRequest, NextApiResponse } from "next";
import {
  getOAuthSession,
  clearOAuthSession,
} from "@/integrations/meta/oauth-session";
import { saveIntegration } from "@/integrations/store";
import type { InstagramEligibleAccount } from "@/lib/social/instagram/discovery";
import { inspectInstagramAccessTokenPermissions } from "@/lib/social/instagram/permissions";
import {
  META_INSTAGRAM_PROVIDER,
  META_INSTAGRAM_SCOPES,
} from "@/lib/social/instagram/scopes";

/**
 * POST /api/social/instagram/oauth/finalize
 * Body: { sessionId, igUserId }
 * Saves meta-instagram without touching Ads or Facebook publishing.
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
    const { sessionId, igUserId } = req.body ?? {};
    if (!sessionId || !igUserId) {
      res.status(400).json({
        error: "missing_parameters",
        message: "sessionId and igUserId are required",
      });
      return;
    }

    const session = await getOAuthSession(sessionId);
    if (!session) {
      res.status(400).json({
        error: "session_expired",
        message: "Session not found or expired. Please reconnect Instagram.",
      });
      return;
    }

    const accounts = (session.adAccounts || []) as InstagramEligibleAccount[];
    const selected = accounts.find((a) => a.igUserId === igUserId);
    if (!selected) {
      res.status(400).json({
        error: "account_not_found",
        message: "Selected Instagram account not found in session.",
      });
      return;
    }

    if (!selected.eligible || !selected.pageAccessToken) {
      res.status(400).json({
        error: "account_ineligible",
        message:
          selected.ineligibilityReason ||
          "Selected Instagram account is not eligible for publishing.",
      });
      return;
    }

    const granted = await inspectInstagramAccessTokenPermissions(
      session.userAccessToken || selected.pageAccessToken
    );
    const effectiveScopes =
      granted.scopes.length > 0 ? granted.scopes : [...META_INSTAGRAM_SCOPES];

    if (granted.missingRequired.length > 0 && granted.scopes.length > 0) {
      console.warn("[meta-instagram] finalize missing required grants", {
        missingRequired: granted.missingRequired,
        grantedCount: granted.scopes.length,
        source: granted.source,
      });
      res.status(400).json({
        error: "missing_permissions",
        message:
          `Facebook did not grant required Instagram permissions: ${granted.missingRequired.join(", ")}. ` +
          `Update the SkalX Instagram Login configuration to include instagram_basic, ` +
          `instagram_content_publish, and pages_show_list, then reconnect.`,
        missing: granted.missingRequired,
        missingRecommended: granted.missingRecommended,
        granted: granted.scopes,
        source: granted.source,
        needsReconnect: true,
      });
      return;
    }

    const integrationData = {
      createdAt: new Date().toISOString(),
      userAccessToken: session.userAccessToken,
      pageAccessToken: selected.pageAccessToken,
      pageId: selected.pageId,
      pageName: selected.pageName,
      pageCategory: selected.pageCategory || "",
      igUserId: selected.igUserId,
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
        purpose: "instagram_organic",
        igUsername: selected.igUsername,
        igName: selected.igName,
        igUserId: selected.igUserId,
        accountType: selected.accountType,
        pageName: selected.pageName,
        grantedScopes: granted.scopes,
        permissionCheckError: granted.rawError || null,
      },
      raw: {
        purpose: "instagram_organic",
        igUserId: selected.igUserId,
        igUsername: selected.igUsername,
        pageId: selected.pageId,
        grantedScopes: granted.scopes,
      },
    };

    let integration;
    try {
      integration = await saveIntegration(integrationData, {
        provider: META_INSTAGRAM_PROVIDER,
        userId: session.userId,
      });
    } catch (dbErr: any) {
      console.error("saveIntegration meta-instagram failed:", dbErr);
      res.status(500).json({
        error: "db_save_failed",
        message: "Failed to save Instagram connection",
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
      provider: META_INSTAGRAM_PROVIDER,
      igUserId: selected.igUserId,
      igUsername: selected.igUsername,
      pageId: selected.pageId,
      pageName: selected.pageName,
      integrationId: integration?.id ?? null,
      grantedScopes: granted.scopes,
      canPublish:
        granted.scopes.length === 0 || granted.hasContentPublish,
      canManageComments:
        granted.scopes.length === 0 || granted.hasManageComments,
      canManageInsights:
        granted.scopes.length === 0 || granted.hasManageInsights,
    });
  } catch (err: any) {
    console.error("meta-instagram finalize error:", err);
    res.status(500).json({
      error: "finalize_failed",
      message: err?.message || "Failed to finalize Instagram connection",
    });
  }
}
