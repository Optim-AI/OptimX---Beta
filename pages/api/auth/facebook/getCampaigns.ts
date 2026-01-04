// pages/api/auth/facebook/getCampaigns.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import { readSavedIntegration } from '@/integrations/store';

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

async function getTokenAndAdAccount(userId: string) {
  const saved = await readSavedIntegration({ provider: "meta", userId });
  if (!saved) return { error: "no_integration" };
  const userAccessToken = saved.userAccessToken ?? saved.longUserToken ?? saved.pageAccessToken ?? null;
  const adAccountId = saved.adAccountId ?? null;
  return { userAccessToken, adAccountId };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const { userAccessToken, adAccountId, error: e } = await getTokenAndAdAccount(userId) as any;
    if (e) return res.status(400).json({ error: e });
    if (!userAccessToken || !adAccountId) return res.status(400).json({ error: "Missing userAccessToken or adAccountId" });

    const fields = ["id","name","status","objective","daily_budget","lifetime_budget","start_time","stop_time"].join(",");
    const normalizedAdAccount = String(adAccountId).replace(/^act_/, "");
    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(normalizedAdAccount)}/campaigns?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(userAccessToken)}`;

    const gRes = await fetch(url);
    const body = await gRes.json();
    if (!gRes.ok) return res.status(gRes.status).json({ ok: false, status: gRes.status, body });
    return res.status(200).json({ ok: true, status: gRes.status, body });
  } catch (err: any) {
    console.error("facebook/getCampaigns error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
