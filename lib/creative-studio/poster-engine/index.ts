/**
 * Poster Engine V1 — ONE creative brain, ONE spec, ONE prompt compiler.
 *
 * normalizePosterInput → planPosterCreative → compilePosterPrompt → Nano Banana 2
 */

export type {
  CreativeMechanism,
  PosterAspectRatio,
  PosterCreativeSpec,
  PosterGenerationInput,
  PosterPlanResult,
  PosterProductContext,
  ProductRole,
} from "./types";

export {
  CREATIVE_MECHANISMS,
  PRODUCT_ROLES,
  productToPosterContext,
} from "./types";

export { normalizePosterInput } from "./normalize";
export type { NormalizePosterInputRaw } from "./normalize";

export { planPosterCreative } from "./plan";
export type { PlanPosterCreativeOptions } from "./plan";

export { compilePosterPrompt } from "./compile";

export {
  validateCreativeSpec,
  normalizeSpec,
  isValidMechanism,
  isValidProductRole,
} from "./validate";

export { buildFallbackPlan, buildFallbackSpec } from "./fallback";

export type {
  ReferencePosterAnalysis,
  ReferencePosterAsset,
  ReferenceInfluenceLevel,
  ReferencePosterSource,
} from "./reference-types";

export { formatReferenceForPlanner } from "./reference-types";

export {
  analyzeReferencePoster,
  hashReferenceImagePayload,
  getCachedReferenceAnalysis,
  setCachedReferenceAnalysis,
} from "./reference-analyzer";
