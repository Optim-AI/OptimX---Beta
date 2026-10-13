import type { NextApiRequest, NextApiResponse } from "next";
import { encodeState } from "@/auth/helpers";
import { buildMetaInstagramOAuthDialogUrl } from "@/lib/social/instagram/scopes";

/**
 * GET /api/social/instagram/oauth/start?sb={supabaseAccessToken}
 * Starts Instagram professional account OAuth (separate from Ads + FB publish).
 *
 * Requires FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID for Facebook Login for Business.
 * Classic scope= is not used by default — it causes Invalid Scopes on FLB apps.
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

  const appId = process.env.FACEBOOK_APP_ID;
  const version = process.env.FACEBOOK_API_VERSION || "23.0";

  if (!appId) {
    res.status(500).json({ error: "FACEBOOK_APP_ID not configured" });
    return;
  }
  if (!process.env.NEXT_PUBLIC_APP_URL) {
    res.status(500).json({ error: "NEXT_PUBLIC_APP_URL not configured" });
    return;
  }

  const igConfigId = process.env.FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID || null;
  if (!igConfigId) {
    console.warn(
      "[meta-instagram] FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID is unset. " +
        "Refusing classic scope= to avoid Meta Invalid Scopes on FLB apps."
    );
    res.status(400).json({
      error: "missing_instagram_login_config",
      message:
        "FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID is not set. " +
        "Create a Facebook Login for Business configuration (SkalX Instagram) that includes " +
        "instagram_basic, instagram_content_publish, pages_show_list, and pages_read_engagement " +
        "(plus instagram_manage_comments / instagram_manage_insights for comments and insights). " +
        "Add the Configuration ID to .env.local, restart Next.js, then reconnect. " +
        "Do not reuse the Ads or Facebook Publish configuration IDs.",
      code: "missing_instagram_login_config",
      loginFlow: "facebook_login_for_business",
      authorizationHost: "www.facebook.com",
      requiresConfigId: true,
    });
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[meta-instagram] oauth start using Login config_id", {
      configIdPresent: true,
      configIdLength: igConfigId.length,
      authorizationHost: "www.facebook.com",
      mode: "config_id",
    });
  }

  const supabaseToken = Array.isArray(req.query.sb)
    ? req.query.sb[0]
    : (req.query.sb as string | undefined);

  const statePayload: Record<string, string> = {
    r: Math.random().toString(36).slice(2, 12),
    p: "meta-instagram",
  };
  if (supabaseToken) statePayload.t = supabaseToken;

  const state = encodeState(statePayload);

  try {
    const built = buildMetaInstagramOAuthDialogUrl({
      appId,
      state,
      version,
    });
    if (process.env.NODE_ENV !== "production") {
      console.info("[meta-instagram] oauth dialog", {
        mode: built.mode,
        host: built.host,
        hasScopeParam: built.hasScopeParam,
        hasConfigIdParam: built.hasConfigIdParam,
        // Never log config_id, state, or tokens
      });
    }
    res.redirect(built.url);
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || "Failed to build Instagram OAuth URL",
      code: "oauth_url_build_failed",
    });
  }
}
