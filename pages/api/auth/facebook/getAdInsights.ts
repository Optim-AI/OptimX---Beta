// pages/api/auth/facebook/getAdInsights.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../../lib/integrationStore";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) return res.status(400).json({ error: "no_integration" });

    const userAccessToken = saved.userAccessToken ?? saved.longUserToken ?? saved.pageAccessToken;
    const adAccountId = saved.adAccountId;
    if (!userAccessToken || !adAccountId) return res.status(500).json({ error: "Missing userAccessToken or adAccountId" });

    const fields = ["impressions","reach","spend","actions","results","cost_per_result","objective","date_start","date_stop","attribution_spec"].join(",");
    const normalizedAdAccount = String(adAccountId).replace(/^act_/, "");
    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(normalizedAdAccount)}/insights?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(userAccessToken)}&date_preset=lifetime`;

    const gRes = await fetch(url);
    const body = await gRes.json();
    if (!gRes.ok) return res.status(gRes.status).json({ ok: false, status: gRes.status, body });
    return res.status(200).json({ ok: true, status: gRes.status, body });
  } catch (err: any) {
    console.error("facebook/getAdInsights error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
