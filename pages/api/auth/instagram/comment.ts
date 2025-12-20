// pages/api/auth/instagram/comment.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../../lib/integrationStore";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user" });

    const { mediaId, message } = req.body;
    if (!mediaId || !message) return res.status(400).json({ error: "mediaId and message required" });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) return res.status(400).json({ error: "no_integration" });

    const pageAccessToken = saved.pageAccessToken;
    if (!pageAccessToken) return res.status(400).json({ error: "missing_page_token" });

    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}/comments`;
    const params = new URLSearchParams({ message, access_token: pageAccessToken });

    const gRes = await fetch(url, { method: "POST", body: params });
    const json = await gRes.json();
    if (!gRes.ok) return res.status(gRes.status).json(json);
    return res.status(200).json(json);
  } catch (err: any) {
    console.error("instagram/comment error:", err);
    return res.status(500).json({ error: "comment_failed", details: String(err) });
  }
}
