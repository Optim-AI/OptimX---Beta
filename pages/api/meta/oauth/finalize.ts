// pages/api/meta/oauth/finalize.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getOAuthSession, clearOAuthSession } from '@/integrations/meta/oauth-session';
import { saveIntegration, setStatus } from '@/integrations/store';

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

/**
 * POST /api/meta/oauth/finalize
 * Completes the Meta OAuth integration by saving the selected page
 *
 * Body: { sessionId: string, pageId: string }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sessionId, pageId } = req.body;

    // Validate input
    if (!sessionId || !pageId) {
      return res.status(400).json({
        error: "missing_parameters",
        message: "Both sessionId and pageId are required",
      });
    }

    // Retrieve OAuth session
    const session = await getOAuthSession(sessionId);

    if (!session) {
      return res.status(400).json({
        error: "session_expired",
        message: "Session not found or expired. Please reconnect your Meta account.",
      });
    }

    // Find the selected page
    const selectedPage = session.pages.find((p) => p.id === pageId);

    if (!selectedPage) {
      return res.status(400).json({
        error: "page_not_found",
        message: "Selected page not found in session. Please try again.",
      });
    }

    // Get Instagram Business Account for selected page
    let igUserId: string | null = null;
    try {
      const igResp = await fetch(
        `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(
          pageId
        )}?fields=instagram_business_account&access_token=${encodeURIComponent(
          selectedPage.access_token
        )}`
      );
      const igJson = await igResp.json();
      igUserId = igJson.instagram_business_account?.id ?? null;
    } catch (igErr) {
      console.warn("Failed to fetch Instagram account:", igErr);
      // Non-fatal - continue without Instagram
    }

    // Get first ad account ID from session
    const adAccountId = session.adAccounts?.[0]?.id
      ? session.adAccounts[0].id.replace(/^act_/, "")
      : null;

    // Prepare integration data
    const integrationData = {
      createdAt: new Date().toISOString(),
      userAccessToken: session.userAccessToken,
      pageAccessToken: selectedPage.access_token,
      pageId: selectedPage.id,
      pageName: selectedPage.name,
      pageCategory: selectedPage.category || "",
      igUserId,
      adAccountId,
      allPages: session.pages, // Store all pages for future switching
      tokenExpiresAt: session.tokenExpiresAt, // Token expiration from OAuth callback
      healthStatus: 'healthy', // New integration is healthy
      lastHealthCheck: new Date().toISOString(),
      raw: {
        selectedPage,
        igUserId,
        adAccountId,
        session: {
          pagesCount: session.pages.length,
          adAccountsCount: session.adAccounts?.length || 0,
        },
      },
    };

    // Save integration to database
    try {
      await saveIntegration(integrationData, {
        provider: "meta",
        userId: session.userId,
      });
    } catch (dbErr: any) {
      console.error("saveIntegration failed:", dbErr);
      return res.status(500).json({
        error: "db_save_failed",
        message: "Failed to save integration",
        details: dbErr.message,
      });
    }

    // Update global status (optional)
    try {
      await setStatus("meta", true);
    } catch (e) {
      // Non-fatal
      console.warn("Failed to set status:", e);
    }

    // Clean up temporary session
    await clearOAuthSession(sessionId);

    // Return success
    return res.status(200).json({
      success: true,
      integration: {
        pageId: selectedPage.id,
        pageName: selectedPage.name,
        pageCategory: selectedPage.category,
        hasInstagram: !!igUserId,
        hasAds: !!adAccountId,
      },
    });
  } catch (err: any) {
    console.error("Finalize integration error:", err);
    return res.status(500).json({
      error: "finalize_error",
      message: "Failed to finalize integration",
      details: err.message,
    });
  }
}
