/**
 * GET  /api/ads/meta/drafts — list owned local Meta Ads drafts
 * POST /api/ads/meta/drafts — create local draft (idempotent when key set)
 *
 * PR W2.1 — no Meta Graph writes.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { MetaAdsDraftDAO } from "@/database/models/MetaAdsDraft.dao";
import { resolveTrustedMetaDraftBinding } from "@/lib/ads/meta/resolve-draft-binding";
import {
  assertBodySize,
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

    if (req.method === "GET") {
      const limitRaw = Number(req.query.limit);
      const limit =
        Number.isFinite(limitRaw) && limitRaw > 0
          ? Math.min(Math.floor(limitRaw), 100)
          : 50;
      const rows = await MetaAdsDraftDAO.listByUser(userId, limit);
      return res.status(200).json({
        ok: true,
        drafts: rows.map(serializeMetaAdsDraft),
      });
    }

    if (req.method === "POST") {
      assertBodySize(req as any);
      const body =
        req.body && typeof req.body === "object" && !Array.isArray(req.body)
          ? (req.body as Record<string, unknown>)
          : {};
      assertNoForbiddenClientFields(body);

      const binding = await resolveTrustedMetaDraftBinding(userId);
      const fields = pickDraftContentFields(body);

      const { draft, created } = await MetaAdsDraftDAO.createIdempotent({
        userId,
        integrationId: binding.integration.id,
        adAccountId: binding.selectedAccount.id,
        name: fields.name,
        objective: fields.objective,
        dailyBudgetMajor: fields.dailyBudgetMajor,
        scheduleStart: fields.scheduleStart,
        scheduleEnd: fields.scheduleEnd,
        targeting: fields.targeting,
        placements: fields.placements,
        sourceImageId: fields.sourceImageId,
        sourceImageUrl: fields.sourceImageUrl,
        primaryText: fields.primaryText,
        headline: fields.headline,
        destinationUrl: fields.destinationUrl,
        callToAction: fields.callToAction,
        idempotencyKey: fields.idempotencyKey,
        metadata: fields.metadata,
      });

      return res.status(created ? 201 : 200).json({
        ok: true,
        created,
        draft: serializeMetaAdsDraft(draft),
        // Explicit: local persistence only
        onMeta: false,
      });
    }

    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    return sendMetaAdsDraftError(res, error);
  }
}
