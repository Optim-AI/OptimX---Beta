// lib/meta/auth.ts
import type { NextApiRequest } from "next";
import { getUserIdFromRequest } from "../requestHelpers";
import { readSavedIntegration } from "../integrationStore";

export type MetaIntegration = {
  userId: string;
  pageAccessToken: string;
  userAccessToken: string;
  pageId: string | null;
  igUserId: string | null;
  adAccountId: string | null;
  createdAt: string | null;
  savedRowId: string | null;
};

/**
 * Get authenticated user's Meta integration credentials.
 * Throws error if user is not authenticated or Meta is not connected.
 */
export async function getMetaIntegration(req: NextApiRequest): Promise<MetaIntegration> {
  const userId = await getUserIdFromRequest(req);

  if (!userId) {
    throw new Error("Unauthorized: No valid session");
  }

  const integration = await readSavedIntegration({ provider: "meta", userId });

  if (!integration) {
    throw new Error("Meta not connected: Please connect your Facebook/Instagram account");
  }

  if (!integration.pageAccessToken) {
    throw new Error("Invalid integration: Missing page access token");
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
