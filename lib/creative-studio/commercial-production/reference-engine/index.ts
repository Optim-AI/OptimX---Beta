/**
 * Reference / Keyframe Engine — Phase 4.
 *
 * ShotPlan → Reference Strategy → Nano Banana keyframe → QC → PreparedShotForVideo
 *
 * Does NOT call Runway / Seedance.
 * Reuses lib/creative-studio/nano-banana (same stack as Brand Studio posters).
 */

export * from "./types";
export * from "./reference-strategy";
export * from "./prompt-builder";
export * from "./resolve-references";
export * from "./nano-banana-provider";
export * from "./qc";
export * from "./prepare";
export * from "./storage";
export {
  generateCommercialKeyframe,
  prepareCommercialShotForVideo,
} from "./generate";
export type { ReferenceEngineOptions } from "./types";
export { generateCommercialKeyframes } from "./batch";
