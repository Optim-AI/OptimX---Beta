/**
 * SkalX AI Commercial Production Engine.
 *
 * Pipeline:
 *   Campaign Brief (duration 15s | 30s)
 *     → Commercial Director → Commercial Blueprint (Phase 2 ✓)
 *     → Shot Planner → CommercialShots (Phase 3 ✓)
 *     → Reference / Keyframe Engine → Nano Banana keyframe when required (Phase 4 ✓)
 *     → PreparedShotForVideo → Video Executor → VideoProvider → Runway → Seedance 2.5 (Phase 5 ✓)
 *     → Campaign Orchestrator → ProductionManifest (Phase 6 ✓)
 *     → Campaign Compiler → Native Seedance 2.5 continuous generation (Phase 7 ✓)
 *         default: ONE 15s|30s Runway job (native_continuous)
 *         fallback: shot-based Phase 6 videos → timeline (FFmpeg stitch later)
 *     → Final Commercial
 *     → Commercial QC → accept | regenerate | manual_review (Phase 8 ✓)
 *     → Commercial Studio UI drives native continuous generation (Phase 9 ✓)
 *
 * Active video stack (provider ≠ model):
 *   provider = runway
 *   model    = seedance2_5
 *
 * Active keyframe image stack:
 *   provider = nano_banana (shared with Brand Studio posters)
 *   model    = gemini-2.5-flash-image (GEMINI_MODEL override)
 *
 * Relationship to lib/creative-studio/film-engine:
 *   Legacy Creative Studio stack (styles, scene graph, Veo renderer). Preserved.
 *   Commercial Director / Shot Planner reuse product-intelligence only; they do
 *   not call film-engine CreativeDirector or veo-renderer.
 *
 * Phase 3 does NOT call Runway, Seedance, Nano Banana, or image generation.
 * Phase 4 Reference Engine generates keyframes via Nano Banana when required;
 * it does NOT call Runway/Seedance (PreparedShotForVideo handoff only).
 * Phase 5 Video Executor submits per-shot jobs via VideoProvider (Runway/Seedance);
 * it does NOT assemble the final 15s/30s commercial.
 * Phase 6 Campaign Orchestrator sequences Phases 2–5 into a ProductionManifest;
 * it does NOT run FFmpeg / final composition.
 * Phase 7 Campaign Compiler + Executor: native continuous is DEFAULT.
 * Shot Plan describes creative structure — it does NOT imply one video per shot.
 */

