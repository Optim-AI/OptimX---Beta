// pages/api/creative-studio/poster/debug/[sessionId].ts
// Phase 9 — developer-only engine trace. Disabled for ordinary users in production.

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { createPosterGenerationSessionService } from "@/lib/creative-studio/poster-generation";
import { isPosterSessionError } from "@/lib/creative-studio/poster-generation";
import { isPosterEngineDebugEnabled } from "@/lib/creative-studio/poster-generation/production-safety";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!isPosterEngineDebugEnabled(req)) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : null;
  if (!sessionId) {
    return res.status(400).json({ ok: false, error: "sessionId required" });
  }

  const generationId =
    typeof req.query.generationId === "string"
      ? req.query.generationId
      : null;

  try {
    const service = createPosterGenerationSessionService();
    const session = await service.getSession(sessionId, userId);

    const asset = generationId
      ? session.assets.find(
          (a) => a.generationId === generationId || a.id === generationId
        )
      : session.assets.filter((a) => a.isActive !== false).slice(-1)[0] ||
        session.assets[session.assets.length - 1];

    const spec = asset
      ? session.specifications.find(
          (s) =>
            s.id === asset.specificationId ||
            s.generationId === asset.generationId
        )
      : null;
    const concept = asset
      ? session.concepts.find((c) => c.id === asset.conceptId)
      : null;
    const dna = asset ? session.dnaByConceptId[asset.conceptId] : null;
    const iteration = asset?.iterationId
      ? session.iterations.find((i) => i.id === asset.iterationId)
      : null;
    const parent = asset?.parentGenerationId
      ? session.assets.find((a) => a.generationId === asset.parentGenerationId)
      : null;

    return res.status(200).json({
      ok: true,
      debug: true,
      trace: {
        sessionId: session.id,
        status: session.status,
        version: session.version,
        brief: !!session.brief,
        strategy: !!session.strategy,
        strategyId: session.strategy?.id || null,
        conceptCount: session.concepts.length,
        selectedConceptIds: session.selectedConceptIds,
        conceptId: concept?.id || null,
        conceptName: concept?.name || null,
        dnaId: dna?.id || null,
        specificationId: spec?.id || null,
        generationId: asset?.generationId || null,
        parentGenerationId: asset?.parentGenerationId || null,
        parentExists: !!parent,
        versionNumber: asset?.versionNumber || null,
        iterationId: iteration?.id || null,
        iterationMode: iteration?.mode || iteration?.classification || null,
        provider: asset?.provider || session.trace.lastProvider || null,
        model: asset?.model || session.trace.lastModel || null,
        storagePath: asset?.storagePath || null,
        imageUrlPresent: !!asset?.imageUrl,
        qc: asset?.qc
          ? {
              passed: asset.qc.passed,
              status: asset.qc.status,
              summary: asset.qc.summary,
              recommendedAction: asset.qc.recommendedAction,
            }
          : null,
        credits: {
          assetCreditsConsumed: asset?.creditsConsumed ?? null,
          sessionTotalCreditsConsumed: session.trace.totalCreditsConsumed,
          generationCount: session.trace.generationCount,
        },
        locks: iteration?.locks || null,
        // Full artifacts only in non-prod / debug secret mode
        artifacts: {
          brief: session.brief,
          strategy: session.strategy,
          concept,
          dna,
          specification: spec,
          asset,
          iteration,
        },
      },
    });
  } catch (err: unknown) {
    if (isPosterSessionError(err)) {
      return res.status(err.code === "NOT_FOUND" ? 404 : 400).json({
        ok: false,
        error: err.toPublicJSON(),
      });
    }
    console.error("[posterDebug] error", err);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
