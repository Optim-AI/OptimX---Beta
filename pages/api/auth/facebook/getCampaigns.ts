// pages/api/auth/facebook/getCampaigns.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data/instagram.json");
const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

async function readSaved() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const saved = await readSaved();
    const userAccessToken = saved?.userAccessToken;
    const adAccountId = saved?.adAccountId; // numeric ID without "act_"

    if (!userAccessToken || !adAccountId) {
      return res.status(500).json({ error: "Missing userAccessToken or adAccountId" });
    }

    const fields = [
      "id",
      "name",
      "status",
      "objective",
      "daily_budget",
      "lifetime_budget",
      "start_time",
      "stop_time"
    ].join(",");

    const url = `https://graph.facebook.com/v${VERSION}/${adAccountId}/campaigns?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(userAccessToken)}`;

    const gRes = await fetch(url);
    const body = await gRes.json();

    if (!gRes.ok) return res.status(gRes.status).json({ ok: false, status: gRes.status, body });
    return res.status(200).json({ ok: true, status: gRes.status, body });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("facebook/getCampaigns error:", err);
    return res.status(500).json({ error: message });
  }
}