export * from "./pipeline";
export * from "./assets";
export * from "./campaign/campaign-duration";
export * from "./campaign/types";
export * from "./commercial-director/types";
export * from "./commercial-director/blueprint";
export {
  DefaultCommercialDirector,
  createCommercialDirector,
  validateCommercialBlueprint,
  formatValidationIssues,
  GeminiStructuredGenerator,
  createDefaultStructuredGenerator,
  StructuredGenerationError,
  assembleBlueprintFromDraft,
  blueprintCoreAsBlueprint,
} from "./commercial-director";
export type {
  StructuredGenerator,
  StructuredGenerationRequest,
  StructuredGenerationResult,
  BlueprintValidationResult,
  BlueprintValidationIssue,
  DirectorDraft,
  DefaultCommercialDirectorOptions,
} from "./commercial-director";
export {
  DefaultShotPlanner,
  createShotPlanner,
  validateShotPlan,
  formatShotPlanValidationIssues,
  assembleShotPlanFromDraft,
  normalizeShotDurations,
} from "./shot-planner";
export type {
  DefaultShotPlannerOptions,
  ShotPlannerDraft,
  ShotPlanValidationResult,
  ShotPlanValidationIssue,
} from "./shot-planner";
export * from "./shot-planner/types";
export {
  generateCommercialKeyframe,
  generateCommercialKeyframes,
  prepareCommercialShotForVideo,
  resolveReferenceStrategy,
  createNanoBananaProvider,
  NanoBananaProvider,
  prepareShotForVideo,
  clearKeyframeCache,
} from "./reference-engine";
export type {
  KeyframeResult,
  KeyframeSpecification,
  PreparedShotForVideo,
  ResolvedReferenceStrategy,
  AvailableCampaignAssets,
  ImageGenerationProvider,
  ReferenceEngineOptions,
} from "./reference-engine";
export {
  generateCommercialShotVideo,
  generateCommercialShotVideos,
  buildVideoGenerationPrompt,
  buildVideoExecutionRequest,
  resolveVideoReferences,
  clearShotVideoCache,
  VIDEO_EXECUTOR_PROVIDER,
  VIDEO_EXECUTOR_MODEL,
} from "./video-executor";
export type {
  ShotVideoResult,
  VideoExecutionRequest,
  GenerateCommercialShotVideoInput,
  GenerateCommercialShotVideosInput,
  VideoExecutorOptions,
  VideoExecutorErrorCode,
} from "./video-executor";
export { VideoExecutorError } from "./video-executor";
export {
  runCampaignProduction,
  buildProductionManifest,
  buildShotDependencyGraph,
  validateProductionRun,
  clearOrchestratorStores,
  CampaignOrchestratorError,
} from "./campaign-orchestrator";
export type {
  CampaignProductionRun,
  CampaignShotProductionState,
  ProductionManifest,
  ProductionManifestShot,
  RunCampaignProductionInput,
  CampaignOrchestratorOptions,
  CampaignProductionStatus,
  ProductionManifestStore,
  ProductionRunStore,
} from "./campaign-orchestrator";
export {
  compileCampaignGeneration,
  buildCampaignPrompt,
  buildCampaignReferences,
  validateCampaignGenerationSpec,
  CampaignCompilerError,
} from "./campaign-compiler";
export type {
  CampaignGenerationSpec,
  CampaignGenerationMode,
  CompileCampaignGenerationInput,
} from "./campaign-compiler";
export {
  produceFinalCommercial,
  generateCampaignVideo,
  produceShotBasedFallback,
  runDeterministicCampaignVideoQc,
  clearCampaignVideoCache,
  CampaignExecutorError,
} from "./campaign-executor";
export type {
  FinalCommercial,
  CampaignVideoResult,
  CampaignVideoQC,
  ProduceFinalCommercialInput,
  AudioTrackReference,
} from "./campaign-executor";
export {
  mapStudioFormToCampaignBrief,
  assertNativeDurationInvariant,
  buildStudioAvailableAssets,
  buildCreativePlanSummary,
  resolveCanonicalProductImage,
} from "./studio-mapper";
export type {
  StudioFormInput,
  CreativePlanSummary,
  StudioNativeRequestInvariant,
} from "./studio-mapper";
export {
  runCommercialQC,
  runDeterministicCommercialQc,
  runQCWithRegenerationLoop,
  buildVisualSamplingPlan,
  decideCommercialQC,
  buildRegenerationPlan,
  nextGenerationVersion,
  MockVisualAnalyzer,
  GeminiVisualAnalyzer,
  createGeminiVisualAnalyzer,
  attachQcToManifest,
  DEFAULT_MAX_AUTO_REGENERATIONS,
  DEFAULT_QC_THRESHOLDS,
} from "./commercial-qc";
export type {
  CommercialQCReport,
  CommercialQCDecision,
  CommercialQCInput,
  RegenerationPlan,
  VisualObservation,
  CommercialVisualAnalyzer,
} from "./commercial-qc";
export * from "./continuity/types";
export * from "./generation/types";
export * from "./keyframes/types";
export * from "./qc/types";
export * from "./video/prompt/types";
export {
  DefaultPromptCompiler,
  defaultPromptCompiler,
  compilePromptFromLegacyBrief,
} from "./video/prompt/compiler";
export * from "./video/providers/types";
export {
  listProviderRegistrations,
  getProviderRegistration,
  getProviderCapabilities,
  getLiveProvider,
  getActiveVideoProvider,
  rankProviders,
  selectProvider,
  providerSelectionFromShot,
  strategyNeedsImageInput,
  strategyNeedsReferences,
} from "./video/providers/registry";
export {
  getRunwayCapabilities,
  checkRunwayAvailability,
  createRunwayProvider,
  RunwayProvider,
  RUNWAY_PROVIDER_ID,
  RUNWAY_ACTIVE_MODEL,
  RUNWAY_SEEDANCE_MODEL,
  RUNWAY_API_KEY_SETUP_MESSAGE,
} from "./video/providers/runway";
export type { RunwayGenerateVideoRequest } from "./video/providers/runway";
export {
  getSeedanceCapabilities,
  checkSeedanceAvailability,
  SEEDANCE_PROVIDER_ID,
} from "./video/providers/seedance";
export type { SeedanceGenerateVideoRequest } from "./video/providers/seedance";
export { getVeoCapabilities, checkVeoAvailability, VEO_PROVIDER_ID } from "./video/providers/veo";
export * from "./timeline/types";
export * from "./timeline/timeline";
