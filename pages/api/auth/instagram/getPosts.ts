// pages/api/auth/instagram/getPosts.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../../lib/integrationStore";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch { return text; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "missing_user", details: "No Supabase session token found in request." });
    }

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) {
      return res.status(400).json({ error: "no_integration", details: "No Instagram integration found for this user." });
    }

    const igUserId = saved.igUserId;
    const pageAccessToken = saved.pageAccessToken;

    if (!igUserId || !pageAccessToken) {
      return res.status(400).json({ error: "missing_tokens", details: "Missing igUserId or pageAccessToken for the resolved user integration." });
    }

    const fields = [
      "id",
      "caption",
      "media_type",
      "media_url",
      "permalink",
      "timestamp",
      "like_count",
      "comments_count"
    ].join(",");

    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageAccessToken)}&limit=50`;
    const gRes = await fetch(url);
    const text = await gRes.text();
    const body = safeJsonParse(text);

    if (!gRes.ok) return res.status(gRes.status).json({ ok: false, status: gRes.status, body });
    return res.status(200).json({ ok: true, status: gRes.status, body });
  } catch (err: any) {
    console.error("getPosts error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
