// pages/api/auth/google-ads/auth.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { google } from "googleapis";

const CLIENT_ID = "947565254141-5mispk8fus70rj42pp1srjof4774p9ve.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const REDIRECT_URI = "https://171e39cebd8e.ngrok-free.app/api/auth/google-ads/callback";

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const scopes = [
    "https://www.googleapis.com/auth/adwords",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email"
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
  });

  res.redirect(url);
}
