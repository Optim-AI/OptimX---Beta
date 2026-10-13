/**
 * POST /api/ads/meta/drafts/[id]/resolve-image
 *
 * Operator resolution for uncertain adimages uploads (PR W2.5.1).
 * Body: { imageHash, createAttemptId }
 * Server verifies hash on the selected ad account — never trusts client alone.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { resolveMetaAdsUncertainImageHash } from "@/lib/ads/meta/create-paused-resolve-image";
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

    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};

    for (const key of [
      "access_token",
      "accessToken",
      "userAccessToken",
      "adAccountId",
      "pageId",
      "userId",
    ]) {
      if (key in body) {
        throw new MetaAdsDraftApiError(
          "forbidden_field",
          `Client may not supply "${key}".`,
          400
        );
      }
    }

    const imageHash =
      typeof body.imageHash === "string" ? body.imageHash.trim() : "";
    const createAttemptId =
      typeof body.createAttemptId === "string"
        ? body.createAttemptId.trim()
        : "";

    const result = await resolveMetaAdsUncertainImageHash({
      authenticatedUserId: userId,
      draftId: id,
      imageHash,
      createAttemptId,
    });

    const http = result.ok
      ? 200
      : result.code === "not_found"
        ? 404
        : result.code === "unauthenticated" ||
            result.code === "not_entitled" ||
            result.code === "adimages_contract_unapproved" ||
            result.code === "graph_writes_disabled"
          ? 403
          : result.code === "attempt_conflict"
            ? 409
            : 400;

    return res.status(http).json({
      ok: result.ok,
      code: result.code,
      message: result.message,
      draft: result.draft ? serializeMetaAdsDraft(result.draft) : null,
    });
  } catch (e) {
    return sendMetaAdsDraftError(res, e);
  }
}
