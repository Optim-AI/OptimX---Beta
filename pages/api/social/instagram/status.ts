import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";

/**
 * GET /api/social/instagram/status
 *
 * Honest status for Instagram organic publishing.
 * The legacy /api/auth/instagram/* routes exist but are not wired to a
 * verified meta-publish-style connection for Social Studio. Do not mark
 * Instagram as publish-ready until a dedicated IG flow is completed.
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

    res.status(200).json({
      connected: false,
      canPublish: false,
      available: false,
      reason:
        "Instagram publishing is not enabled in Social Studio yet. Facebook Page photo publishing is available.",
      requiredWork: [
        "Dedicated Instagram professional account OAuth with instagram_content_publish",
        "Linked IG account discovery from the Facebook Page",
        "Media container create → status poll → media_publish",
        "App Review / Advanced Access for Live users",
      ],
    });
  } catch (err: any) {
    res.status(500).json({
      error: err?.message || "Failed to load Instagram status",
    });
  }
}
