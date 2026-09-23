/**
 * Phase 6 — Generation Specification + Image Generation public exports.
 */

export { buildGenerationSpecification } from "./specification-builder";
export type { BuildGenerationSpecificationInput } from "./specification-builder";

export {
  validateGenerationSpecification,
  assertValidGenerationSpecification,
} from "./specification-validation";

export {
  compileNanoBananaPrompt,
  buildNanoBananaReferenceInstructions,
  buildImageGenerationRequest,
} from "./nano-banana-prompt";

export {
  NanoBananaImageProvider,
  createNanoBananaImageProvider,
  isPosterAspectSupported,
} from "./nano-banana-provider";

export {
  createPosterImageProvider,
  getDefaultPosterImageProvider,
} from "./provider-router";
export type { PosterImageProviderId } from "./provider-router";

export { storePosterGeneratedImage } from "./storage";
export type { StoredPosterImage } from "./storage";

export { generatePostersForSession } from "./generate-poster";
export type {
  GeneratePostersOptions,
  GeneratePostersResult,
  VariantGenerationOutcome,
} from "./generate-poster";

export {
  PosterGenerationError,
  isPosterGenerationError,
} from "./generation-errors";
export type { PosterGenerationErrorCode } from "./generation-errors";
