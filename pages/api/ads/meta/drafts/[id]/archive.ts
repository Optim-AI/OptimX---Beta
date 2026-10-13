/**
 * POST /api/ads/meta/drafts/[id]/archive — archive via documented transitions.
 * PR W2.1 — no Meta Graph writes. Cross-user → 404.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { MetaAdsDraftDAO } from "@/database/models/MetaAdsDraft.dao";
import { resolveTrustedMetaDraftBinding } from "@/lib/ads/meta/resolve-draft-binding";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";
import {
  assertMetaAdsCreateEntitled,
  sendMetaAdsDraftError,
  serializeMetaAdsDraft,
} from "@/lib/ads/meta/draft-api";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "unauthenticated" });
    }

    assertMetaAdsCreateEntitled(userId);

    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }

    const existing = await MetaAdsDraftDAO.findByIdForUser(id, userId);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const binding = await resolveTrustedMetaDraftBinding(userId);
    if (
      binding.integration.id !== existing.integrationId ||
      binding.selectedAccount.id !== existing.adAccountId
    ) {
      throw new MetaAdsDraftValidationError(
        "integration_account_mismatch",
        "Draft account binding no longer matches the selected Meta Ads account."
      );
    }

    const archived = await MetaAdsDraftDAO.archiveForUser(id, userId);
    if (!archived) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    return res.status(200).json({
      ok: true,
      draft: serializeMetaAdsDraft(archived),
    });
  } catch (error) {
    return sendMetaAdsDraftError(res, error);
  }
}
