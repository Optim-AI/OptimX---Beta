// pages/api/meta/oauth/finalize.ts
import type { NextApiRequest, NextApiResponse } from "next";
import {
  getOAuthSession,
  clearOAuthSession,
} from "@/integrations/meta/oauth-session";
import { saveIntegration, setUserStatusForUser } from "@/integrations/store";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";
import { META_ADS_SCOPES } from "@/lib/ads/providers/meta/client";
import { metaAdsProvider } from "@/lib/ads/providers/meta/provider";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

/**
 * POST /api/meta/oauth/finalize
 * Completes Meta OAuth — requires explicit pageId AND adAccountId (no auto-select).
 *
 * Body: { sessionId: string, pageId: string, adAccountId: string }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { sessionId, pageId, adAccountId } = req.body ?? {};

    if (!sessionId || !pageId || !adAccountId) {
      return res.status(400).json({
        error: "missing_parameters",
        message:
          "sessionId, pageId, and adAccountId are all required. Do not auto-select an ad account.",
      });
    }

    const session = await getOAuthSession(sessionId);
    if (!session) {
      return res.status(400).json({
        error: "session_expired",
        message:
          "Session not found or expired. Please reconnect your Meta account.",
      });
    }

    const selectedPage = session.pages.find((p) => p.id === pageId);
    if (!selectedPage) {
      return res.status(400).json({
        error: "page_not_found",
        message: "Selected page not found in session. Please try again.",
      });
    }

    const normalizedAdId = String(adAccountId).replace(/^act_/, "");
    const sessionAccounts = session.adAccounts || [];
    const matchedAccount = sessionAccounts.find((a: any) => {
      const id = String(a.account_id || a.id || "").replace(/^act_/, "");
      return id === normalizedAdId;
    });

    if (!matchedAccount && sessionAccounts.length > 0) {
      return res.status(400).json({
        error: "ad_account_not_found",
        message:
          "Selected ad account was not in the authorized account list. Please choose again.",
      });
    }

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
    }

    const integrationData = {
      createdAt: new Date().toISOString(),
      userAccessToken: session.userAccessToken,
      pageAccessToken: selectedPage.access_token,
      pageId: selectedPage.id,
      pageName: selectedPage.name,
      pageCategory: selectedPage.category || "",
      igUserId,
      adAccountId: normalizedAdId,
      allPages: session.pages.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
      })),
      tokenExpiresAt: session.tokenExpiresAt,
      healthStatus: "healthy",
      lastHealthCheck: new Date().toISOString(),
      scopes: [...META_ADS_SCOPES],
      metadata: {
        selectedAdAccount: matchedAccount || { id: normalizedAdId },
        pageName: selectedPage.name,
      },
      raw: {
        selectedPage: {
          id: selectedPage.id,
          name: selectedPage.name,
          category: selectedPage.category,
        },
        igUserId,
        adAccountId: normalizedAdId,
        pagesCount: session.pages.length,
        adAccountsCount: sessionAccounts.length,
      },
    };

    let integration;
    try {
      integration = await saveIntegration(integrationData, {
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

    // Persist all discovered ad accounts; mark selected
    try {
      const discovered =
        sessionAccounts.length > 0
          ? sessionAccounts.map((a: any) => ({
              accountId: String(a.account_id || a.id || "").replace(/^act_/, ""),
              name: a.name ?? null,
              currency: a.currency ?? null,
              timezone: a.timezone_name ?? null,
              status:
                a.account_status != null ? String(a.account_status) : null,
              raw: a,
            }))
          : [
              {
                accountId: normalizedAdId,
                name: matchedAccount?.name ?? null,
                raw: matchedAccount || { id: normalizedAdId },
              },
            ];

      // Prefer live discovery if session list empty
      if (sessionAccounts.length === 0) {
        try {
          const live = await metaAdsProvider.listAdAccounts({
            userId: session.userId,
            integrationId: integration.id,
            accessToken: session.userAccessToken,
          });
          if (live.length) {
            await AdAccountDAO.upsertDiscovered(integration.id, "meta", live);
          } else {
            await AdAccountDAO.upsertDiscovered(
              integration.id,
              "meta",
              discovered
            );
          }
        } catch {
          await AdAccountDAO.upsertDiscovered(
            integration.id,
            "meta",
            discovered
          );
        }
      } else {
        await AdAccountDAO.upsertDiscovered(integration.id, "meta", discovered);
      }

      await AdAccountDAO.selectAccount(integration.id, normalizedAdId);
    } catch (accErr: any) {
      console.error("ad account persist failed:", accErr);
      return res.status(500).json({
        error: "ad_account_save_failed",
        message: accErr.message,
      });
    }

    try {
      await setUserStatusForUser(session.userId, "meta", true);
    } catch (e) {
      console.warn("Failed to set user status:", e);
    }

    await clearOAuthSession(sessionId);

    // Initial performance sync (best-effort — does not block connect)
    let sync: any = null;
    try {
      const { runAdsSync } = await import("@/lib/ads/sync/runner");
      sync = await runAdsSync({
        userId: session.userId,
        provider: "meta",
        triggerSource: "reconnect",
        lookbackDays: 30,
      });
    } catch (e: any) {
      sync = { ok: false, error: e?.message };
    }

    return res.status(200).json({
      success: true,
      integration: {
        id: integration.id,
        pageId: selectedPage.id,
        pageName: selectedPage.name,
        adAccountId: normalizedAdId,
        igUserId,
      },
      sync,
    });
  } catch (err: any) {
    console.error("meta finalize error:", err);
    return res.status(500).json({
      error: "server_error",
      message: err?.message || "Finalize failed",
    });
  }
}
