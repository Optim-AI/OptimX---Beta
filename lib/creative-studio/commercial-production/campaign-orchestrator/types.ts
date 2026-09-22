/**
 * Campaign Orchestrator — Phase 6 types.
 *
 * Orchestrates Phase 2–5. Does NOT invent creative logic, Runway, Nano Banana,
 * or final compositor. Output: ProductionManifest for Phase 7.
 */

import type { CampaignBrief, CommercialAspectRatio } from "../campaign/types";
import type { CampaignDurationSeconds } from "../campaign/campaign-duration";
import type {
  CommercialBlueprintCore,
  SelectedConcept,
  VisualTreatment,
} from "../commercial-director/types";
import type { CommercialShot, ShotPlan } from "../shot-planner/types";
import type {
  AvailableCampaignAssets,
  KeyframeResult,
  PreparedShotForVideo,
  VideoGenerationMode,
} from "../reference-engine/types";
import type { ShotVideoResult } from "../video-executor/types";
import type { CommercialDirector } from "../commercial-director/types";
import type { ShotPlanner } from "../shot-planner/types";
import type { ImageGenerationProvider } from "../reference-engine/types";
import type { VideoProvider } from "../video/providers/types";

export type CampaignProductionStatus =
  | "draft"
  | "planning"
  | "blueprint_ready"
  | "shot_plan_ready"
  | "references_generating"
  | "references_ready"
  | "videos_generating"
  | "videos_ready"
  | "production_ready"
  | "composition_pending"
  | "planning_failed"
  | "reference_generation_failed"
  | "video_generation_failed"
  | "dependency_graph_invalid"
  | "manifest_validation_failed"
  | "failed";

export type CampaignShotProductionStatus =
  | "pending"
  | "references_pending"
  | "reference_ready"
  | "reference_skipped"
  | "video_pending"
  | "video_generating"
  | "video_ready"
  | "deferred"
  | "blocked"
  | "failed";

export type ProductionErrorCode =
  | "DIRECTOR_FAILED"
  | "SHOT_PLANNER_FAILED"
  | "REFERENCE_GENERATION_FAILED"
  | "VIDEO_GENERATION_FAILED"
  | "DEPENDENCY_BLOCKED"
  | "DEPENDENCY_GRAPH_INVALID"
  | "MANIFEST_VALIDATION_FAILED"
  | "INVALID_CAMPAIGN_INPUT"
  | "DURATION_MISMATCH"
  | "PRODUCTION_INCOMPLETE";

