/**
 * POST /api/ads/meta/drafts/[id]/create-paused
 *
 * Staging-oriented create-paused boundary (PR W2.5).
 * Fail-closed: META_ADS_CREATE_ENABLED + allowlist +
 * META_ADS_ADIMAGES_CONTRACT_APPROVED + META_ADS_CREATE_PAUSED_GRAPH_WRITES.
 *
 * Never accepts tokens, account ids, Page ids, or Meta object ids from the body.
 * Does not activate campaigns. Does not expose access tokens.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { runMetaAdsCreatePaused } from "@/lib/ads/meta/create-paused";
import {
  assertBodySize,
  sendMetaAdsDraftError,
  serializeMetaAdsDraft,
  MetaAdsDraftApiError,
} from "@/lib/ads/meta/draft-api";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "16kb",
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "unauthenticated" });
    }

    assertBodySize(req as any);

    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }

    // Reject any client attempt to supply authoritative write inputs.
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const forbidden = [
      "access_token",
      "accessToken",
      "userAccessToken",
      "pageAccessToken",
      "appsecret_proof",
      "adAccountId",
      "ad_account_id",
      "pageId",
      "page_id",
      "metaCampaignId",
      "metaAdsetId",
      "metaCreativeId",
      "metaAdId",
      "currency",
      "userId",
    ];
    for (const key of forbidden) {
      if (key in body) {
        throw new MetaAdsDraftApiError(
          "forbidden_field",
          `Client may not supply "${key}" for create-paused.`,
          400
        );
      }
    }

    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: userId,
      draftId: id,
    });

    const http =
      result.code === "created_paused" || result.code === "already_created"
        ? 200
        : result.code === "not_found"
          ? 404
          : result.code === "not_allowed"
            ? 403
            : result.code === "conflict_creating"
              ? 409
              : result.code === "validation_failed"
                ? 400
                : 422;

    return res.status(http).json({
      ok: result.ok,
      code: result.code,
      message: result.message,
      createAttemptId: result.createAttemptId,
      draft: result.draft ? serializeMetaAdsDraft(result.draft) : null,
      // Explicit: never activate
      activated: false,
    });
  } catch (e) {
    return sendMetaAdsDraftError(res, e);
  }
}
