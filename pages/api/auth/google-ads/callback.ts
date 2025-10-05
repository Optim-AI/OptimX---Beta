// pages/api/auth/google-ads/callback.ts
import { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie";

const CLIENT_ID = "947565254141-5mispk8fus70rj42pp1srjof4774p9ve.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const BASE_URL = "https://171e39cebd8e.ngrok-free.app";
const REDIRECT_PATH = "/api/auth/google-ads/callback";

type TokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, error } = req.query;
  console.log("callback query:", req.query);
  if (error) return res.status(400).send("OAuth error: " + String(error));
  if (!code || Array.isArray(code)) return res.status(400).send("Missing code");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: String(code),
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: `${BASE_URL}${REDIRECT_PATH}`,
      grant_type: "authorization_code",
    }),
  });
  const text = await tokenRes.text();
  let tokenJson: TokenResponse;
  try {
    tokenJson = JSON.parse(text);
  } catch (e) {
    console.error("token parse error:", text);
    return res.status(500).send("Failed to parse token response");
  }
  if (!tokenJson.access_token) {
    console.error("No access_token:", tokenJson);
    return res.status(500).send("No access token in response");
  }

  const cookiesToSet: string[] = [];
  const maxAge = tokenJson.expires_in ?? 3600;

  cookiesToSet.push(
    cookie.serialize("ga_access_token", tokenJson.access_token, {
      httpOnly: true,
      path: "/",
      maxAge,
      sameSite: "lax",
      // secure: true, // OK to enable when using HTTPS (ngrok). Keep false for local http.
    })
  );

  if (tokenJson.refresh_token) {
    cookiesToSet.push(
      cookie.serialize("ga_refresh_token", tokenJson.refresh_token, {
        httpOnly: true,
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      })
    );
  }

  cookiesToSet.push(
    cookie.serialize("ga_token_time", String(Date.now()), {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    })
  );

  console.log("callback setting cookies:", cookiesToSet);
  res.setHeader("Set-Cookie", cookiesToSet);
  res.redirect("/integrationsGoogle");
}
