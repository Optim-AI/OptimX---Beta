// pages/api/meta/oauth/start.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { encodeState } from "@/auth/helpers";
import { buildMetaAdsOAuthDialogUrl } from "@/lib/ads/providers/meta/client";

/**
 * Initiates Meta OAuth for the existing "SkalX Ads" Facebook Login for Business
 * configuration (explicit scopes, or optional FACEBOOK_LOGIN_CONFIG_ID).
 * Preserves existing Supabase auth — does not use Instagram publishing scopes.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const appId = process.env.FACEBOOK_APP_ID;
  const version = process.env.FACEBOOK_API_VERSION || "23.0";

  if (!appId) {
    return res.status(500).json({ error: "FACEBOOK_APP_ID not configured" });
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return res.status(500).json({ error: "NEXT_PUBLIC_APP_URL not configured" });
  }

  const supabaseToken = Array.isArray(req.query.sb)
    ? req.query.sb[0]
    : (req.query.sb as string | undefined);

  const statePayload: Record<string, string> = {
    r: Math.random().toString(36).slice(2, 12),
    p: "meta",
  };
  if (supabaseToken) statePayload.t = supabaseToken;

  const state = encodeState(statePayload);

  try {
    const oauthUrl = buildMetaAdsOAuthDialogUrl({
      appId,
      state,
      version,
    });
    res.redirect(oauthUrl);
  } catch (e: any) {
    return res.status(500).json({
      error: e?.message || "Failed to build Meta OAuth URL",
    });
  }
}
