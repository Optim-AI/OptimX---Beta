/**
 * GET /api/ads/meta/preflight — read-only Meta Ads create readiness (PR W2.1).
 * No Graph writes. Does not imply a Meta campaign exists.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { IntegrationDAO } from "@/database/models/Integration.dao";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";
import { buildMetaAdsCreatePreflight } from "@/lib/ads/meta/preflight";
import { sendMetaAdsDraftError } from "@/lib/ads/meta/draft-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "unauthenticated" });
    }

    const integration = await IntegrationDAO.findByUserAndProvider(
      userId,
      "meta"
    );
    const selected = integration
      ? await AdAccountDAO.findSelected(integration.id)
      : null;

    const preflight = buildMetaAdsCreatePreflight({
      userId,
      integration: integration
        ? {
            id: integration.id,
            healthStatus: integration.healthStatus ?? null,
            pageId: integration.pageId ?? null,
          }
        : null,
      selectedAccount: selected
        ? {
            id: selected.id,
            accountId: selected.accountId,
            name: selected.name ?? null,
            currency: selected.currency ?? null,
          }
        : null,
    });

    // Never return tokens
    return res.status(200).json(preflight);
  } catch (error) {
    return sendMetaAdsDraftError(res, error);
  }
}
