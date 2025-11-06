// pages/api/auth/instagram/getMedia.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../../lib/integrationStore";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "missing_user", details: "No Supabase session token" });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    if (!saved) return res.status(400).json({ error: "no_integration" });

    const igUserId = saved.igUserId;
    const pageAccessToken = saved.pageAccessToken;
    if (!igUserId || !pageAccessToken) return res.status(400).json({ error: "missing_tokens" });

    const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media?fields=id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count&access_token=${encodeURIComponent(pageAccessToken)}`;

    const response = await fetch(url);
    const data = await response.json();
    if (data.error) return res.status(400).json(data);

    res.status(200).json({ success: true, data: data.data });
  } catch (err: any) {
    console.error("getMedia error:", err);
    res.status(500).json({ error: "fetch_failed", details: String(err) });
  }
}
