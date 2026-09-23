// pages/api/creative-studio/poster/session/index.ts
// Phase 2: create / lookup PosterGenerationSession (0 image credits)

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  createPosterGenerationSessionService,
  isPosterSessionError,
} from "@/lib/creative-studio/poster-generation";
import { assertCreativeBriefShape } from "@/lib/creative-studio/poster-generation/guards";
import { sanitizeSessionForClient } from "@/lib/creative-studio/poster-generation/production-safety";

export const config = {
  api: {
    bodyParser: { sizeLimit: "25mb" },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const service = createPosterGenerationSessionService();

  try {
    if (req.method === "GET") {
      const studioSessionId =
        typeof req.query.studioSessionId === "string"
          ? req.query.studioSessionId
          : null;

      if (!studioSessionId) {
        return res.status(400).json({
          ok: false,
          error: "Provide studioSessionId to look up a poster generation session",
        });
      }

      const result = await service.getOrDescribeLegacy(studioSessionId, userId);
      if (result.kind === "legacy") {
        return res.status(200).json({
          ok: true,
          kind: "legacy",
          studioSessionId: result.studioSessionId,
          session: null,
        });
      }
      return res.status(200).json({
        ok: true,
        kind: "structured",
        session: sanitizeSessionForClient(result.session),
      });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const brief =
        body.brief != null && assertCreativeBriefShape(body.brief)
          ? body.brief
          : body.brief != null
            ? null
            : undefined;

      if (body.brief != null && brief === null) {
        return res.status(400).json({
          ok: false,
          error: "Initial brief failed validation",
        });
      }

      const session = await service.createSession({
        userId,
        studioSessionId: body.studioSessionId || null,
        brandId: body.brandId || null,
        productId: body.productId || null,
        brief: brief ?? null,
      });

      return res.status(200).json({
        ok: true,
        session: sanitizeSessionForClient(session),
      });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err: unknown) {
    if (isPosterSessionError(err)) {
      const status =
        err.code === "NOT_FOUND"
          ? 404
          : err.code === "FORBIDDEN"
            ? 403
            : err.code === "CONFLICT"
              ? 409
              : err.code === "VALIDATION" || err.code === "MALFORMED_PERSISTED_DATA"
                ? 400
                : 500;
      return res.status(status).json({ ok: false, error: err.toPublicJSON() });
    }
    console.error("[posterGenerationSession] api.error", err);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL", message: "Internal server error", retryable: true },
    });
  }
}
