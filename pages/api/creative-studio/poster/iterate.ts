// pages/api/creative-studio/poster/iterate.ts
// Phase 8: Controlled iteration — classify/plan (0 credits) or execute (1 credit on success)

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  executePosterIterationForSession,
  isPosterIterationError,
  isPosterSessionError,
  isPosterGenerationError,
  isPosterQcError,
  planPosterIterationForSession,
} from "@/lib/creative-studio/poster-generation";
import { readJsonBody, readStringField } from "@/lib/creative-studio/poster-generation/read-json-body";

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" },
  },
  maxDuration: 300,
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

  // Reject browser-supplied authoritative creative artifacts
  if (
    body.strategy != null ||
    body.specification != null ||
    body.concept != null ||
    body.dna != null
  ) {
    return res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION",
        message:
          "Do not submit strategy, specification, concept, or DNA from the browser. Server loads them from the session.",
      },
      creditsCharged: 0,
    });
  }

  const action =
    typeof body.action === "string" ? body.action : "execute";
  const generationId = readStringField(body, "generationId");
  const iterationId = readStringField(body, "iterationId");
  const requestText =
    typeof body.request === "string"
      ? body.request
      : typeof body.userRequest === "string"
        ? body.userRequest
        : "";

  try {
    if (action === "plan" || action === "classify") {
      if (!generationId || !requestText.trim()) {
        return res.status(400).json({
          ok: false,
          error: "generationId and request are required for plan",
          creditsCharged: 0,
        });
      }

      const result = await planPosterIterationForSession({
        sessionId,
        userId,
        generationId,
        request: requestText,
      });

      return res.status(200).json({
        ok: true,
        action: "plan",
        plan: {
          iterationId: result.plan.iterationId,
          mode: result.plan.mode,
          classification: result.plan.classification,
          target: result.plan.classificationDetail.target,
          rationale: result.plan.classificationDetail.rationale,
          confidence: result.plan.classificationDetail.confidence,
          locks: result.plan.locks,
          changes: {
            target: result.plan.changes.target,
            summary: result.plan.changes.summary,
          },
          userFacingSummary: result.plan.userFacingSummary,
          userRequest: result.plan.userRequest,
          parentGenerationId: result.plan.parentGenerationId,
        },
        iteration: {
          id: result.iteration.id,
          status: result.iteration.status,
          mode: result.iteration.mode,
        },
        creditsCharged: 0,
      });
    }

    // execute
    const result = await executePosterIterationForSession({
      sessionId,
      userId,
      iterationId: iterationId || undefined,
      generationId: generationId || undefined,
      request: requestText || undefined,
    });

    return res.status(200).json({
      ok: true,
      action: "execute",
      plan: {
        iterationId: result.plan.iterationId,
        mode: result.plan.mode,
        userFacingSummary: result.plan.userFacingSummary,
        parentGenerationId: result.plan.parentGenerationId,
      },
      iteration: {
        id: result.iteration.id,
        status: result.iteration.status,
        resultingGenerationId: result.iteration.resultingGenerationId,
      },
      generationId: result.generationId,
      specificationId: result.specificationId,
      asset: {
        generationId: result.asset.generationId,
        imageUrl: result.asset.imageUrl,
        parentGenerationId: result.asset.parentGenerationId,
        versionNumber: result.asset.versionNumber,
        status: result.asset.status,
      },
      qc: result.qc
        ? {
            passed: result.qc.passed,
            status: result.qc.status,
            summary: result.qc.summary,
            recommendedAction: result.qc.recommendedAction,
          }
        : null,
      creditsCharged: result.creditsCharged,
      session: {
        id: result.session.id,
        status: result.session.status,
        version: result.session.version,
        assetCount: result.session.assets.length,
        iterationCount: result.session.iterations.length,
      },
    });
  } catch (err: unknown) {
    if (
      isPosterIterationError(err) ||
      isPosterSessionError(err) ||
      isPosterGenerationError(err) ||
      isPosterQcError(err)
    ) {
      const code = (err as { code: string }).code;
      const status =
        code === "NOT_FOUND" ||
        code === "MISSING_ASSET" ||
        code === "MISSING_SPEC" ||
        code === "MISSING_STRATEGY" ||
        code === "MISSING_CONCEPT" ||
        code === "MISSING_DNA" ||
        code === "MISSING_BRIEF"
          ? 404
          : code === "INSUFFICIENT_CREDITS"
            ? 402
            : code === "VALIDATION" ||
                code === "PLAN_INVALID" ||
                code === "CLASSIFICATION_FAILED" ||
                code === "MALFORMED_SPEC"
              ? 400
              : code === "CONFLICT"
                ? 409
              : code === "PROVIDER_UNAVAILABLE" || code === "PROVIDER_FAILED"
                ? 502
                : 500;
      return res.status(status).json({
        ok: false,
        error:
          "toPublicJSON" in err && typeof err.toPublicJSON === "function"
            ? err.toPublicJSON()
            : { code, message: "Something went wrong updating your poster" },
        creditsCharged: 0,
      });
    }
    console.error("[posterIterate] error", err);
    return res.status(500).json({
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Something went wrong updating your poster",
        retryable: true,
      },
      creditsCharged: 0,
    });
  }
}
