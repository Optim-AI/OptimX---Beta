// pages/api/auth/google-ads/runCampaign.ts
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
    const body = req.body as any;

    // required: childAccount can be a resourceName 'customers/123' or id '123'
    const childAccount = body.childAccount;
    if (!childAccount) return res.status(400).json({ error: "childAccount required" });

    let targetId = childAccount;
    if (childAccount.startsWith?.("customers/")) targetId = childAccount.split("/")[1];

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

    // Read user inputs with sensible defaults
    const safeName = (body.campaignName && String(body.campaignName).trim()) || `API Campaign ${Date.now()}`;
    const amountMicros = typeof body.budgetAmount === "number" && body.budgetAmount > 0 ? body.budgetAmount : 5_000_000;
    const finalUrls: string[] = Array.isArray(body.finalUrls) && body.finalUrls.length > 0 ? body.finalUrls : ["https://www.example.com"];
    const headlines: string[] = Array.isArray(body.headlines) && body.headlines.length > 0 ? body.headlines : ["Buy now", "Best deals", "Limited time"];
    const descriptions: string[] = Array.isArray(body.descriptions) && body.descriptions.length > 0 ? body.descriptions : ["Great product", "Don't miss out"];
    const containsEuPoliticalAdvertising = body.containsEuPoliticalAdvertising || "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING";

    const payload = {
      mutateOperations: [
        {
          campaignBudgetOperation: {
            create: {
              resourceName: `customers/${targetId}/campaignBudgets/-1`,
              name: `APIBudget_${Math.random().toString(36).substring(2, 8)}`,
              deliveryMethod: "STANDARD",
              amountMicros: amountMicros,
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
              contains_eu_political_advertising: containsEuPoliticalAdvertising,
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
                  headlines: headlines.map((t: string, idx: number) =>
                    idx === 0 ? { pinnedField: "HEADLINE_1", text: t } : { text: t }
                  ),
                  descriptions: descriptions.map((t: string) => ({ text: t })),
                },
                finalUrls,
              },
            },
          },
        },
      ],
    };

    const endpoint = `https://googleads.googleapis.com/${API_VERSION}/customers/${targetId}/googleAds:mutate`;
    console.log("runCampaign calling endpoint:", endpoint);

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