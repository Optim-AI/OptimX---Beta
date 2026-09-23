/**
 * Poster Generation Architecture — Phase 1–2 public exports.
 */

export type {
  PosterAspectRatio,
  PosterVisualDirection,
  PosterVariantCount,
  ProductSourceKind,
  ReferenceAssetRole,
  PosterImageRef,
  PosterReferenceAsset,
  PosterDesignReferenceAnalysis,
  PosterProductContext,
  PosterBrandContext,
  CreativeBrief,
  MarketingStrategy,
  CreativeTerritory,
  CreativeConcept,
  CreativeDNA,
  GenerationSpecification,
  GenerationSpecReference,
  GenerationCopySlot,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProviderCapabilities,
  ImageGenerationProvider,
  QcIssueCategory,
  QcSeverity,
  QcDecision,
  QcCheckStatus,
  QcCheckSeverity,
  QcResultStatus,
  QcRecommendedAction,
  QcFailureType,
  PosterQcCheck,
  PosterQcChecks,
  PosterQcIssue,
  PosterQcResult,
  EditClassification,
  PosterIterationRequest,
  PosterIterationRecord,
  IterationMode,
  IterationLocks,
  IterationLockState,
  IterationChanges,
  IterationStatus,
  PosterGeneratedAsset,
  PosterSessionStatus,
  PosterSessionError,
  PosterGenerationSession,
  PosterUiBriefMapping,
} from "./types";

export {
  POSTER_ASPECT_RATIOS,
  POSTER_VISUAL_DIRECTIONS,
  POSTER_VARIANT_COUNTS,
  PRODUCT_SOURCE_KINDS,
  REFERENCE_ASSET_ROLES,
  CREATIVE_TERRITORIES,
  QC_ISSUE_CATEGORIES,
  QC_SEVERITIES,
  QC_DECISIONS,
  QC_CHECK_STATUSES,
  QC_CHECK_SEVERITIES,
  QC_RESULT_STATUSES,
  QC_RECOMMENDED_ACTIONS,
  QC_FAILURE_TYPES,
  EDIT_CLASSIFICATIONS,
  ITERATION_MODES,
  ITERATION_LOCK_STATES,
  ITERATION_STATUSES,
  POSTER_SESSION_STATUSES,
  editClassificationToMode,
  modeToEditClassification,
} from "./types";

export {
  isPosterAspectRatio,
  isPosterVisualDirection,
  isPosterVariantCount,
  isPosterSessionStatus,
  createEmptyPosterSession,
  assertCreativeBriefShape,
  assertMarketingStrategyShape,
  assertCreativeConceptShape,
  assertCreativeDnaShape,
  assertGenerationSpecificationShape,
  assertPosterQcResultShape,
  assertPosterGeneratedAssetShape,
  assertPosterIterationRecordShape,
  assertPosterSessionErrorShape,
} from "./guards";

export {
  PosterGenerationSessionService,
  createPosterGenerationSessionService,
} from "./session";
export type {
  CreatePosterSessionInput,
  PosterGenerationSessionRepository,
} from "./session";

export {
  PosterGenerationSessionError,
  isPosterSessionError,
} from "./session/errors";
export type { PosterSessionErrorCode } from "./session/errors";

export { DrizzlePosterGenerationSessionRepository } from "./session/repository";

// Phase 3 — context normalization
export {
  resolvePosterContext,
  toPosterProductContext,
  toPosterBrandContext,
  toPosterReferenceAssets,
  normalizeCatalogProduct,
  normalizeImportedProduct,
  normalizeUploadedProduct,
  normalizeExistingProduct,
  normalizeBrandSnapshot,
  mergeProductContexts,
  PosterContextError,
  isPosterContextError,
} from "./context";
export type {
  ResolvePosterContextInput,
  ResolvedPosterContext,
  ProductContext,
  BrandContext,
  ReferenceContext,
  ProvenancedValue,
  FieldConflict,
  ContextCompleteness,
  ScrapedProductSource,
  UploadedProductSource,
  ExistingProductSource,
} from "./context";

// Phase 4 — Marketing Strategist
export {
  generateMarketingStrategy,
  runMarketingStrategyForSession,
  strategistInputFromBrief,
  detectUserOverrides,
  validateMarketingStrategy,
  repairStrategyClaims,
  PosterStrategyError,
  isPosterStrategyError,
} from "./strategy";
export type {
  MarketingStrategistInput,
  GenerateMarketingStrategyOptions,
  RunMarketingStrategyOptions,
  RunMarketingStrategyResult,
  PosterStrategyErrorCode,
} from "./strategy";

// Phase 5 — Creative Concept Engine + Creative DNA
export {
  generateCreativeConcepts,
  runCreativeConceptsForSession,
  selectConceptForSession,
  directorInputFromSession,
  validateConceptDiversity,
  fingerprintConcept,
  validateConceptSet,
  normalizeConceptsRaw,
  clampConceptCount,
  PosterConceptError,
  isPosterConceptError,
} from "./concept";
export type {
  CreativeDirectorInput,
  GenerateCreativeConceptsOptions,
  GenerateCreativeConceptsResult,
  RunCreativeConceptsOptions,
  RunCreativeConceptsResult,
  SelectConceptOptions,
  DiversityFingerprint,
  DiversityValidationResult,
  PosterConceptErrorCode,
} from "./concept";

// Phase 6 — Generation Specification + Image Generation
export {
  buildGenerationSpecification,
  validateGenerationSpecification,
  assertValidGenerationSpecification,
  compileNanoBananaPrompt,
  buildImageGenerationRequest,
  createNanoBananaImageProvider,
  createPosterImageProvider,
  getDefaultPosterImageProvider,
  generatePostersForSession,
  storePosterGeneratedImage,
  PosterGenerationError,
  isPosterGenerationError,
} from "./generation";
export type {
  BuildGenerationSpecificationInput,
  GeneratePostersOptions,
  GeneratePostersResult,
  VariantGenerationOutcome,
  PosterGenerationErrorCode,
  PosterImageProviderId,
  StoredPosterImage,
} from "./generation";

// Phase 7 — Poster QC
export {
  runPosterQc,
  runPosterQcForSession,
  runDeterministicPosterQc,
  buildPosterQcResult,
  createGeminiPosterQcEvaluator,
  GeminiPosterQcEvaluator,
  PosterQcError,
  isPosterQcError,
} from "./qc";
export type {
  PosterQcInput,
  PosterQcEvaluator,
  PosterQcVisionEvaluation,
  RunPosterQcOptions,
  RunPosterQcForSessionOptions,
  RunPosterQcForSessionResult,
  PosterQcErrorCode,
  DeterministicQcResult,
} from "./qc";

export {
  sanitizeSessionForClient,
  sanitizeErrorForClient,
  publicErrorMessage,
  isPosterEngineDebugEnabled,
} from "./production-safety";

// Phase 8 — Controlled Iteration
export {
  classifyIterationRequest,
  buildIterationPlan,
  locksForMode,
  applyIterationToSpecification,
  assertPreservationInvariants,
  validateIterationPlan,
  planPosterIterationForSession,
  executePosterIterationForSession,
  runPosterIterationForSession,
  PosterIterationError,
  isPosterIterationError,
} from "./iteration";
export type {
  IterationClassifierInput,
  ClassificationResult,
  IterationPlan,
  PlanPosterIterationOptions,
  PlanPosterIterationResult,
  ExecutePosterIterationOptions,
  ExecutePosterIterationResult,
  PosterIterationErrorCode,
} from "./iteration";
