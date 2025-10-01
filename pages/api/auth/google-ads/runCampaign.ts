// pages/api/google-ads/runCampaign.ts
import { NextApiRequest, NextApiResponse } from "next";
import * as cookie from "cookie";

const DEV_TOKEN = "5Oe5ETZKWYkNqoSYa-f_ww";
const MANAGER_ID = "2185924019"; // test manager id
const API_VERSION = "v21";

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in?: number }> {
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: "947565254141-5mispk8fus70rj42pp1srjof4774p9ve.apps.googleusercontent.com",
      client_secret: "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",
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
  console.log("runCampaign incoming method:", req.method);
  if (req.method !== "POST") return res.status(405).json({ error: "Only POST allowed" });

  try {
    const { childAccount, campaignName } = req.body as { childAccount?: string; campaignName?: string };
    if (!childAccount) return res.status(400).json({ error: "childAccount required" });

    // normalize to numeric id
    let targetId = childAccount;
    if (childAccount.startsWith("customers/")) targetId = childAccount.split("/")[1];

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

    const safeName = campaignName && campaignName.trim() ? campaignName : `API Campaign ${Date.now()}`;

    const payload = {
  mutateOperations: [
    {
      campaignBudgetOperation: {
        create: {
          resourceName: `customers/${targetId}/campaignBudgets/-1`,
          name: `APIBudget_${Math.random().toString(36).substring(2, 8)}`,
          deliveryMethod: "STANDARD",
          amountMicros: 5000000,
          explicitlyShared: false,
        },
      },
    },
    {
      campaignOperation: {
        create: {
          resourceName: `customers/${targetId}/campaigns/-2`,
          status: "PAUSED",
          advertisingChannelType: "SEARCH",
          name: safeName,
          campaignBudget: `customers/${targetId}/campaignBudgets/-1`,
          targetSpend: {},
          // <-- add this required field:
          contains_eu_political_advertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
        },
      },
    },
    {
      adGroupOperation: {
        create: {
          resourceName: `customers/${targetId}/adGroups/-3`,
          campaign: `customers/${targetId}/campaigns/-2`,
          name: `AG_${Math.random().toString(36).substring(2, 8)}`,
          status: "PAUSED",
          type: "SEARCH_STANDARD",
        },
      },
    },
    {
      adGroupAdOperation: {
        create: {
          adGroup: `customers/${targetId}/adGroups/-3`,
          status: "PAUSED",
          ad: {
            responsiveSearchAd: {
              headlines: [
                { pinnedField: "HEADLINE_1", text: "Buy now" },
                { text: "Best deals" },
                { text: "Limited time" },
              ],
              descriptions: [
                { text: "Great product" },
                { text: "Don’t miss out" },
              ],
              path1: "promo",
              path2: "sale",
            },
            finalUrls: ["https://www.example.com"],
          },
        },
      },
    },
  ],
};


    const endpoint = `https://googleads.googleapis.com/${API_VERSION}/customers/${targetId}/googleAds:mutate`;
    console.log("runCampaign calling endpoint:", endpoint);
    console.log("runCampaign headers with login-customer-id:", { Authorization: `Bearer ${accessToken}`, "developer-token": DEV_TOKEN, "login-customer-id": MANAGER_ID });

    const apiRes = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": DEV_TOKEN,
        "login-customer-id": MANAGER_ID,
        "Content-Type": "application/json",
      } as Record<string, string>,
      body: JSON.stringify(payload),
    });

    const text = await apiRes.text();
    console.log("runCampaign raw response text:", text);
    let json: any;
    try { json = JSON.parse(text); } catch { return res.status(apiRes.status).send(text); }
    if (!apiRes.ok) return res.status(apiRes.status).json({ error: json });

    return res.status(200).json({ success: true, data: json });
  } catch (err: any) {
    console.error("runCampaign error:", err);
    return res.status(500).json({ error: err.message });
  }
}
