/**
 * GET   /api/ads/meta/drafts/[id] — read owned draft
 * PATCH /api/ads/meta/drafts/[id] — update editable draft content
 *
 * Cross-user: 404 (do not leak existence). PR W2.1 — no Meta Graph writes.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { MetaAdsDraftDAO } from "@/database/models/MetaAdsDraft.dao";
import { resolveTrustedMetaDraftBinding } from "@/lib/ads/meta/resolve-draft-binding";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";
import {
  assertBodySize,
  assertDraftEditable,
  assertMetaAdsCreateEntitled,
  assertNoForbiddenClientFields,
  pickDraftContentFields,
  sendMetaAdsDraftError,
  serializeMetaAdsDraft,
} from "@/lib/ads/meta/draft-api";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "64kb",
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
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

    if (req.method === "GET") {
      const draft = await MetaAdsDraftDAO.findByIdForUser(id, userId);
      if (!draft) {
        return res.status(404).json({ ok: false, error: "not_found" });
      }
      return res.status(200).json({
        ok: true,
        draft: serializeMetaAdsDraft(draft),
      });
    }

    if (req.method === "PATCH") {
      assertBodySize(req as any);
      const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      assertNoForbiddenClientFields(body);

      const existing = await MetaAdsDraftDAO.findByIdForUser(id, userId);
      if (!existing) {
        return res.status(404).json({ ok: false, error: "not_found" });
      }
      assertDraftEditable(existing.status);

      // Re-validate trusted selected binding still matches the draft row
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

      const fields = pickDraftContentFields(body);
      // Do not allow clients to change idempotency key after create
      const { idempotencyKey: _ignored, ...content } = fields;

      const updated = await MetaAdsDraftDAO.updateForUser(id, userId, {
        name: content.name,
        objective: content.objective,
        dailyBudgetMajor: content.dailyBudgetMajor,
        scheduleStart: content.scheduleStart,
        scheduleEnd: content.scheduleEnd,
        targeting: content.targeting,
        placements: content.placements,
        sourceImageId: content.sourceImageId,
        sourceImageUrl: content.sourceImageUrl,
        primaryText: content.primaryText,
        headline: content.headline,
        destinationUrl: content.destinationUrl,
        callToAction: content.callToAction,
        metadata: content.metadata,
      });

      if (!updated) {
        return res.status(404).json({ ok: false, error: "not_found" });
      }

      return res.status(200).json({
        ok: true,
        draft: serializeMetaAdsDraft(updated),
      });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return sendMetaAdsDraftError(res, error);
  }
}
