/**
 * Phase 8 — Controlled Poster Iteration Engine
 */

export { PosterIterationError, isPosterIterationError } from "./iteration-errors";
export type { PosterIterationErrorCode } from "./iteration-errors";

export type { IterationClassifierInput } from "./classifier-input";

export {
  classifyIterationRequest,
  assertModeMatchesClassification,
} from "./classifier";
export type { ClassificationResult } from "./classifier";

export {
  buildIterationPlan,
  locksForMode,
  planMode,
} from "./iteration-planner";
export type { IterationPlan } from "./iteration-planner";

export {
  applyIterationToSpecification,
  assertPreservationInvariants,
} from "./specification-patcher";

export {
  assertIterationLocks,
  validateIterationPlan,
  iterationRecordFromPlan,
} from "./iteration-validation";

export {
  planPosterIterationForSession,
  executePosterIterationForSession,
  runPosterIterationForSession,
} from "./run-for-session";
export type {
  PlanPosterIterationOptions,
  PlanPosterIterationResult,
  ExecutePosterIterationOptions,
  ExecutePosterIterationResult,
} from "./run-for-session";
