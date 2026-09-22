/**
 * Campaign Executor — Phase 7 types.
 *
 * Native continuous Seedance 2.5 generation (default) + shot-based fallback.
 */

import type { CampaignDurationSeconds } from "../campaign/campaign-duration";
import type { CommercialAspectRatio } from "../campaign/types";
import type { CampaignBrief } from "../campaign/types";
import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { ShotPlan } from "../shot-planner/types";
import type { AvailableCampaignAssets } from "../reference-engine/types";
import type { CampaignGenerationMode, CampaignGenerationSpec } from "../campaign-compiler/types";
import type { ProductionManifest } from "../campaign-orchestrator/types";
import type { ShotVideoResult } from "../video-executor/types";
import type { CommercialTimeline } from "../timeline/types";
import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
} from "../video-executor/types";
import type { VideoProvider } from "../video/providers/types";
import type { CommercialDirector } from "../commercial-director/types";
import type { ShotPlanner } from "../shot-planner/types";
import type { ImageGenerationProvider } from "../reference-engine/types";

export type AudioTrackType = "voiceover" | "dialogue" | "music" | "sfx";

/** Future audio extension point — Phase 7 does not generate audio. */
export interface AudioTrackReference {
  type: AudioTrackType;
  assetId: string;
  startTime: number;
  duration?: number;
}

export interface CampaignVideoQCIssue {
  check: string;
  severity: "error" | "warning" | "info";
  message: string;
}

export interface CampaignVideoQC {
  passed: boolean;
  issues: CampaignVideoQCIssue[];
  checksPerformed: string[];
  visualInspectionAvailable: false;
  durationToleranceSeconds: number;
}

export interface CampaignVideoResult {
  campaignId: string;
  generationVersion: string;
  provider: typeof VIDEO_EXECUTOR_PROVIDER;
  model: typeof VIDEO_EXECUTOR_MODEL | string;
  generationMode: "native_continuous";
  duration: CampaignDurationSeconds;
  aspectRatio: CommercialAspectRatio | string;
  videoAssetId: string;
  videoUrl: string;
  providerJobId: string;
  status: "completed" | "failed" | "processing";
  prompt: string;
  referenceAssetIds: string[];
  estimatedCostUsd?: number;
  actualCostUsd?: number;
  qc: CampaignVideoQC;
  error?: { code: string; message: string };
  metadata: {
    idempotencyKey: string;
    startedAt?: string;
    completedAt?: string;
    elapsedMs?: number;
  };
}

export type FinalCommercialProductionMode =
  | "native_continuous"
  | "shot_based_composed";

export interface FinalCommercial {
  campaignId: string;
  generationVersion: string;
  duration: CampaignDurationSeconds;
  aspectRatio: CommercialAspectRatio | string;
  productionMode: FinalCommercialProductionMode;
  videoAssetId: string;
  videoUrl: string;
  provider: typeof VIDEO_EXECUTOR_PROVIDER;
  model: string;
  qc: CampaignVideoQC;
  /** Present for shot-based fallback when FFmpeg stitch is not yet applied. */
  compositionStatus?: "completed" | "timeline_ready" | "pending_ffmpeg";
  timeline?: CommercialTimeline;
  shotVideos?: ShotVideoResult[];
  audioTracks?: AudioTrackReference[];
  manifest?: ProductionManifest;
  nativeResult?: CampaignVideoResult;
  /** Phase 8 Commercial QC report (accept | regenerate | manual_review). No quality score. */
  commercialQC?: import("../commercial-qc/types").CommercialQCReport;
  /** Phase 9: frontend-safe creative plan (from Commercial Director blueprint). */
  creativePlan?: import("../studio-mapper").CreativePlanSummary;
  createdAt: string;
}

export interface GenerateCampaignVideoInput {
  spec: CampaignGenerationSpec;
  forceRegenerate?: boolean;
  skipDownload?: boolean;
  skipStorage?: boolean;
  userId?: string;
}

export interface ProduceFinalCommercialInput {
  brief: CampaignBrief;
  generationVersion?: string;
  forceRegenerate?: boolean;
  generationMode?: CampaignGenerationMode;
  availableAssets?: AvailableCampaignAssets;
  /** When provided, skip director/planner. */
  blueprint?: CommercialBlueprintCore;
  shotPlan?: ShotPlan;
  skipDownload?: boolean;
  skipStorage?: boolean;
  concurrency?: number;
  userId?: string;
  /** Phase 8: run Commercial QC after generation (default true). */
  runCommercialQc?: boolean;
}

export interface CampaignExecutorOptions {
  videoProvider?: VideoProvider;
  director?: CommercialDirector;
  shotPlanner?: ShotPlanner;
  imageProvider?: ImageGenerationProvider;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  maxRetries?: number;
  log?: (event: string, payload: Record<string, unknown>) => void;
  /** Phase 8: inject visual analyzer (tests use mocks; omit for deterministic-only). */
  visualAnalyzer?: import("../commercial-qc/types").CommercialVisualAnalyzer;
  maxAutoRegenerations?: number;
}

export type CampaignExecutorErrorCode =
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_SPEC"
  | "NATIVE_GENERATION_FAILED"
  | "NATIVE_JOB_TIMEOUT"
  | "DOWNLOAD_FAILED"
  | "STORAGE_FAILED"
  | "QC_FAILED"
  | "FALLBACK_FAILED"
  | "UNSUPPORTED_MODE";

export class CampaignExecutorError extends Error {
  constructor(
    public readonly code: CampaignExecutorErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "CampaignExecutorError";
  }
}

/** Duration QC tolerance for native campaign videos (seconds). */
export const CAMPAIGN_VIDEO_DURATION_TOLERANCE_SECONDS = 2;
