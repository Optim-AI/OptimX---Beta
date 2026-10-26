// pages/api/auth/facebook/getPosts.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import { readSavedIntegration } from '@/integrations/store';

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
    const pageId = saved?.pageId;
    const pageAccessToken = saved?.pageAccessToken;

    if (!pageId || !pageAccessToken) {
      return res.status(400).json({ error: "no_integration", details: "No Facebook Page connected for this user." });
    }

    const fields = [
      "id",
      "message",
      "created_time",
      "permalink_url",
      "full_picture",
      "comments.summary(true)",
      "reactions.summary(true)",
    ].join(",");

    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}/posts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageAccessToken)}&limit=50`;

    const gRes = await fetch(url);
    const text = await gRes.text();
    const body = safeJsonParse(text);

    if (!gRes.ok) return res.status(gRes.status).json({ ok: false, status: gRes.status, body });
    return res.status(200).json({ ok: true, status: gRes.status, body });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("facebook/getPosts error:", err);
    return res.status(500).json({ error: message });
  }
}
