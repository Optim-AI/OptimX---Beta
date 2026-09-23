// pages/api/creative-studio/poster/concepts.ts
// Phase 5: Creative Concept Engine — 0 image credits

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  isPosterConceptError,
  isPosterSessionError,
  runCreativeConceptsForSession,
  selectConceptForSession,
} from "@/lib/creative-studio/poster-generation";
import { readJsonBody, readStringField } from "@/lib/creative-studio/poster-generation/read-json-body";

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" },
  },
  maxDuration: 90,
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
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: "sessionId is required" });
  }

  const action =
    typeof body.action === "string" ? body.action : "generate";

  try {
    if (action === "select") {
      const conceptIds = body.conceptIds ?? body.conceptId;
      if (!conceptIds) {
        return res.status(400).json({
          ok: false,
          error: "conceptIds (or conceptId) is required for select",
        });
      }
      const session = await selectConceptForSession({
        sessionId,
        userId,
        conceptIds: conceptIds as string | string[],
      });
      return res.status(200).json({
        ok: true,
        action: "select",
        session: {
          id: session.id,
          status: session.status,
          version: session.version,
          selectedConceptIds: session.selectedConceptIds,
        },
        creditsCharged: 0,
      });
    }

    const forceRegenerate = body.forceRegenerate === true;
    const conceptCount =
      body.conceptCount != null ? Number(body.conceptCount) : undefined;

    const result = await runCreativeConceptsForSession({
      sessionId,
      userId,
      conceptCount,
      forceRegenerate,
    });

    console.log("[posterConcepts] success", {
      userId,
      sessionId,
      reused: result.reused,
      count: result.concepts.length,
      territories: result.concepts.map((c) => c.territory),
    });

    return res.status(200).json({
      ok: true,
      action: "generate",
      reused: result.reused,
      concepts: result.concepts,
      dnaByConceptId: result.dnaByConceptId,
      session: {
        id: result.session.id,
        status: result.session.status,
        version: result.session.version,
        selectedConceptIds: result.session.selectedConceptIds,
      },
      creditsCharged: 0,
    });
  } catch (err: unknown) {
    if (isPosterConceptError(err) || isPosterSessionError(err)) {
      const status =
        err.code === "NOT_FOUND" ||
        err.code === "MISSING_BRIEF" ||
        err.code === "MISSING_STRATEGY"
          ? 404
          : err.code === "VALIDATION" ||
              err.code === "MALFORMED_MODEL_OUTPUT" ||
              err.code === "INSUFFICIENT_DIVERSITY" ||
              err.code === "STALE_STRATEGY"
            ? 400
            : err.code === "CONFLICT"
              ? 409
              : 500;
      return res.status(status).json({
        ok: false,
        error: err.toPublicJSON(),
        creditsCharged: 0,
      });
    }
    console.error("[posterConcepts] error", err);
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
