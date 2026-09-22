/**
 * Video Executor — Phase 5.
 *
 * PreparedShotForVideo → VideoProvider → RunwayProvider → Seedance 2.5 → ShotVideoResult
 *
 * Does NOT implement final 15s/30s compositor.
 * Does NOT call runway-client directly.
 */

export * from "./types";
export * from "./prompt-builder";
export * from "./reference-resolver";
export * from "./request-builder";
export * from "./job-manager";
export * from "./qc";
export * from "./storage";
export { generateCommercialShotVideo } from "./executor";
export { generateCommercialShotVideos } from "./batch";
export {
  MockVideoProvider,
  makeApprovedKeyframe,
  getKeyframeFirstPrepared,
  getTextToVideoPrepared,
  getMotionGraphicsPrepared,
} from "./fixtures";
