// pages/api/auth/google-ads/profile.ts
import { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie";

const API_VERSION = "v21";

function getGoogleAdsConfig() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!clientId || !clientSecret || !developerToken) {
    throw new Error("Missing GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, or GOOGLE_ADS_DEVELOPER_TOKEN");
  }
  return { clientId, clientSecret, developerToken };
}

type RefreshResp = { access_token: string; expires_in?: number };

async function refreshAccessToken(refreshToken: string): Promise<RefreshResp> {
  const { clientId, clientSecret } = getGoogleAdsConfig();
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const txt = await resp.text();
  let obj: any;
  try { obj = JSON.parse(txt); } catch { throw new Error("Failed to parse refresh response: " + txt); }
  if (!obj.access_token) throw new Error("No access_token in refresh response: " + txt);
  return obj;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const raw = req.headers.cookie ?? "";
    console.log("profile raw cookie header:", raw);
    const cookies = raw ? cookie.parse(raw) : {};
    console.log("profile parsed cookies:", cookies);

    let accessToken: string | undefined = cookies.ga_access_token;
    const refreshToken: string | undefined = cookies.ga_refresh_token;

    if (!accessToken && refreshToken) {
      try {
        const nt = await refreshAccessToken(refreshToken);
        accessToken = nt.access_token;
        const cookieStr = cookie.serialize("ga_access_token", accessToken, {
          httpOnly: true,
          path: "/",
          maxAge: nt.expires_in ?? 3600,
          sameSite: "lax",
        });
        res.setHeader("Set-Cookie", [cookieStr]);
        console.log("profile: refreshed access token, set cookie");
      } catch (e: any) {
        console.error("profile: refresh failed:", e.message);
        return res.status(500).json({ error: "Token refresh failed: " + e.message });
      }
    }

    if (!accessToken) {
      console.error("profile: no access token present");
      return res.status(401).json({ error: "Not authenticated" });
    }

    // fetch profile
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await userRes.json();
    console.log("profile userinfo:", profile);

    // listAccessibleCustomers (may return manager account(s))
    const { developerToken } = getGoogleAdsConfig();
    const listRes = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
      },
    });
    let accessible_customers: any;
    try { accessible_customers = await listRes.json(); } catch (e) { accessible_customers = { error: "parse failed" }; }

    return res.status(200).json({ profile, accessible_customers });
  } catch (outer: any) {
    console.error("profile handler error:", outer);
    return res.status(500).json({ error: "Internal server error: " + (outer?.message || String(outer)) });
  }
}