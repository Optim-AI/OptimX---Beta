// pages/api/creative-studio/poster/qc.ts
// Phase 7: Poster QC — 0 image credits, no regeneration

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  isPosterQcError,
  isPosterSessionError,
  runPosterQcForSession,
} from "@/lib/creative-studio/poster-generation";
import { readJsonBody, readStringField } from "@/lib/creative-studio/poster-generation/read-json-body";

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" },
  },
  maxDuration: 120,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const body = readJsonBody(req);
  const sessionId =
    readStringField(body, "sessionId") ||
    (typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : null);
  const generationId = readStringField(body, "generationId");

  if (!sessionId || !generationId) {
    return res.status(400).json({
      ok: false,
      error: "sessionId and generationId are required",
    });
  }

  try {
    const result = await runPosterQcForSession({
      sessionId,
      userId,
      generationId,
    });

    console.log("[posterQc] success", {
      userId,
      sessionId,
      generationId,
      status: result.qc.status,
      failureType: result.qc.failureType,
      creditsCharged: 0,
    });

    return res.status(200).json({
      ok: true,
      qc: result.qc,
      session: {
        id: result.session.id,
        status: result.session.status,
        version: result.session.version,
      },
      creditsCharged: 0,
    });
  } catch (err: unknown) {
    if (isPosterQcError(err) || isPosterSessionError(err)) {
      const status =
        err.code === "NOT_FOUND" ||
        err.code === "MISSING_ASSET" ||
        err.code === "MISSING_SPEC" ||
        err.code === "MISSING_STRATEGY" ||
        err.code === "MISSING_CONCEPT" ||
        err.code === "MISSING_DNA"
          ? 404
          : err.code === "VALIDATION" || err.code === "MALFORMED_MODEL_OUTPUT"
            ? 400
            : err.code === "PROVIDER"
              ? 502
              : 500;
      return res.status(status).json({
        ok: false,
        error: err.toPublicJSON(),
        creditsCharged: 0,
      });
    }
    console.error("[posterQc] error", err);
    return res.status(500).json({
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Internal server error",
        retryable: true,
      },
      creditsCharged: 0,
    });
  }
}
