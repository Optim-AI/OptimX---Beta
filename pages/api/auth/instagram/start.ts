// pages/api/auth/instagram/login.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const appId = process.env.FACEBOOK_APP_ID!;
  const version = process.env.FACEBOOK_API_VERSION || "23.0";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;

  const scopes = [
    "instagram_basic",
    "instagram_content_publish",
    "pages_show_list",
  ].join(",");

  const oauth = `https://www.facebook.com/v${version}/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=code`;

  // Redirect the browser to Facebook login
  res.redirect(oauth);
}
