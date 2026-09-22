/**
 * Campaign Production Compiler — Phase 7.
 *
 * Blueprint + ShotPlan + references → CampaignGenerationSpec (native continuous default).
 */

export * from "./types";
export { compileCampaignGeneration } from "./compiler";
export { buildCampaignPrompt } from "./prompt-builder";
export { buildCampaignReferences } from "./reference-builder";
export {
  validateCampaignGenerationSpec,
  assertCampaignGenerationSpec,
} from "./validate";
export { make15sCompileInput, make30sCompileInput } from "./fixtures";
