import type { NextApiRequest, NextApiResponse } from "next";
import { storeOAuthSession } from "@/integrations/meta/oauth-session";
import { resolveOAuthCallbackUserFromRequest } from "@/lib/auth/resolve-oauth-callback-user";
import { fetchMetaPagesForOAuth } from "@/lib/ads/providers/meta/oauth-assets";
import {
  getMetaPublishRedirectUri,
  META_PUBLISH_PROVIDER,
} from "@/lib/social/facebook-publish/scopes";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

/**
 * Meta OAuth callback for Page publishing (provider = meta-publish).
 * Does not touch Meta Ads tokens.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let stage = "start";
  try {
    if (req.query.error) {
      const errorReason =
        req.query.error_reason || req.query.error_description || "";
      res.redirect(
        `/integrations/facebook-publish/cancelled?reason=${encodeURIComponent(String(errorReason))}`
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
      expectedStateProvider: META_PUBLISH_PROVIDER,
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

    const redirectUri = getMetaPublishRedirectUri();

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
      console.error("[meta-publish] token_exchange_failed", {
        message: tokenJson.error?.message,
        code: tokenJson.error?.code,
      });
      res.status(500).json({
        error: "token_exchange_failed",
        details: tokenJson.error?.message ?? "see server logs",
      });
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
      res.status(500).json({ error: "no_user_token" });
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
      res.redirect(`/integrations/facebook-publish/error?type=pages_fetch_failed`);
      return;
    }

    if (!pagesResult.data.length) {
      const sessionId = await storeOAuthSession(
        resolvedUserId,
        {
          userAccessToken,
          pages: [],
          adAccounts: [],
          errorType: "NO_PAGES",
          tokenExpiresAt: tokenExpiresAt.toISOString(),
        },
        { provider: META_PUBLISH_PROVIDER, sessionPrefix: "oauth_meta_publish" }
      );
      res.redirect(
        `/integrations/facebook-publish/select-page?sessionId=${sessionId}&error=NO_PAGES`
      );
      return;
    }

    stage = "store_session";
    const sessionId = await storeOAuthSession(
      resolvedUserId,
      {
        userAccessToken,
        pages: pagesResult.data,
        adAccounts: [],
        tokenExpiresAt: tokenExpiresAt.toISOString(),
      },
      { provider: META_PUBLISH_PROVIDER, sessionPrefix: "oauth_meta_publish" }
    );

    res.redirect(
      `/integrations/facebook-publish/select-page?sessionId=${sessionId}`
    );
  } catch (err: any) {
    console.error("meta-publish oauth callback error (stage:", stage, "):", err);
    res.redirect(
      `/integrations/facebook-publish/error?type=callback_error&stage=${stage}`
    );
  }
}
