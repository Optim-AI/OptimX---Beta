// pages/api/facebook/posts/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireFacebookPage } from "../../../../lib/meta/auth";
import { createFacebookPost } from "../../../../lib/meta/facebook";

/**
 * Create Facebook Page post for authenticated user.
 * POST /api/facebook/posts/create
 * Body: { message?: string, image_url?: string, link?: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const integration = await getMetaIntegration(req);
    await requireFacebookPage(integration);

    const { message, image_url, link } = req.body;

    if (!message && !image_url && !link) {
      return res.status(400).json({ error: "At least one of message, image_url, or link is required" });
    }

    const result = await createFacebookPost({
      pageId: integration.pageId!,
      message,
      imageUrl: image_url,
      link,
      accessToken: integration.pageAccessToken,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    console.error("facebook post create error:", err);
    return res.status(500).json({ error: err?.message || "Failed to create Facebook post" });
  }
}
