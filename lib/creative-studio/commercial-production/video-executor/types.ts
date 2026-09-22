/**
 * Video Executor — Phase 5 types.
 *
 * Consumes Phase 4 PreparedShotForVideo.
 * Calls VideoProvider (Runway → Seedance 2.5). Does NOT invent a second Runway client.
 * Does NOT implement final 15s/30s compositor.
 */

import type { CommercialAspectRatio } from "../campaign/types";
import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { CommercialShot } from "../shot-planner/types";
import type { StoredAssetRef } from "../assets";
import type {
  KeyframeResult,
  PreparedShotForVideo,
  ReferenceAsset,
  VideoGenerationMode,
} from "../reference-engine/types";
import type {
  CostEstimate,
  ProviderGenerateAccepted,
  ProviderJobStatus,
  VideoProvider,
} from "../video/providers/types";
import type { CompiledPrompt } from "../video/prompt/types";
import { RUNWAY_ACTIVE_MODEL, RUNWAY_PROVIDER_ID } from "../video/providers/runway";

/** Canonical active stack identifiers (do not scatter alternate spellings). */
export const VIDEO_EXECUTOR_PROVIDER = RUNWAY_PROVIDER_ID;
export const VIDEO_EXECUTOR_MODEL = RUNWAY_ACTIVE_MODEL; // seedance2_5

export type ShotVideoStatus =
  | "queued"
  | "submitted"
  | "processing"
  | "completed"
  | "failed"
  | "deferred"
  | "cancelled";

export type VideoExecutorErrorCode =
  | "VIDEO_PROVIDER_UNAVAILABLE"
  | "VIDEO_MODEL_UNAVAILABLE"
  | "VIDEO_REQUEST_INVALID"
  | "KEYFRAME_REQUIRED"
  | "KEYFRAME_INVALID"
  | "REFERENCE_MISSING"
  | "VIDEO_JOB_FAILED"
  | "VIDEO_JOB_TIMEOUT"
  | "VIDEO_DOWNLOAD_FAILED"
  | "VIDEO_STORAGE_FAILED"
  | "VIDEO_QC_FAILED"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "DUPLICATE_GENERATION"
  | "UNSUPPORTED_GENERATION_MODE"
  | "PROVIDER_CAPABILITY_MISMATCH";

export class VideoExecutorError extends Error {
  constructor(
    public readonly code: VideoExecutorErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "VideoExecutorError";
  }
}

export interface VideoAssetRef {
  assetId: string;
  url: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  mimeType?: string;
  storagePath?: string;
  bytes?: number;
  delivery?: "storage" | "inline" | "provider_url";
}

export interface ShotVideoQCIssue {
  check: string;
  severity: "error" | "warning" | "info";
  message: string;
  requiresVisualQc?: boolean;
}

export interface ShotVideoQCResult {
  passed: boolean;
  issues: ShotVideoQCIssue[];
  checksPerformed: string[];
  checksDeferredToVisualQc: string[];
  visualInspectionAvailable: boolean;
}

export interface ShotVideoResult {
  campaignId: string;
  shotId: string;
  status: ShotVideoStatus;
  provider: typeof VIDEO_EXECUTOR_PROVIDER;
  model: typeof VIDEO_EXECUTOR_MODEL | string;
  generationMode: VideoGenerationMode;
  jobId?: string;
  providerJobId?: string;
  videoAsset?: VideoAssetRef;
  sourceKeyframeAssetId?: string;
  prompt: string;
  compiledPrompt?: CompiledPrompt;
  references: string[];
  creativeDurationSeconds: number;
  providerDurationSeconds: number;
  aspectRatio: CommercialAspectRatio | string;
  artifactRisks: string[];
  estimatedCost?: CostEstimate;
  actualCostUsd?: number;
  metadata: {
    generationVersion: string;
    attempt: number;
    startedAt?: string;
    completedAt?: string;
    elapsedMs?: number;
    hasKeyframe: boolean;
    referenceCount: number;
    deferredReason?: string;
    handledByCompositor?: boolean;
    idempotencyKey: string;
  };
  qc?: ShotVideoQCResult;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Normalized production request built from PreparedShotForVideo.
 * Provider-agnostic; RunwayProvider owns vendor translation.
 */
export interface VideoExecutionRequest {
  campaignId: string;
  shotId: string;
  shot: CommercialShot;
  generationMode: VideoGenerationMode;
  keyframe?: KeyframeResult;
  references: ReferenceAsset[];
  prompt: CompiledPrompt;
  creativeDurationSeconds: number;
  providerDurationSeconds: number;
  aspectRatio: CommercialAspectRatio;
  generationVersion: string;
  attempt: number;
  idempotencyKey: string;
  jobId: string;
  /** Provider mode using Phase 1 hyphenated ids. */
  providerMode: "image-to-video" | "text-to-video";
  startFrame?: StoredAssetRef;
  productReferences?: StoredAssetRef[];
  referenceImages?: StoredAssetRef[];
}

export interface ResolvedVideoReferences {
  startFrame?: StoredAssetRef;
  productReferences: StoredAssetRef[];
  characterReferences: StoredAssetRef[];
  previousShotReferences: StoredAssetRef[];
  referenceImages: StoredAssetRef[];
  sourceKeyframeAssetId?: string;
  missing: string[];
}

export interface GenerateCommercialShotVideoInput {
  blueprint: CommercialBlueprintCore;
  prepared: PreparedShotForVideo;
  generationVersion?: string;
  forceRegenerate?: boolean;
  /** Skip download/storage (tests / keep provider URL). */
  skipDownload?: boolean;
  skipStorage?: boolean;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
  userId?: string;
}

export interface GenerateCommercialShotVideosInput {
  blueprint: CommercialBlueprintCore;
  preparedShots: PreparedShotForVideo[];
  generationVersion?: string;
  forceRegenerate?: boolean;
  skipDownload?: boolean;
  skipStorage?: boolean;
  concurrency?: number;
  userId?: string;
}

export interface VideoExecutorOptions {
  videoProvider?: VideoProvider;
  maxRetries?: number;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  log?: (event: string, payload: Record<string, unknown>) => void;
}

export interface VideoVisualQC {
  readonly available: boolean;
  inspect(
    video: ShotVideoResult,
    shot: CommercialShot
  ): Promise<{ issues: ShotVideoQCIssue[]; notes: string[] }>;
}

export type { PreparedShotForVideo, KeyframeResult, ReferenceAsset, VideoGenerationMode };
export type { ProviderGenerateAccepted, ProviderJobStatus, VideoProvider };
