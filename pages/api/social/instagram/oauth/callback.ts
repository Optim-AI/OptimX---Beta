import type { NextApiRequest, NextApiResponse } from "next";
import { storeOAuthSession } from "@/integrations/meta/oauth-session";
import { resolveOAuthCallbackUserFromRequest } from "@/lib/auth/resolve-oauth-callback-user";
import { fetchMetaPagesForOAuth } from "@/lib/ads/providers/meta/oauth-assets";
import { discoverInstagramAccountsFromPages } from "@/lib/social/instagram/discovery";
import {
  getMetaInstagramRedirectUri,
  META_INSTAGRAM_PROVIDER,
} from "@/lib/social/instagram/scopes";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

/**
 * Meta OAuth callback for Instagram (provider = meta-instagram).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let stage = "start";
  try {
    if (req.query.error) {
      const errorReason =
        req.query.error_reason || req.query.error_description || "";
      res.redirect(
        `/integrations/instagram-publish/cancelled?reason=${encodeURIComponent(String(errorReason))}`
      );
      return;
    }

    stage = "read_code";
    const code = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
    if (!code) {
      res.status(400).send("missing code");
      return;
    }

    stage = "resolve_supabase_user";
    const identity = await resolveOAuthCallbackUserFromRequest({
      state: req.query.state,
      authorizationHeader: req.headers.authorization,
      expectedStateProvider: META_INSTAGRAM_PROVIDER,
    });
    if (!identity.ok) {
      res.status(identity.status).json({
        error: identity.code,
        message: identity.error,
      });
      return;
    }
    const resolvedUserId = identity.userId;

    stage = "read_env";
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret || !process.env.NEXT_PUBLIC_APP_URL) {
      res.status(500).json({ error: "server_misconfiguration" });
      return;
    }

    const redirectUri = getMetaInstagramRedirectUri();

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
      console.error("[meta-instagram] token_exchange_failed", {
        message: tokenJson.error?.message,
        code: tokenJson.error?.code,
      });
      res.redirect(`/integrations/instagram-publish/error?type=token_exchange_failed`);
      return;
    }

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
      res.redirect(`/integrations/instagram-publish/error?type=no_user_token`);
      return;
    }

    stage = "get_pages";
    let pagesResult = await fetchMetaPagesForOAuth(userAccessToken);
    if (!pagesResult.error && pagesResult.data.length === 0) {
      await new Promise((r) => setTimeout(r, 1500));
      pagesResult = await fetchMetaPagesForOAuth(userAccessToken);
    }

    const tokenExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

    if (pagesResult.error) {
      res.redirect(`/integrations/instagram-publish/error?type=pages_fetch_failed`);
      return;
    }

    stage = "discover_ig";
    const discovery = await discoverInstagramAccountsFromPages({
      pages: pagesResult.data,
      userAccessToken,
    });

    if (!discovery.accounts.length) {
      const sessionId = await storeOAuthSession(
        resolvedUserId,
        {
          userAccessToken,
          pages: pagesResult.data,
          adAccounts: [],
          errorType: "NO_INSTAGRAM",
          tokenExpiresAt: tokenExpiresAt.toISOString(),
        },
        {
          provider: META_INSTAGRAM_PROVIDER,
          sessionPrefix: "oauth_meta_instagram",
        }
      );
      res.redirect(
        `/integrations/instagram-publish/select-account?sessionId=${sessionId}&error=NO_INSTAGRAM`
      );
      return;
    }

    stage = "store_session";
    // Stash discovered IG accounts in adAccounts field to avoid schema change
    const sessionId = await storeOAuthSession(
      resolvedUserId,
      {
        userAccessToken,
        pages: pagesResult.data,
        adAccounts: discovery.accounts as any,
        tokenExpiresAt: tokenExpiresAt.toISOString(),
      },
      {
        provider: META_INSTAGRAM_PROVIDER,
        sessionPrefix: "oauth_meta_instagram",
      }
    );

    res.redirect(
      `/integrations/instagram-publish/select-account?sessionId=${sessionId}`
    );
  } catch (err: any) {
    console.error("meta-instagram oauth callback error (stage:", stage, "):", err);
    res.redirect(
      `/integrations/instagram-publish/error?type=callback_error&stage=${stage}`
    );
  }
}
