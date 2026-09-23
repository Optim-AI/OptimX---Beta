/**
 * Poster QC engine — Phase 7.
 * Deterministic → Vision → PosterQcResult. Never generates images. 0 credits.
 */

import type { PosterQcResult } from "../types";
import type { PosterQcInput } from "./qc-input";
import { runDeterministicPosterQc } from "./deterministic-checks";
import {
  createGeminiPosterQcEvaluator,
  type PosterQcEvaluator,
} from "./vision-evaluator";
import { buildPosterQcResult } from "./qc-normalizer";

export type RunPosterQcOptions = {
  evaluator?: PosterQcEvaluator;
  /** Skip vision even when deterministic passes (tests) */
  skipVision?: boolean;
};

export async function runPosterQc(
  input: PosterQcInput,
  options: RunPosterQcOptions = {}
): Promise<PosterQcResult> {
  const deterministic = await runDeterministicPosterQc({
    imageUrl: input.imageUrl,
    expectedAspect: input.brief.aspectRatio,
    assetStatus: input.asset.status,
  });

  if (deterministic.skipVision || options.skipVision) {
    return buildPosterQcResult({
      generationId: input.asset.generationId,
      assetId: input.asset.id,
      deterministic,
      vision: null,
    });
  }

  const evaluator = options.evaluator ?? createGeminiPosterQcEvaluator();
  const vision = await evaluator.evaluate(input);

  return buildPosterQcResult({
    generationId: input.asset.generationId,
    assetId: input.asset.id,
    deterministic,
    vision,
  });
}
