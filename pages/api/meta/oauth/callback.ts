// pages/api/meta/oauth/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { parse, serialize } from "cookie";
import { verifyState, STATE_COOKIE } from '@/lib/meta/oauth-state';
import { storeOAuthSession } from '@/integrations/meta/oauth-session';

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";
const DEBUG = process.env.DEBUG_CALLBACK === "true";

function safeStringify(obj: any) {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

/**
 * Meta OAuth callback handler.
 * Exchanges authorization code for tokens and saves integration credentials.
 * This replaces /api/auth/instagram/callback
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let stage = "start";
  // The nonce cookie is single-use.
  res.setHeader("Set-Cookie", serialize(STATE_COOKIE, "", { path: "/api/meta/oauth", maxAge: 0 }));
  try {
    // Handle OAuth cancellation/errors
    if (req.query.error) {
      const errorReason = req.query.error_reason || req.query.error_description || "";
      return res.redirect(`/integrations/meta/cancelled?reason=${encodeURIComponent(String(errorReason))}`);
    }

    // 1. Read authorization code
    stage = "read_code";
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code) return res.status(400).send("missing code");

    // 2. Check the signed state against the nonce cookie set by /api/meta/oauth/start.
    //    The user comes only from the signed state, never from a token in the URL.
    stage = "verify_state";
    const firstQ = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
    const verified = verifyState(firstQ(req.query.state), parse(req.headers.cookie ?? "")[STATE_COOKIE]);
    if (!verified.ok) {
      console.warn("[meta oauth] bad state", verified.reason);
      return res.redirect(`/integrations/meta/error?type=${verified.reason === "expired" ? "expired" : "state"}`);
    }
    const resolvedUserId = verified.userId;

    // 4. Validate environment variables
    stage = "read_env";
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/oauth/callback`;

    if (!appId || !appSecret || !process.env.NEXT_PUBLIC_APP_URL) {
      return res.status(500).json({ error: "server_misconfiguration" });
    }

    // 5. Exchange authorization code for access token
    stage = "exchange_token";
    const tokenResp = await fetch(
      `https://graph.facebook.com/v${VERSION}/oauth/access_token` +
        `?client_id=${encodeURIComponent(appId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&code=${encodeURIComponent(String(code))}`
    );
    const tokenJson = await tokenResp.json();

    if (tokenJson.error) {
      if (DEBUG) return res.status(500).json({ stage, tokenJson });
      return res.status(500).json({
        error: "token_exchange_failed",
        details: tokenJson.error?.message ?? "see server logs",
      });
    }

    // 6. Exchange short-lived token for long-lived token (60 days)
    stage = "extend_token";
    const exchangeResp = await fetch(
      `https://graph.facebook.com/v${VERSION}/oauth/access_token` +
        `?grant_type=fb_exchange_token` +
        `&client_id=${encodeURIComponent(appId)}` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&fb_exchange_token=${encodeURIComponent(tokenJson.access_token)}`
    );
    const exchangeJson = await exchangeResp.json();
    const userAccessToken = exchangeJson.access_token || tokenJson.access_token;

    if (!userAccessToken) {
      if (DEBUG) return res.status(500).json({ stage, tokenJson, exchangeJson });
      return res.status(500).json({
        error: "no_user_token",
        details: "Failed to obtain user access token",
      });
    }

    // 7. Get user's Facebook Pages with extended fields
    stage = "get_pages";
    const pagesResp = await fetch(
      `https://graph.facebook.com/v${VERSION}/me/accounts?fields=id,name,category,access_token,tasks,instagram_business_account&access_token=${encodeURIComponent(userAccessToken)}`
    );
    const pagesJson = await pagesResp.json();

    // Calculate token expiration (long-lived tokens last 60 days)
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Handle error from Graph API
    if (pagesJson.error) {
      console.error("Failed to fetch pages:", pagesJson.error);
      return res.redirect(`/integrations/meta/error?type=pages_fetch_failed`);
    }

    // ERROR: No Facebook Pages found
    if (!pagesJson?.data?.length) {
      // Store session for potential retry after page creation
      try {
        const sessionId = await storeOAuthSession(resolvedUserId, {
          userAccessToken,
          pages: [],
          errorType: "NO_PAGES",
        });
        return res.redirect(`/integrations/meta/no-pages?sessionId=${sessionId}`);
      } catch (err) {
        console.error("Failed to store no-pages session:", err);
        return res.redirect(`/integrations/meta/no-pages`);
      }
    }

    // 8. Get Ad Accounts
    stage = "get_adaccounts";
    const adAccountsResp = await fetch(
      `https://graph.facebook.com/v${VERSION}/me/adaccounts?access_token=${encodeURIComponent(userAccessToken)}`
    );
    const adAccountsJson = await adAccountsResp.json();

    // 9. Store temporary OAuth session
    stage = "store_session";
    try {
      const sessionId = await storeOAuthSession(resolvedUserId, {
        userAccessToken,
        pages: pagesJson.data,
        adAccounts: adAccountsJson?.data || [],
        tokenExpiresAt: tokenExpiresAt.toISOString(),
      });

      // 10. Redirect to page selection UI
      return res.redirect(`/integrations/meta/select-page?sessionId=${sessionId}`);
    } catch (sessionErr) {
      console.error("Failed to store OAuth session:", sessionErr);
      return res.redirect(`/integrations/meta/error?type=session_storage_failed`);
    }
  } catch (err: any) {
    console.error("meta oauth callback error (stage:", stage, "):", err);
    if (DEBUG)
      return res.status(500).json({
        error: "callback_error_debug",
        stage,
        details: safeStringify(err),
      });
    return res.redirect(`/integrations/meta/error?type=callback_error&stage=${stage}`);
  }
}
