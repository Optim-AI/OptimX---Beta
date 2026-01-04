// pages/api/auth/instagram/getPostComments.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import { readSavedIntegration } from '@/integrations/store';

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const postId = String(req.query.postId || "");
    if (!postId) return res.status(400).json({ error: "Missing postId" });

    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) return res.status(400).json({ error: "no_integration" });

    const pageAccessToken = saved.pageAccessToken;
    if (!pageAccessToken) return res.status(400).json({ error: "missing_page_token" });

    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(postId)}/comments?access_token=${encodeURIComponent(pageAccessToken)}&limit=200`;
    const gRes = await fetch(url);
    const text = await gRes.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    if (!gRes.ok) return res.status(gRes.status).json(json);
    return res.status(200).json(json);
  } catch (err: any) {
    console.error("instagram/getPostComments error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
