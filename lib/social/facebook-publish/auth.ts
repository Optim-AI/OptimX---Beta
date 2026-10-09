import type { NextApiRequest } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { readSavedIntegration } from "@/integrations/store";
import { META_PUBLISH_PROVIDER } from "@/lib/social/facebook-publish/scopes";

export type MetaPublishIntegration = {
  userId: string;
  integrationId: string;
  pageAccessToken: string;
  userAccessToken: string | null;
  pageId: string | null;
  pageName: string | null;
  tokenExpiresAt?: string | null;
  healthStatus?: string | null;
  scopes?: string[] | null;
};

/**
 * Load the user's Facebook Page publishing integration (provider = meta-publish).
 * Separate from Meta Ads (provider = meta).
 */
export async function getMetaPublishIntegration(
  req: NextApiRequest
): Promise<MetaPublishIntegration> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    throw new Error("Unauthorized: No valid session");
  }

  const integration = await readSavedIntegration({
    provider: META_PUBLISH_PROVIDER,
    userId,
  });

  if (!integration) {
    throw new Error(
      "Facebook Page publishing is not connected. Authorize publishing first."
    );
  }

  if (!integration.pageAccessToken || !integration.pageId) {
    throw new Error(
      "Publishing connection is incomplete. Reconnect Facebook Page publishing."
    );
  }

  const unhealthy = ["expired", "revoked", "invalid"];
  if (
    integration.healthStatus &&
    unhealthy.includes(integration.healthStatus)
  ) {
    throw new Error(
      integration.healthErrorMessage ||
        "Your Facebook publishing connection needs to be refreshed."
    );
  }

  return {
    userId,
    integrationId: String(integration.savedRowId || ""),
    pageAccessToken: integration.pageAccessToken,
    userAccessToken: integration.userAccessToken || null,
    pageId: integration.pageId,
    pageName: integration.pageName || null,
    tokenExpiresAt: integration.tokenExpiresAt,
    healthStatus: integration.healthStatus,
    scopes: integration.scopes || null,
  };
}

export async function getMetaPublishIntegrationOptional(
  req: NextApiRequest
): Promise<MetaPublishIntegration | null> {
  try {
    return await getMetaPublishIntegration(req);
  } catch {
    return null;
  }
}
