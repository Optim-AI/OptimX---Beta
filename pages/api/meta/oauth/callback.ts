// pages/api/meta/oauth/callback.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { decodeState } from "../../../../lib/authHelpers";
import { supabaseAdmin } from "../../../../lib/supabaseClient";
import { saveIntegration, setStatus } from "../../../../lib/integrationStore";

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
  try {
    // 1. Read authorization code
    stage = "read_code";
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code) return res.status(400).send("missing code");

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
          error,
          data,
        });
    }

    // Fallback to env var (for testing only)
    if (!resolvedUserId && process.env.SUPABASE_INTEGRATION_USER_ID) {
      resolvedUserId = process.env.SUPABASE_INTEGRATION_USER_ID;
    }

    if (!resolvedUserId) {
      return res.status(400).json({
        error: "missing_supabase_user_id",
        message:
          "No Supabase user could be resolved. Ensure you pass the Supabase access token as `sb` to /api/meta/oauth/start or set SUPABASE_INTEGRATION_USER_ID.",
      });
    }

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

    // 7. Get user's Facebook Pages
    stage = "get_pages";
    const pagesResp = await fetch(
      `https://graph.facebook.com/v${VERSION}/me/accounts?access_token=${encodeURIComponent(userAccessToken)}`
    );
    const pagesJson = await pagesResp.json();

    if (!pagesJson?.data?.length) {
      return res.status(400).json({
        error: "no_pages_found",
        message:
          "No Facebook Pages found. Please create a Facebook Page and connect an Instagram Business account to it.",
      });
    }

    // Use first page
    const page = pagesJson.data[0];
    const pageAccessToken = page.access_token;
    const pageId = page.id;

    // 8. Get Instagram Business Account linked to this page
    stage = "get_ig";
    const igResp = await fetch(
      `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}?fields=instagram_business_account&access_token=${encodeURIComponent(pageAccessToken)}`
    );
    const igJson = await igResp.json();
    const igUserId = igJson.instagram_business_account?.id ?? null;

    // 9. Get Ad Accounts
    stage = "get_adaccounts";
    const adAccountsResp = await fetch(
      `https://graph.facebook.com/v${VERSION}/me/adaccounts?access_token=${encodeURIComponent(userAccessToken)}`
    );
    const adAccountsJson = await adAccountsResp.json();
    const adAccountId = adAccountsJson?.data?.[0]?.id
      ? adAccountsJson.data[0].id.replace(/^act_/, "")
      : null;

    // 10. Save integration to Supabase
    const saved = {
      createdAt: new Date().toISOString(),
      userAccessToken,
      pageAccessToken,
      pageId,
      igUserId,
      adAccountId,
      raw: { tokenJson, exchangeJson, pagesJson, igJson, adAccountsJson },
    };

    stage = "save_integration";
    try {
      await saveIntegration(saved, { provider: "meta", userId: resolvedUserId });
    } catch (dbErr) {
      console.error("saveIntegration failed:", dbErr);
      return res.status(500).json({
        error: "db_save_failed",
        details: safeStringify(dbErr),
      });
    }

    // 11. Update global status flag (optional)
    try {
      await setStatus("meta", true);
    } catch (e) {
      /* non-fatal */
    }

    // 12. Send success response with popup close script
    const fallback = `/integrations?connected=meta&next=/integrationsInstagram`;
    return res.send(`
      <!doctype html>
      <html>
        <head><meta charset="utf-8"/><title>Meta Connected</title></head>
        <body>
          <p>Meta integration connected successfully. You can close this window.</p>
          <script>
            try {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({
                  type: "oauth_connected",
                  platform: "meta",
                  redirect: "/integrationsInstagram"
                }, "*");
              }
            } catch (e) {}
            setTimeout(function(){
              try{ window.close(); } catch(e){}
              window.location = ${JSON.stringify(fallback)};
            }, 600);
          </script>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("meta oauth callback error (stage:", stage, "):", err);
    if (DEBUG)
      return res.status(500).json({
        error: "callback_error_debug",
        stage,
        details: safeStringify(err),
      });
    return res.status(500).json({
      error: "callback_error",
      details: `stage=${stage}. Check server logs.`,
    });
  }
}
