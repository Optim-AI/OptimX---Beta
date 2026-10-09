// pages/api/ads/google/oauth/start.ts
// Google Ads OAuth — separate from Supabase Google Sign-In
import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import { encodeState } from "@/auth/helpers";
import { resolveRequestOrigin } from "@/lib/routing/safe-next";
import { GOOGLE_ADS_SCOPES } from "@/lib/ads/providers/google/client";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error:
        "Missing GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET. This is independent of Google Sign-In.",
    });
  }

  const supabaseToken = Array.isArray(req.query.sb)
    ? req.query.sb[0]
    : (req.query.sb as string | undefined);

  if (!supabaseToken) {
    return res.status(401).json({
      error: "missing_auth",
      message: "Pass Supabase access token as ?sb= to bind Google Ads to your SkalX user.",
    });
  }

  let origin: string;
  try {
    origin = resolveRequestOrigin(req);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "App URL not configured" });
  }

  const redirectUri = `${origin}/api/ads/google/oauth/callback`;
  const state = encodeState({
    r: Math.random().toString(36).slice(2, 12),
    p: "google-ads",
    t: supabaseToken,
  });

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_ADS_SCOPES],
    state,
  });

  res.redirect(url);
}
