import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { getMetaInstagramIntegration } from "@/lib/social/instagram/auth";
import { loadInstagramMediaEngagement } from "@/lib/social/instagram/insights";

/**
 * GET /api/social/instagram/media/[id]/insights
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const mediaId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!mediaId) {
      res.status(400).json({ error: "media id required" });
      return;
    }

    const integration = await getMetaInstagramIntegration(req);
    const engagement = await loadInstagramMediaEngagement({
      mediaId,
      accessToken: integration.pageAccessToken,
    });

    res.status(200).json({
      success: true,
      engagement,
    });
  } catch (err: any) {
    const msg = err?.message || "Failed to load Instagram insights";
    const status = /permission|OAuth|#10|#200/i.test(msg)
      ? 403
      : /Unauthorized|not connected|incomplete/i.test(msg)
        ? 401
        : 500;
    res.status(status).json({ error: msg });
  }
}
