// pages/api/auth/google-ads/start.ts
import { NextApiRequest, NextApiResponse } from "next";
import { resolveRequestOrigin } from "@/lib/routing/safe-next";

const CLIENT_ID = "947565254141-5mispk8fus70rj42pp1srjof4774p9ve.apps.googleusercontent.com";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  let origin: string;
  try {
    origin = resolveRequestOrigin(req);
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Application URL is not configured",
    });
  }

  const redirectUri = `${origin}/api/auth/google-ads/callback`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/adwords openid email profile",
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(authUrl);
}
