import type { NextApiRequest } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { readSavedIntegration } from "@/integrations/store";
import { META_INSTAGRAM_PROVIDER } from "@/lib/social/instagram/scopes";

export type MetaInstagramIntegration = {
  userId: string;
  integrationId: string;
  pageAccessToken: string;
  userAccessToken: string | null;
  pageId: string | null;
  pageName: string | null;
  igUserId: string;
  igUsername: string | null;
  tokenExpiresAt?: string | null;
  healthStatus?: string | null;
  scopes?: string[] | null;
};

/**
 * Load Instagram organic integration (provider = meta-instagram).
 * Does not touch Meta Ads or Facebook Page publishing rows.
 */
export async function getMetaInstagramIntegration(
  req: NextApiRequest
): Promise<MetaInstagramIntegration> {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    throw new Error("Unauthorized: No valid session");
  }

  const integration = await readSavedIntegration({
    provider: META_INSTAGRAM_PROVIDER,
    userId,
  });

  if (!integration) {
    throw new Error(
      "Instagram is not connected. Connect an Instagram professional account first."
    );
  }

  const igUserId =
    integration.igUserId ||
    (integration.metadata as any)?.igUserId ||
    null;

  if (!integration.pageAccessToken || !igUserId) {
    throw new Error(
      "Instagram connection is incomplete. Reconnect Instagram publishing."
    );
  }

  const unhealthy = ["expired", "revoked", "invalid"];
  if (
    integration.healthStatus &&
    unhealthy.includes(integration.healthStatus)
  ) {
    throw new Error(
      integration.healthErrorMessage ||
        "Your Instagram connection needs to be refreshed."
    );
  }

  const meta = (integration as any).metadata as Record<string, unknown> | null;

  return {
    userId,
    integrationId: String(integration.savedRowId || ""),
    pageAccessToken: integration.pageAccessToken,
    userAccessToken: integration.userAccessToken || null,
    pageId: integration.pageId,
    pageName: integration.pageName || null,
    igUserId: String(igUserId),
    igUsername:
      (typeof meta?.igUsername === "string" && meta.igUsername) ||
      null,
    tokenExpiresAt: integration.tokenExpiresAt,
    healthStatus: integration.healthStatus,
    scopes: integration.scopes || null,
  };
}

export async function getMetaInstagramIntegrationOptional(
  req: NextApiRequest
): Promise<MetaInstagramIntegration | null> {
  try {
    return await getMetaInstagramIntegration(req);
  } catch {
    return null;
  }
}
