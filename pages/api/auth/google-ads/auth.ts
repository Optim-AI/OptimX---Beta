// pages/api/auth/google-ads/auth.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";

const CLIENT_ID = "947565254141-5mispk8fus70rj42pp1srjof4774p9ve.apps.googleusercontent.com";
const CLIENT_SECRET = "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";

function computeOrigin(req: NextApiRequest) {
  const originHeader = (req.headers.origin as string | undefined) || "";
  if (originHeader) return originHeader;
  const host = req.headers.host || "";
  if (!host) return "https://67476f1a363d.ngrok-free.app";
  const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = computeOrigin(req);
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

  console.log("[google-ads/auth] using redirectUri:", redirectUri);
  res.redirect(url);
}
