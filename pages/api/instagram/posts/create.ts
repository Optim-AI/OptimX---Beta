// pages/api/instagram/posts/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireInstagramAccount, TokenError } from '@/integrations/meta/auth';
import { createInstagramMedia, publishInstagramMedia } from '@/integrations/meta/instagram';
import { detectTokenError } from '@/integrations/meta/token-refresh';
import { updateIntegrationHealthInBackground, tokenErrorCodeToHealthStatus } from '@/integrations/meta/health';
import { getUserIdFromRequest } from '@/auth/request';

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
    // Auto-checks health & refreshes token if needed
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
    // Handle token errors from getMetaIntegration
    if (err instanceof TokenError) {
      const userId = await getUserIdFromRequest(req);

      // Update health in background (non-blocking)
      if (userId) {
        const healthStatus = tokenErrorCodeToHealthStatus(err.code);
        if (healthStatus) {
          updateIntegrationHealthInBackground(
            userId,
            'meta',
            healthStatus,
            err.userMessage
          );
        }
      }

      return res.status(401).json({
        error: 'token_error',
        code: err.code,
        message: err.userMessage,
        needsReconnect: true,
      });
    }

    // Check if this is a Facebook API error
    const tokenError = detectTokenError(err);
    if (tokenError.code !== 'error') {
      const userId = await getUserIdFromRequest(req);

      // Update health in background (non-blocking)
      if (userId) {
        const healthStatus = tokenErrorCodeToHealthStatus(tokenError.code);
        if (healthStatus) {
          updateIntegrationHealthInBackground(
            userId,
            'meta',
            healthStatus,
            tokenError.message
          );
        }
      }

      return res.status(401).json({
        error: 'token_error',
        code: tokenError.code,
        message: tokenError.message,
        needsReconnect: true,
      });
    }

    // Handle other errors
    console.error("instagram post create error:", err);
    return res.status(500).json({
      error: err?.message || "Failed to create Instagram post"
    });
  }
}
