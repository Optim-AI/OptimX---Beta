// pages/api/auth/google-ads/callback.ts
import { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const SECURE_COOKIE = process.env.NODE_ENV === "production";

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  error?: string;
  error_description?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      console.error("Missing GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI env vars");
      return res.status(500).send("Server misconfiguration: missing OAuth environment variables.");
    }

    const { code, error } = req.query;
    console.log("google-ads callback query:", req.query);

    if (error) return res.status(400).send("OAuth error: " + String(error));
    if (!code || Array.isArray(code)) return res.status(400).send("Missing code");

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
      }),
    });

    const text = await tokenRes.text();
    let tokenJson: TokenResponse;
    try {
      tokenJson = JSON.parse(text);
    } catch (e) {
      console.error("token parse error:", text);
      return res.status(500).send("Failed to parse token response from Google.");
    }

    if (!tokenJson || !tokenJson.access_token) {
      console.error("No access_token in token response:", tokenJson);
      return res.status(500).send("No access token returned by Google.");
    }

    // cookie options (no explicit TS type to avoid cookie type mismatch)
    const accessMaxAge = tokenJson.expires_in ?? 3600; // seconds
    const commonOpts = {
      httpOnly: true,
      path: "/",
      sameSite: "lax" as const,
      secure: SECURE_COOKIE,
    };

    const cookiesToSet: string[] = [];

    cookiesToSet.push(
      cookie.serialize("ga_access_token", tokenJson.access_token as string, {
        ...commonOpts,
        maxAge: accessMaxAge,
      })
    );

    if (tokenJson.refresh_token) {
      // keep refresh token long-lived
      cookiesToSet.push(
        cookie.serialize("ga_refresh_token", tokenJson.refresh_token as string, {
          ...commonOpts,
          maxAge: 60 * 60 * 24 * 365, // 1 year
        })
      );
    }

    // store token issuance time so we can know when to refresh
    cookiesToSet.push(
      cookie.serialize("ga_token_time", String(Date.now()), {
        ...commonOpts,
        maxAge: 60 * 60 * 24 * 365,
      })
    );

    console.log("Setting cookies on callback:", cookiesToSet.map((c) => c.split(";")[0]));
    res.setHeader("Set-Cookie", cookiesToSet);
    // Redirect back to your integrations page (same as before)
    res.redirect("/integrationsGoogle");
  } catch (err: any) {
    console.error("callback handler error:", err);
    return res.status(500).send("Internal server error: " + (err?.message || String(err)));
  }
}
