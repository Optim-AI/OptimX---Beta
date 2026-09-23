/**
 * Creative Concept Engine — Phase 5 public exports.
 */

export { generateCreativeConcepts } from "./director";
export type {
  GenerateCreativeConceptsOptions,
  GenerateCreativeConceptsResult,
  CreativeDirectorInput,
} from "./director";

export {
  buildDirectorContextBlock,
  clampConceptCount,
  formatStrategyForDirector,
  formatReferencesForDirector,
} from "./concept-input";

export {
  normalizeConceptsRaw,
  validateConceptSet,
} from "./concept-validation";

export {
  fingerprintConcept,
  validateConceptDiversity,
} from "./diversity";
export type {
  DiversityFingerprint,
  DiversityValidationResult,
} from "./diversity";

export {
  PosterConceptError,
  isPosterConceptError,
} from "./concept-errors";
export type { PosterConceptErrorCode } from "./concept-errors";

export { directorInputFromSession } from "./from-session";

export {
  runCreativeConceptsForSession,
  selectConceptForSession,
} from "./run-for-session";
export type {
  RunCreativeConceptsOptions,
  RunCreativeConceptsResult,
  SelectConceptOptions,
} from "./run-for-session";
