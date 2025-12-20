// pages/api/meta/oauth/start.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { encodeState } from "../../../../lib/authHelpers";

/**
 * Initiates Meta OAuth flow for Facebook + Instagram.
 * This replaces /api/auth/instagram/start
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const appId = process.env.FACEBOOK_APP_ID;
  const version = process.env.FACEBOOK_API_VERSION || "23.0";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/oauth/callback`;

  if (!appId) {
    return res.status(500).json({ error: "FACEBOOK_APP_ID not configured" });
  }

  if (!process.env.NEXT_PUBLIC_APP_URL) {
    return res.status(500).json({ error: "NEXT_PUBLIC_APP_URL not configured" });
  }

  // Extract Supabase session token from query params (passed from frontend)
  const supabaseToken = Array.isArray(req.query.sb)
    ? req.query.sb[0]
    : (req.query.sb as string | undefined);

  // Encode state with random string and optional Supabase token
  const statePayload: any = { r: Math.random().toString(36).slice(2, 9) };
  if (supabaseToken) statePayload.t = supabaseToken;

  const state = encodeState(statePayload);

  // Request comprehensive permissions for Facebook, Instagram, and Ads
  const scopes = [
    // Instagram permissions
    "instagram_basic",
    "instagram_content_publish",
    "instagram_manage_comments",
    // Facebook Page permissions
    "pages_show_list",
    "pages_read_engagement",
    "pages_read_user_content",
    "pages_manage_posts",
    // Ads permissions
    "ads_read",
    "ads_management",
    "leads_retrieval",
  ].join(",");

  const oauthUrl =
    `https://www.facebook.com/v${version}/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(oauthUrl);
}
