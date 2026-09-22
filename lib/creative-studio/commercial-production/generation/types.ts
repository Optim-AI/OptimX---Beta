/**
 * Per-shot generation technique. The Commercial Director / Shot Planner chooses
 * this; the provider layer must not invent a different strategy.
 */

import type { CommercialPipelineStage } from "../pipeline";
import type { QCResult } from "../qc/types";

export const GENERATION_STRATEGY_IDS = [
  "text-to-video",
  "image-to-video",
  "keyframe-first",
  "product-reference-first",
  "motion-graphics",
  "composited",
  "hybrid",
  "existing-asset-ai-motion",
] as const;

export type GenerationStrategyId = (typeof GENERATION_STRATEGY_IDS)[number];

export interface GenerationStrategy {
  id: GenerationStrategyId;
  /** Why this technique was chosen for this shot. */
  rationale: string;
  /** Ordered steps, e.g. ["keyframe", "keyframe_qc", "image-to-video", "shot_qc"]. */
  steps: string[];
  requiresKeyframe: boolean;
  requiresProductReference: boolean;
  requiresStartFrame: boolean;
  requiresEndFrame: boolean;
  prefersCompositing: boolean;
}

export const GENERATION_JOB_STATUSES = [
  "pending",
  "submitted",
  "polling",
  "completed",
  "qc_pending",
  "qc_failed",
  "failed",
  "cancelled",
] as const;

export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number];

export interface GenerationJob {
  id: string;
  campaignId: string;
  shotId?: string;
  keyframeId?: string;
  stage: CommercialPipelineStage;
  provider?: string;
  model?: string;
  generationStrategy: GenerationStrategyId;
  status: GenerationJobStatus;
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  durationSeconds?: number;
  assetId?: string;
  providerJobId?: string;
  qcScore?: number;
  qcResult?: QCResult;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  completedAt?: string;
}

export function defaultStrategyForId(id: GenerationStrategyId, rationale: string): GenerationStrategy {
  const requiresKeyframe = id === "keyframe-first" || id === "hybrid";
  const requiresProductReference = id === "product-reference-first" || id === "keyframe-first";
  const requiresStartFrame =
    id === "image-to-video" || id === "keyframe-first" || id === "existing-asset-ai-motion";
  return {
    id,
    rationale,
    steps: strategySteps(id),
    requiresKeyframe,
    requiresProductReference,
    requiresStartFrame,
    requiresEndFrame: false,
    prefersCompositing: id === "motion-graphics" || id === "composited",
  };
}

function strategySteps(id: GenerationStrategyId): string[] {
  switch (id) {
    case "keyframe-first":
      return ["keyframe", "keyframe_qc", "image-to-video", "shot_qc"];
    case "product-reference-first":
      return ["product_reference", "image-generation", "image-to-video", "shot_qc"];
    case "image-to-video":
      return ["image-to-video", "shot_qc"];
    case "text-to-video":
      return ["text-to-video", "shot_qc"];
    case "motion-graphics":
      return ["motion-graphics", "composite", "shot_qc"];
    case "composited":
      return ["generate_layers", "composite", "shot_qc"];
    case "hybrid":
      return ["keyframe", "video", "composite", "shot_qc"];
    case "existing-asset-ai-motion":
      return ["existing_asset", "image-to-video", "shot_qc"];
  }
}
