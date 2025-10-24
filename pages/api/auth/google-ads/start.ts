// pages/api/auth/google-ads/start.ts
import { NextApiRequest, NextApiResponse } from "next";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI!;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).send("Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI env vars.");
  }
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: "https://www.googleapis.com/auth/adwords openid email profile",
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(authUrl);
}
