// pages/api/facebook/posts/create.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getMetaIntegration, requireFacebookPage, TokenError } from '@/integrations/meta/auth';
import { createFacebookPost } from '@/integrations/meta/facebook';
import { detectTokenError } from '@/integrations/meta/token-refresh';
import { updateIntegrationHealthInBackground, tokenErrorCodeToHealthStatus } from '@/integrations/meta/health';
import { getUserIdFromRequest } from '@/auth/request';

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
    // Auto-checks health & refreshes token if needed
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
    console.error("facebook post create error:", err);
    return res.status(500).json({
      error: err?.message || "Failed to create Facebook post"
    });
  }
}
