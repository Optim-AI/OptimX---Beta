// pages/api/meta/oauth/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { decodeState } from '@/auth/helpers';
import { supabaseAdmin } from '@/auth/supabase/admin';
import { storeOAuthSession } from '@/integrations/meta/oauth-session';
import { getMetaOAuthRedirectUri } from "@/lib/ads/providers/meta/client";
import {
  fetchMetaAdAccountsForOAuth,
  fetchMetaPagesForOAuth,
  logMetaOAuthDiag,
} from "@/lib/ads/providers/meta/oauth-assets";

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
 * Exchanges authorization code for tokens, stores a temporary selection session,
 * and redirects to asset selection. Does not finalize the integration.
 *
 * Pages API convention: send the response via `res.*` and return `void`
 * (do not `return res.redirect(...)` — that triggers a Next.js dev warning).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let stage = "start";
  try {
    // Handle OAuth cancellation/errors
    if (req.query.error) {
      const errorReason = req.query.error_reason || req.query.error_description || "";
      res.redirect(`/integrations/meta/cancelled?reason=${encodeURIComponent(String(errorReason))}`);
      return;
    }

    // 1. Read authorization code
    stage = "read_code";
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code) {
      res.status(400).send("missing code");
      return;
    }

    // 2. Decode state to get Supabase token
    stage = "decode_state";
    const stateObj = decodeState(req.query.state);
    const supabaseTokenFromState = stateObj?.t ?? null;

    const authHeader = req.headers.authorization;
    const tokenFromHeader =
      authHeader && String(authHeader).startsWith("Bearer ")
        ? String(authHeader).slice(7)
        : null;
    const token = supabaseTokenFromState ?? tokenFromHeader ?? null;

    // 3. Resolve Supabase user ID
    let resolvedUserId: string | null = null;
    if (token) {
      stage = "resolve_supabase_user";
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user?.id) resolvedUserId = data.user.id;
      else
        console.warn("supabase getUser returned no user or error", {
          error: error ? { message: (error as any).message } : null,
          hasUser: !!data?.user,
        });
    }

    // Fallback to env var (for testing only)
    if (!resolvedUserId && process.env.SUPABASE_INTEGRATION_USER_ID) {
      resolvedUserId = process.env.SUPABASE_INTEGRATION_USER_ID;
    }

    if (!resolvedUserId) {
      res.status(400).json({
        error: "missing_supabase_user_id",
        message:
          "No Supabase user could be resolved. Ensure you pass the Supabase access token as `sb` to /api/meta/oauth/start or set SUPABASE_INTEGRATION_USER_ID.",
      });
      return;
    }

    // 4. Validate environment variables
    stage = "read_env";
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;

    if (!appId || !appSecret || !process.env.NEXT_PUBLIC_APP_URL) {
      res.status(500).json({ error: "server_misconfiguration" });
      return;
    }

    // Must match start.ts and Meta "Valid OAuth Redirect URIs" exactly
    const redirectUri = getMetaOAuthRedirectUri();

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
      logMetaOAuthDiag("token_exchange_failed", {
        httpOk: tokenResp.ok,
        errorCode: tokenJson.error?.code,
        errorMessage: tokenJson.error?.message,
        errorType: tokenJson.error?.type,
      });
      if (DEBUG) {
        res.status(500).json({ stage, error: tokenJson.error?.message });
        return;
      }
      res.status(500).json({
        error: "token_exchange_failed",
        details: tokenJson.error?.message ?? "see server logs",
      });
      return;
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
      if (DEBUG) {
        res.status(500).json({ stage, error: "no_user_token" });
        return;
      }
      res.status(500).json({
        error: "no_user_token",
        details: "Failed to obtain user access token",
      });
      return;
    }

    // 7. Get user's Facebook Pages (retry once — Graph can lag right after grant)
    stage = "get_pages";
    let pagesResult = await fetchMetaPagesForOAuth(userAccessToken);
    if (!pagesResult.error && pagesResult.data.length === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      pagesResult = await fetchMetaPagesForOAuth(userAccessToken);
      logMetaOAuthDiag("pages_retry", {
        count: pagesResult.data.length,
        errorCode: pagesResult.error?.code,
        errorMessage: pagesResult.error?.message,
      });
    }

    // Calculate token expiration (long-lived tokens last 60 days)
    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    // Handle error from Graph API
    if (pagesResult.error) {
      logMetaOAuthDiag("pages_fetch_failed", {
        errorCode: pagesResult.error.code,
        errorMessage: pagesResult.error.message,
        errorType: pagesResult.error.type,
        errorSubcode: pagesResult.error.error_subcode,
      });
      res.redirect(`/integrations/meta/error?type=pages_fetch_failed`);
      return;
    }

    // ERROR: No Facebook Pages found
    if (!pagesResult.data.length) {
      try {
        const sessionId = await storeOAuthSession(resolvedUserId, {
          userAccessToken,
          pages: [],
          adAccounts: [],
          errorType: "NO_PAGES",
        });
        // 307 Temporary Redirect is Next.js default for res.redirect(url) — intentional
        res.redirect(`/integrations/meta/no-pages?sessionId=${sessionId}`);
        return;
      } catch (err) {
        console.error("Failed to store no-pages session:", err);
        res.redirect(`/integrations/meta/no-pages`);
        return;
      }
    }

    // 8. Get Ad Accounts (rich fields for selection UI — never auto-pick)
    stage = "get_adaccounts";
    let adAccountsResult = await fetchMetaAdAccountsForOAuth(userAccessToken);
    if (!adAccountsResult.error && adAccountsResult.data.length === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      adAccountsResult = await fetchMetaAdAccountsForOAuth(userAccessToken);
      logMetaOAuthDiag("adaccounts_retry", {
        count: adAccountsResult.data.length,
        errorCode: adAccountsResult.error?.code,
        errorMessage: adAccountsResult.error?.message,
      });
    }

    if (adAccountsResult.error) {
      logMetaOAuthDiag("adaccounts_fetch_failed", {
        errorCode: adAccountsResult.error.code,
        errorMessage: adAccountsResult.error.message,
        errorType: adAccountsResult.error.type,
        errorSubcode: adAccountsResult.error.error_subcode,
      });
      // Continue — selection UI will show empty state / permission guidance
    }

    const adAccounts = adAccountsResult.data;

    // 9. Store temporary OAuth session
    stage = "store_session";
    try {
      const sessionId = await storeOAuthSession(resolvedUserId, {
        userAccessToken,
        pages: pagesResult.data,
        adAccounts,
        tokenExpiresAt: tokenExpiresAt.toISOString(),
      });

      logMetaOAuthDiag("session_stored", {
        pagesCount: pagesResult.data.length,
        adAccountsCount: adAccounts.length,
        hasPaging: pagesResult.hasPaging || adAccountsResult.hasPaging,
      });

      // 10. Redirect to asset selection (page + ad account — explicit choice required)
      res.redirect(`/integrations/meta/select-assets?sessionId=${sessionId}`);
      return;
    } catch (sessionErr) {
      console.error("Failed to store OAuth session:", sessionErr);
      res.redirect(`/integrations/meta/error?type=session_storage_failed`);
      return;
    }
  } catch (err: any) {
    console.error("meta oauth callback error (stage:", stage, "):", err);
    if (DEBUG) {
      res.status(500).json({
        error: "callback_error_debug",
        stage,
        details: safeStringify({ message: err?.message }),
      });
      return;
    }
    res.redirect(`/integrations/meta/error?type=callback_error&stage=${stage}`);
  }
}
