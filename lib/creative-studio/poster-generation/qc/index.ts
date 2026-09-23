/**
 * Poster QC — Phase 7 public exports.
 */

export type { PosterQcInput } from "./qc-input";
export { formatQcContextForEvaluator } from "./qc-input";

export { runDeterministicPosterQc, loadImageBuffer } from "./deterministic-checks";
export type { DeterministicQcResult } from "./deterministic-checks";

export {
  GeminiPosterQcEvaluator,
  createGeminiPosterQcEvaluator,
} from "./vision-evaluator";
export type {
  PosterQcEvaluator,
  PosterQcVisionEvaluation,
} from "./vision-evaluator";

export { buildPosterQcResult } from "./qc-normalizer";

export { runPosterQc } from "./qc-engine";
export type { RunPosterQcOptions } from "./qc-engine";

export { runPosterQcForSession } from "./run-for-session";
export type {
  RunPosterQcForSessionOptions,
  RunPosterQcForSessionResult,
} from "./run-for-session";

export { PosterQcError, isPosterQcError } from "./qc-errors";
export type { PosterQcErrorCode } from "./qc-errors";
