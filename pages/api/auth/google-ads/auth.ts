// pages/api/auth/google-ads/auth.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";
import { resolveRequestOrigin } from "@/lib/routing/safe-next";

const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(500).json({
      error: 'Missing Google Ads configuration. Please set GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET environment variables.'
    });
  }

  let origin: string;
  try {
    origin = resolveRequestOrigin(req);
  } catch (err: any) {
    return res.status(500).json({
      error: err?.message || "Application URL is not configured",
    });
  }

  const redirectUri = `${origin}/api/auth/google-ads/callback`;

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);
  const scopes = [
    "https://www.googleapis.com/auth/adwords",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  res.redirect(url);
}
