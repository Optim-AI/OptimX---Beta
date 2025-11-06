// pages/api/auth/facebook/getPostComments.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../../lib/integrationStore";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";
function safeJsonParse(text: string) { try { return JSON.parse(text); } catch { return text; } }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const postId = String(req.query.postId || "");
    if (!postId) return res.status(400).json({ error: "Missing postId query param" });

    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) return res.status(400).json({ error: "no_integration" });

    const pageAccessToken = saved.pageAccessToken;
    if (!pageAccessToken) return res.status(400).json({ error: "missing_page_token" });

    const fields = ["id", "message", "from", "created_time"].join(",");
    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(postId)}/comments?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageAccessToken)}&limit=200`;

    const gRes = await fetch(url);
    const text = await gRes.text();
    const body = safeJsonParse(text);

    if (!gRes.ok) return res.status(gRes.status).json(body);
    return res.status(200).json(body);
  } catch (err: any) {
    console.error("facebook/getPostComments error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
