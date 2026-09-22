/**
 * Commercial QC — Phase 8 public exports.
 */

export * from "./types";
export { runDeterministicCommercialQc } from "./deterministic";
export {
  buildVisualSamplingPlan,
  validateSamplingPlan,
} from "./sampling";
export {
  MockVisualAnalyzer,
  analysisFromJsonText,
} from "./visual-analyzer";
export {
  GeminiVisualAnalyzer,
  createGeminiVisualAnalyzer,
} from "./gemini-visual-analyzer";
export {
  evaluateCreativeCategories,
  campaignRequiresVisibleProduct,
} from "./creative-evaluator";
export { evaluateArtifacts } from "./artifact-evaluator";
export { decideCommercialQC } from "./decision";
export {
  nextGenerationVersion,
  buildRegenerationPlan,
  formatRegenerationInstruction,
  regenerationLimitReached,
  regenerationCountFromVersion,
  appendRegenerationHistory,
} from "./regeneration";
export {
  parseVisualObservation,
  parseVisualAnalysisPayload,
  demoteLowConfidenceCritical,
  VisualAnalysisParseError,
} from "./validate";
export {
  VISUAL_QC_SYSTEM_PROMPT,
  buildVisualQCUserPrompt,
  buildRequirementsSummary,
} from "./prompts";
export { runCommercialQC, attachQcToManifest } from "./evaluate";
export { runQCWithRegenerationLoop } from "./loop";
export type { RegenerationLoopResult, RunQCWithRegenerationInput } from "./loop";
export {
  makeFinalCommercial,
  makeQCInput,
  observation,
  productFailObservation,
  narrativeFailObservation,
  ambiguousObservation,
} from "./fixtures";
