/**
 * Campaign Production Orchestrator — Phase 6.
 *
 * CampaignBrief → Director → ShotPlan → Keyframes → Videos → ProductionManifest
 *
 * Does NOT implement final compositor.
 */

export * from "./types";
export * from "./dependencies";
export * from "./manifest";
export * from "./validate";
export * from "./state";
export { runCampaignProduction } from "./orchestrator";
export {
  makeMockDirector,
  makeMockPlanner,
  makeOrchestratorTestOptions,
  get15sFixture,
  get30sFixture,
} from "./fixtures";
