// pages/api/auth/google-ads/start.ts
import { NextApiRequest, NextApiResponse } from "next";

const CLIENT_ID = "947565254141-5mispk8fus70rj42pp1srjof4774p9ve.apps.googleusercontent.com";

// Build origin from request; fall back to the hardcoded ngrok URL if not present
function computeOrigin(req: NextApiRequest) {
  // prefer explicit origin header (sent by browsers on some requests)
  const originHeader = (req.headers.origin as string | undefined) || "";
  if (originHeader) return originHeader;
  const host = req.headers.host || "";
  if (!host) return "https://67476f1a363d.ngrok-free.app";
  // choose protocol heuristically: localhost -> http, otherwise https
  const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = computeOrigin(req);
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
  console.log("[google-ads/start] redirecting to:", authUrl, "using redirect_uri:", redirectUri);
  res.redirect(authUrl);
}
