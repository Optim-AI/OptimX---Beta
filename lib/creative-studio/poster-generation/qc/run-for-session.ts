/**
 * Session-aware Poster QC — Phase 7.
 * Persists QC on asset. Never deducts image credits. Never regenerates.
 */

import type { PosterQcResult, PosterGenerationSession } from "../types";
import {
  createPosterGenerationSessionService,
  type PosterGenerationSessionService,
} from "../session";
import { strategistInputFromBrief } from "../strategy/from-brief";
import { runPosterQc, type RunPosterQcOptions } from "./qc-engine";
import type { PosterQcEvaluator } from "./vision-evaluator";
import { PosterQcError } from "./qc-errors";
import type { PosterQcInput } from "./qc-input";

export type RunPosterQcForSessionOptions = {
  sessionId: string;
  userId: string;
  generationId: string;
  sessionService?: PosterGenerationSessionService;
  evaluator?: PosterQcEvaluator;
  skipVision?: boolean;
};

export type RunPosterQcForSessionResult = {
  session: PosterGenerationSession;
  qc: PosterQcResult;
  creditsCharged: 0;
};

export async function runPosterQcForSession(
  options: RunPosterQcForSessionOptions
): Promise<RunPosterQcForSessionResult> {
  const sessions =
    options.sessionService ?? createPosterGenerationSessionService();
  const session = await sessions.getSession(options.sessionId, options.userId);

  if (!session.brief) {
    throw new PosterQcError({
      code: "VALIDATION",
      message: "Session has no CreativeBrief",
      stage: "runPosterQcForSession",
    });
  }
  if (!session.strategy) {
    throw new PosterQcError({
      code: "MISSING_STRATEGY",
      message: "Session has no MarketingStrategy",
      stage: "runPosterQcForSession",
    });
  }

  const asset = session.assets.find(
    (a) =>
      a.id === options.generationId ||
      a.generationId === options.generationId
  );
  if (!asset) {
    throw new PosterQcError({
      code: "MISSING_ASSET",
      message: `No generated asset for generationId=${options.generationId}`,
      stage: "runPosterQcForSession",
    });
  }

  const specification = session.specifications.find(
    (s) =>
      s.id === asset.specificationId ||
      s.generationId === asset.generationId
  );
  if (!specification) {
    throw new PosterQcError({
      code: "MISSING_SPEC",
      message: `GenerationSpecification not found for asset ${asset.id}`,
      stage: "runPosterQcForSession",
    });
  }

  const concept = session.concepts.find((c) => c.id === asset.conceptId);
  if (!concept) {
    throw new PosterQcError({
      code: "MISSING_CONCEPT",
      message: `Concept ${asset.conceptId} not found on session`,
      stage: "runPosterQcForSession",
    });
  }

  const dna = session.dnaByConceptId[concept.id];
  if (!dna) {
    throw new PosterQcError({
      code: "MISSING_DNA",
      message: `CreativeDNA missing for concept ${concept.id}`,
      stage: "runPosterQcForSession",
    });
  }

  const contexts = strategistInputFromBrief(session.brief);
  const productReferenceUrls = [
    ...contexts.references.productReferences
      .map((r) => r.image?.url)
      .filter((u): u is string => !!u),
    ...specification.references
      .filter((r) => r.kind === "product" && r.url)
      .map((r) => r.url as string),
  ];

  const input: PosterQcInput = {
    sessionId: session.id,
    brief: session.brief,
    strategy: session.strategy,
    concept,
    dna,
    specification,
    asset,
    product: contexts.product,
    brand: contexts.brand,
    references: contexts.references,
    imageUrl: asset.imageUrl,
    productReferenceUrls: [...new Set(productReferenceUrls)],
  };

  const qcOpts: RunPosterQcOptions = {
    evaluator: options.evaluator,
    skipVision: options.skipVision,
  };

  const qc = await runPosterQc(input, qcOpts);

  const updated = await sessions.addQcResult(
    options.sessionId,
    options.userId,
    qc,
    asset.id
  );

  return {
    session: updated,
    qc,
    creditsCharged: 0,
  };
}
