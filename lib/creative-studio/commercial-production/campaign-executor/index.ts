/**
 * Campaign Executor — Phase 7.
 *
 * Native continuous Seedance 2.5 (default) + shot-based fallback.
 */

export * from "./types";
export { generateCampaignVideo } from "./generate-campaign-video";
export { produceFinalCommercial } from "./produce";
export { produceShotBasedFallback } from "./fallback";
export { runDeterministicCampaignVideoQc } from "./qc";
export {
  clearCampaignVideoCache,
  campaignVideoIdempotencyKey,
} from "./storage";
export {
  makeNative15sSpec,
  makeNative30sSpec,
  makeExecutorTestOptions,
} from "./fixtures";
