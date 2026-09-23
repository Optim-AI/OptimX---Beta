// pages/api/creative-studio/poster/generate.ts
// Phase 6 + Phase 9: generation with credit integrity + sanitized client payload

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  generatePostersForSession,
  isPosterGenerationError,
  isPosterSessionError,
} from "@/lib/creative-studio/poster-generation";
import {
  publicErrorMessage,
  sanitizeErrorForClient,
} from "@/lib/creative-studio/poster-generation/production-safety";
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

  // Reject browser-supplied creative artifacts
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
          "Do not submit strategy, specification, concept, or DNA from the browser.",
      },
      creditsCharged: 0,
    });
  }

  const conceptId =
    typeof body.conceptId === "string" ? body.conceptId : undefined;
  const variantCount =
    body.variantCount != null ? Number(body.variantCount) : undefined;
  const forceRegenerate = body.forceRegenerate === true;

  try {
    const result = await generatePostersForSession({
      sessionId,
      userId,
      conceptId,
      variantCount,
      forceRegenerate,
    });

    console.log("[posterGenerate] success", {
      userId,
      sessionId,
      reused: result.reused,
      requested: result.requestedVariants,
      successful: result.successfulVariants,
      failed: result.failedVariants,
      creditsCharged: result.creditsCharged,
      partial: result.partial,
    });

    const isProd = process.env.NODE_ENV === "production";

    return res.status(200).json({
      ok: result.successfulVariants > 0,
      partial: result.partial,
      reused: result.reused,
      requestedVariants: result.requestedVariants,
      successfulVariants: result.successfulVariants,
      failedVariants: result.failedVariants,
      actualAttempts: result.actualAttempts,
      creditsCharged: result.creditsCharged,
      outcomes: result.outcomes.map((o) => ({
        variantId: o.variantId,
        variantIndex: o.variantIndex,
        conceptId: o.conceptId,
        generationId: o.generationId,
        success: o.success,
        attempts: o.attempts,
        specificationId: o.specification.id,
        asset: {
          generationId: o.asset.generationId,
          imageUrl: o.asset.imageUrl,
          status: o.asset.status,
          creditsConsumed: o.asset.creditsConsumed,
          errorMessage: o.asset.errorMessage
            ? publicErrorMessage(o.asset.errorCode || "PROVIDER_FAILED")
            : null,
        },
        compiledPrompt:
          !isProd ? o.specification.compiledPrompt : undefined,
      })),
      session: {
        id: result.session.id,
        status: result.session.status,
        version: result.session.version,
        assetCount: result.session.assets.length,
        generationCount: result.session.trace.generationCount,
        totalCreditsConsumed: result.session.trace.totalCreditsConsumed,
      },
    });
  } catch (err: unknown) {
    if (isPosterGenerationError(err) || isPosterSessionError(err)) {
      const status =
        err.code === "NOT_FOUND" ||
        err.code === "MISSING_BRIEF" ||
        err.code === "MISSING_STRATEGY" ||
        err.code === "MISSING_CONCEPT" ||
        err.code === "MISSING_DNA"
          ? 404
          : err.code === "INSUFFICIENT_CREDITS"
            ? 402
            : err.code === "VALIDATION" ||
                err.code === "MALFORMED_SPEC" ||
                err.code === "STALE_STRATEGY"
              ? 400
              : err.code === "CONFLICT"
                ? 409
                : err.code === "PROVIDER_UNAVAILABLE" ||
                    err.code === "PROVIDER_FAILED"
                  ? 502
                  : 500;
      return res.status(status).json({
        ok: false,
        error: err.toPublicJSON(),
        creditsCharged: 0,
      });
    }
    console.error("[posterGenerate] error", err);
    return res.status(500).json({
      ok: false,
      error: sanitizeErrorForClient({
        code: "INTERNAL",
        message: "Internal server error",
        retryable: true,
      }),
      creditsCharged: 0,
    });
  }
}
