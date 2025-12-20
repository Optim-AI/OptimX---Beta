// pages/api/instagram/posts/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireInstagramAccount } from "../../../../lib/meta/auth";
import { createInstagramMedia, publishInstagramMedia } from "../../../../lib/meta/instagram";

/**
 * Create Instagram post for authenticated user.
 * POST /api/instagram/posts/create
 * Body: { image_url: string, caption?: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const integration = await getMetaIntegration(req);
    await requireInstagramAccount(integration);

    const { image_url, caption } = req.body;

    if (!image_url) {
      return res.status(400).json({ error: "image_url is required" });
    }

    // Step 1: Create media container
    const createResult = await createInstagramMedia({
      igUserId: integration.igUserId!,
      imageUrl: image_url,
      caption,
      accessToken: integration.pageAccessToken,
    });

    // Step 2: Publish media
    const publishResult = await publishInstagramMedia({
      igUserId: integration.igUserId!,
      creationId: createResult.id,
      accessToken: integration.pageAccessToken,
    });

    return res.status(200).json({
      success: true,
      createResult,
      publishResult,
    });
  } catch (err: any) {
    console.error("instagram post create error:", err);
    return res.status(500).json({ error: err?.message || "Failed to create Instagram post" });
  }
}
