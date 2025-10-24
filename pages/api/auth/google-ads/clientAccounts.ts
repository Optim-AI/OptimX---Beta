// pages/api/google-ads/clientAccounts.ts
import { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie";

const DEV_TOKEN = process.env.GOOGLE_DEVELOPER_TOKEN!;
const API_VERSION = "v21";
const DEFAULT_MANAGER = process.env.DEFAULT_MANAGER_ID; // optional fallback
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in?: number }> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
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
    // parse cookies
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

    // allow manager selection via query
    let manager = String(req.query.manager || "").trim();
    if (!manager && DEFAULT_MANAGER) manager = DEFAULT_MANAGER;
    if (!manager) {
      // try to call listAccessibleCustomers as a fallback (so frontend can show managers)
      const listRes = await fetch(`https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": DEV_TOKEN,
          "Content-Type": "application/json",
        } as Record<string, string>,
      });
      const listJson = await listRes.json();
      // return accessible customers directly
      return res.status(200).json({ accessible_customers: listJson });
    }

    // Normalize manager -> should be numeric id if like 'customers/123'
    if (manager.startsWith("customers/")) manager = manager.split("/")[1];

    // If asked for campaigns for a particular customer: ?customer=customers/123 or ?customer=123
    const customerParam = req.query.customer ? String(req.query.customer) : null;
    if (customerParam) {
      let cust = customerParam;
      if (cust.startsWith("customers/")) cust = cust.split("/")[1];

      // GAQL for campaign-level metrics (last 7 days simple example)
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros
        FROM campaign
        ORDER BY campaign.id
      `;
      const endpoint = `https://googleads.googleapis.com/${API_VERSION}/customers/${cust}/googleAds:search`;
      const apiRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "developer-token": DEV_TOKEN,
          "login-customer-id": manager,
          "Content-Type": "application/json",
        } as Record<string, string>,
        body: JSON.stringify({ query }),
      });
      const text = await apiRes.text();
      let json: any;
      try { json = JSON.parse(text); } catch { return res.status(apiRes.status).send(text); }
      if (!apiRes.ok) return res.status(apiRes.status).json({ error: json });

      const rows = (json.results || []).map((r: any) => {
        const c = r.campaign || r.campaign_ || r.campaign;
        const metrics = r.metrics || {};
        return {
          id: c?.id || (r.campaign?.id ?? null),
          name: c?.name || r.campaign?.name || "Unnamed",
          status: c?.status || r.campaign?.status || null,
          impressions: metrics.impressions ?? 0,
          clicks: metrics.clicks ?? 0,
          cost_micros: metrics.cost_micros ?? 0,
        };
      });

      return res.status(200).json({ campaigns: rows });
    }

    // Else: return direct children (customer_client.level = 1) for the manager
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
    const url = `https://googleads.googleapis.com/${API_VERSION}/customers/${manager}/googleAds:search`;

    const apiRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": DEV_TOKEN,
        "login-customer-id": manager,
        "Content-Type": "application/json",
      } as Record<string, string>,
      body: JSON.stringify({ query }),
    });

    const text = await apiRes.text();
    let json: any;
    try { json = JSON.parse(text); } catch { return res.status(apiRes.status).send(text); }
    if (!apiRes.ok) return res.status(apiRes.status).json({ error: json });

    const accounts = (json.results || []).map((r: any) => {
      const clientCustomer = r.customerClient?.clientCustomer || r.customer_client?.client_customer || r.customerClient?.client_customer;
      const name = r.customerClient?.descriptiveName || r.customer_client?.descriptive_name || "Unnamed";
      // resourceName might be in form customers/123
      const resourceName = clientCustomer?.startsWith?.("customers/") ? clientCustomer : `customers/${clientCustomer}`;
      return { resourceName, descriptiveName: name };
    });

    return res.status(200).json({ accounts });
  } catch (err: any) {
    console.error("clientAccounts error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
