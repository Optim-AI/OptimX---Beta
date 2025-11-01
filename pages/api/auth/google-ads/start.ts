// pages/api/auth/google-ads/start.ts
import { NextApiRequest, NextApiResponse } from "next";

// Hardcoded per your request
const CLIENT_ID = "947565254141-5mispk8fus70rj42pp1srjof4774p9ve.apps.googleusercontent.com";
const BASE_URL = "https://67476f1a363d.ngrok-free.app";
const REDIRECT_PATH = "/api/auth/google-ads/callback";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const redirectUri = `${BASE_URL}${REDIRECT_PATH}`;
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline", // to get refresh token
    prompt: "consent", // force refresh token for repeated tests
    scope: "https://www.googleapis.com/auth/adwords openid email profile",
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  console.log("Starting OAuth, redirecting to:", authUrl);
  res.redirect(authUrl);
}