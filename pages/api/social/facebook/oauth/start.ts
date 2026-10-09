import type { NextApiRequest, NextApiResponse } from "next";
import { encodeState } from "@/auth/helpers";
import { buildMetaPublishOAuthDialogUrl } from "@/lib/social/facebook-publish/scopes";

/**
 * GET /api/social/facebook/oauth/start?sb={supabaseAccessToken}
 * Starts Facebook Page publishing OAuth (separate from Meta Ads).
 * Uses FACEBOOK_PUBLISH_LOGIN_CONFIG_ID when set (FLB); never Ads config_id.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  const publishConfigId = process.env.FACEBOOK_PUBLISH_LOGIN_CONFIG_ID || null;
  // Never log the configuration ID itself.
  if (process.env.NODE_ENV !== "production") {
    if (!publishConfigId) {
      console.warn(
        "[meta-publish] FACEBOOK_PUBLISH_LOGIN_CONFIG_ID is unset. " +
          "FLB apps often reject pages_manage_posts via classic scope=. " +
          "Create a Login Configuration with pages_show_list + pages_read_engagement + pages_manage_posts."
      );
    } else {
      console.info("[meta-publish] oauth start using Login config_id", {
        configIdPresent: true,
        configIdLength: publishConfigId.length,
      });
    }
  }

  const supabaseToken = Array.isArray(req.query.sb)
    ? req.query.sb[0]
    : (req.query.sb as string | undefined);

  const statePayload: Record<string, string> = {
    r: Math.random().toString(36).slice(2, 12),
    p: "meta-publish",
  };
  if (supabaseToken) statePayload.t = supabaseToken;

  const state = encodeState(statePayload);

  try {
    const oauthUrl = buildMetaPublishOAuthDialogUrl({
      appId,
      state,
      version,
    });
    res.redirect(oauthUrl);
  } catch (e: any) {
    res.status(500).json({
      error: e?.message || "Failed to build Meta publish OAuth URL",
    });
  }
}
