// pages/api/auth/instagram/start.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { encodeState } from "../../../../lib/authHelpers";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const appId = process.env.FACEBOOK_APP_ID!;
  const version = process.env.FACEBOOK_API_VERSION || "23.0";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;

  const supabaseToken = Array.isArray(req.query.sb) ? req.query.sb[0] : (req.query.sb as string | undefined);

  const statePayload: any = { r: Math.random().toString(36).slice(2, 9) };
  if (supabaseToken) statePayload.t = supabaseToken;

  const state = encodeState(statePayload);

  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
    "pages_read_engagement",
    "pages_read_user_content",
    "pages_manage_posts",
    "instagram_manage_comments",
    "leads_retrieval",
  ].join(",");

  const oauth = `https://www.facebook.com/v${version}/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(oauth);
}
