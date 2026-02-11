// pages/api/auth/google-ads/clientAccounts.ts
import { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie";

const API_VERSION = "v21";

function getGoogleAdsConfig() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const managerId = process.env.GOOGLE_ADS_MANAGER_ID;
  if (!clientId || !clientSecret || !developerToken || !managerId) {
    throw new Error("Missing GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN, or GOOGLE_ADS_MANAGER_ID");
  }
  return { clientId, clientSecret, developerToken, managerId };
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in?: number }> {
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
  if (!obj.access_token) throw new Error("No access_token in refresh response");
  return obj;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const raw = req.headers.cookie ?? "";
    const cookies = raw ? cookie.parse(raw) : {};
    let accessToken: string | undefined = cookies.ga_access_token;
    const refreshToken: string | undefined = cookies.ga_refresh_token;

    if (!accessToken && refreshToken) {
      const nt = await refreshAccessToken(refreshToken);
      accessToken = nt.access_token;
      res.setHeader("Set-Cookie", [
        cookie.serialize("ga_access_token", accessToken, { httpOnly: true, path: "/", maxAge: nt.expires_in ?? 3600, sameSite: "lax" }),
      ]);
    }
    if (!accessToken) return res.status(401).json({ error: "Not authenticated" });

    // GAQL query: get direct children of manager (level=1)
    const query = `
      SELECT
        customer_client.client_customer,
        customer_client.descriptive_name,
        customer_client.level,
        customer_client.manager
      FROM
        customer_client
      WHERE
        customer_client.level = 1
    `;
    const { developerToken, managerId } = getGoogleAdsConfig();
    const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${managerId}/googleAds:search`;

    console.log("clientAccounts: calling search on manager:", managerId);
    const apiRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "login-customer-id": managerId,
        "Content-Type": "application/json",
      } as Record<string, string>,
      body: JSON.stringify({ query }),
    });

    const text = await apiRes.text();
    console.log("clientAccounts raw response:", text);
    let json: any;
    try { json = JSON.parse(text); } catch { return res.status(apiRes.status).send(text); }
    if (!apiRes.ok) return res.status(apiRes.status).json({ error: json });

    const accounts = (json.results || []).map((r: any) => {
      const clientCustomer = r.customerClient?.clientCustomer || r.customer_client?.client_customer || r.customerClient?.client_customer;
      const name = r.customerClient?.descriptiveName || r.customer_client?.descriptive_name || "Unnamed";
      return { resourceName: clientCustomer, descriptiveName: name };
    });

    return res.status(200).json({ accounts });
  } catch (err: any) {
    console.error("clientAccounts error:", err);
    return res.status(500).json({ error: err.message });
  }
}