export interface ProductionError {
  code: ProductionErrorCode | string;
  message: string;
  stage: string;
  campaignId: string;
  shotId?: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export class CampaignOrchestratorError extends Error {
  constructor(
    public readonly code: ProductionErrorCode,
    message: string,
    public readonly stage: string,
    public readonly details?: Record<string, unknown>,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "CampaignOrchestratorError";
  }

  toProductionError(campaignId: string, shotId?: string): ProductionError {
    return {
      code: this.code,
      message: this.message,
      stage: this.stage,
      campaignId,
      shotId,
      retryable: this.retryable,
      details: this.details,
    };
  }
}

export interface CampaignShotProductionState {
  shotId: string;
  index: number;
  sequence: number;
  generationStrategy: string;
  generationMode?: VideoGenerationMode;
  status: CampaignShotProductionStatus;
  dependencies: string[];
  preparedShot?: PreparedShotForVideo;
  keyframe?: KeyframeResult;
  video?: ShotVideoResult;
  errors?: ProductionError[];
}

export interface CampaignProductionRun {
  campaignId: string;
  generationVersion: string;
  status: CampaignProductionStatus;
  startedAt?: string;
  completedAt?: string;
  updatedAt?: string;
  brief?: CampaignBrief;
  blueprint?: CommercialBlueprintCore;
  shotPlan?: ShotPlan;
  shots: CampaignShotProductionState[];
  manifest?: ProductionManifest;
  errors?: ProductionError[];
}

export interface ProductionManifestShot {
  shotId: string;
  index: number;
  sequence: number;
  durationSeconds: number;
  role: string;
  shotWhy: string;
  beatIds: string[];
  storyBeat?: string;
  transitionIn?: string;
  transitionOut?: string;
  generationStrategy: string;
  generationMode: VideoGenerationMode;
  keyframe?: {
    assetId: string;
    url?: string;
    status: string;
    keyframeId?: string;
  };
  video?: {
    assetId: string;
    url?: string;
    durationSeconds?: number;
    width?: number;
    height?: number;
    provider?: string;
    model?: string;
  };
  sourceReferences: string[];
  continuity: {
    continuesFromShotIds: string[];
    mustMatch: string[];
    mustMatchDimensions?: string[];
    characterContinuity?: unknown;
    productState?: unknown;
  };
  artifactRisks: string[];
  qc: {
    status: string;
    keyframeQcPassed?: boolean;
    videoQcPassed?: boolean;
    visualInspectionAvailable: boolean;
    notes?: string[];
  };
  composition: {
    eligible: boolean;
    reason?: string;
  };
}

export interface ProductionManifest {
  campaignId: string;
  generationVersion: string;
  campaign: {
    durationSeconds: CampaignDurationSeconds;
    aspectRatio: CommercialAspectRatio | string;
  };
  creative: {
    selectedConcept: SelectedConcept | unknown;
    visualTreatment: VisualTreatment | unknown;
  };
  shots: ProductionManifestShot[];
  totalShotDurationSeconds: number;
  productionStatus: "ready_for_composition" | "incomplete" | "failed";
  createdAt: string;
  runStatus: CampaignProductionStatus;
  /** Phase 7: how the final commercial was / will be produced. */
  finalProduction?: {
    generationMode: "native_continuous" | "shot_based_fallback" | "shot_based_composed";
    provider?: "runway";
    model?: string;
    videoAssetId?: string;
    videoUrl?: string;
    qcStatus?: string;
    generationVersion?: string;
  };
  /**
   * Phase 8: compact QC summary (not a full duplicated report tree).
   * Full CommercialQCReport lives on FinalCommercial.commercialQC when requested.
   */
  qc?: {
    decision: "accept" | "regenerate" | "manual_review";
    generationVersion: string;
    evaluatedAt: string;
    deterministicPassed: boolean;
    visualAvailable: boolean;
    categories?: Record<string, string>;
    regeneration?: { toVersion: string; reason: string };
    regenerationHistory?: Array<{
      fromVersion: string;
      toVersion: string;
      decidedAt: string;
      decision: string;
      reason: string;
    }>;
  };
}

export interface ProductionManifestStore {
  save(manifest: ProductionManifest): Promise<void>;
  get(campaignId: string, generationVersion: string): Promise<ProductionManifest | null>;
}

export interface ProductionRunStore {
  save(run: CampaignProductionRun): Promise<void>;
  get(campaignId: string, generationVersion: string): Promise<CampaignProductionRun | null>;
}

export interface RunCampaignProductionInput {
  brief: CampaignBrief;
  generationVersion?: string;
  forceRegenerate?: boolean;
  availableAssets?: AvailableCampaignAssets;
  /** Skip Phase 4/5 download/storage (tests). */
  skipDownload?: boolean;
  skipStorage?: boolean;
  concurrency?: number;
  userId?: string;
}

export interface CampaignOrchestratorOptions {
  director?: CommercialDirector;
  shotPlanner?: ShotPlanner;
  imageProvider?: ImageGenerationProvider;
  videoProvider?: VideoProvider;
  runStore?: ProductionRunStore;
  manifestStore?: ProductionManifestStore;
  log?: (event: string, payload: Record<string, unknown>) => void;
}

export type { CommercialShot, ShotPlan, CampaignBrief, AvailableCampaignAssets };
