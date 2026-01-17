// lib/meta/auth.ts
import type { NextApiRequest } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import { readSavedIntegration } from '@/integrations/store';
import { shouldCheckHealth, checkIntegrationHealth } from './health';
import { ensureValidToken, TokenError as TokenErrorClass } from './token-refresh';

export type MetaIntegration = {
  userId: string;
  pageAccessToken: string;
  userAccessToken: string;
  pageId: string | null;
  igUserId: string | null;
  adAccountId: string | null;
  createdAt: string | null;
  savedRowId: string | null;
  tokenExpiresAt?: string | null;
  healthStatus?: string;
};

/**
 * Custom error for token issues that need user reconnection
 */
export class TokenError extends Error {
  constructor(
    public code: string,
    public userMessage: string
  ) {
    super(userMessage);
    this.name = 'TokenError';
  }
}

/**
 * Get authenticated user's Meta integration credentials.
 * Automatically checks health and refreshes token if needed.
 * Throws error if user is not authenticated or Meta is not connected.
 */
export async function getMetaIntegration(req: NextApiRequest): Promise<MetaIntegration> {
  const userId = await getUserIdFromRequest(req);

  if (!userId) {
    throw new Error("Unauthorized: No valid session");
  }

  let integration = await readSavedIntegration({ provider: "meta", userId });

  if (!integration) {
    throw new Error("Meta not connected: Please connect your Facebook/Instagram account");
  }

  if (!integration.pageAccessToken) {
    throw new Error("Invalid integration: Missing page access token");
  }

  // Check if integration is unhealthy (expired, revoked, invalid)
  const unhealthyStatuses = ['expired', 'revoked', 'invalid'];
  if (integration.healthStatus && unhealthyStatuses.includes(integration.healthStatus)) {
    throw new TokenError(
      integration.healthStatus,
      integration.healthErrorMessage || 'Your Facebook connection needs to be refreshed. Please reconnect.'
    );
  }

  // Check if health check is needed (> 6 hours or expires soon)
  if (shouldCheckHealth(integration)) {
    try {
      console.log('[getMetaIntegration] Running health check...');
      const healthResult = await checkIntegrationHealth(integration);

      if (!healthResult.healthy) {
        throw new TokenError(healthResult.status, healthResult.message);
      }
    } catch (error: any) {
      // If it's a token error, re-throw
      if (error instanceof TokenError || error instanceof TokenErrorClass) {
        throw new TokenError(error.code || 'error', error.message);
      }
      // Otherwise, log and continue (might be transient)
      console.warn('[getMetaIntegration] Health check failed, continuing:', error.message);
    }
  }

  // Check if token needs refresh (expires within 7 days)
  try {
    integration = await ensureValidToken(integration);
  } catch (error: any) {
    console.error('[getMetaIntegration] Token refresh failed:', error);
    // Don't block the request if refresh fails - token might still be valid
  }

  if (!integration) {
    throw new Error('Integration not found or token refresh failed');
  }

  return {
    userId,
    pageAccessToken: integration.pageAccessToken,
    userAccessToken: integration.userAccessToken || integration.pageAccessToken,
    pageId: integration.pageId,
    igUserId: integration.igUserId,
    adAccountId: integration.adAccountId,
    createdAt: integration.createdAt,
    savedRowId: integration.savedRowId,
    tokenExpiresAt: integration.tokenExpiresAt,
    healthStatus: integration.healthStatus,
  };
}

/**
 * Get authenticated user's Meta integration credentials (non-throwing version).
 * Returns null if user is not authenticated or Meta is not connected.
 */
export async function getMetaIntegrationOptional(req: NextApiRequest): Promise<MetaIntegration | null> {
  try {
    return await getMetaIntegration(req);
  } catch (err) {
    return null;
  }
}

/**
 * Verify user has Instagram Business account connected.
 */
export async function requireInstagramAccount(integration: MetaIntegration): Promise<void> {
  if (!integration.igUserId) {
    throw new Error("Instagram not connected: Please connect an Instagram Business account to your Facebook Page");
  }
}

/**
 * Verify user has Facebook Page connected.
 */
export async function requireFacebookPage(integration: MetaIntegration): Promise<void> {
  if (!integration.pageId) {
    throw new Error("Facebook Page not connected: Please connect a Facebook Page");
  }
}

/**
 * Verify user has Meta Ads account connected.
 */
export async function requireAdsAccount(integration: MetaIntegration): Promise<void> {
  if (!integration.adAccountId) {
    throw new Error("Ads account not connected: Please connect a Meta Ads account");
  }
}
