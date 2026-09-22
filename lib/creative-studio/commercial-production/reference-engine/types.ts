/**
 * Reference / Keyframe Engine — Phase 4 types.
 *
 * Does NOT import RunwayProvider or runway-client.
 * Active image provider for keyframes: Nano Banana (gemini-2.5-flash-image).
 */

import type { StoredAssetRef } from "../assets";
import type { CommercialAspectRatio } from "../campaign/types";
import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { CommercialShot, ReferenceStrategyType } from "../shot-planner/types";
import type { GenerationStrategyId } from "../generation/types";

export type ResolvedReferenceStrategy =
  | "keyframe_first"
  | "product_reference"
  | "character_reference"
  | "previous_shot_reference"
  | "multi_reference"
  | "text_to_video"
  | "motion_graphics"
  | "composited";

export type ReferenceAssetType =
  | "product"
  | "character"
  | "previous_shot"
  | "brand"
  | "other";

export interface ReferenceAsset {
  type: ReferenceAssetType;
  assetId: string;
  url: string;
  mimeType?: string;
  dataUrl?: string;
}

export interface KeyframeSpecification {
  campaignId: string;
  shotId: string;
  purpose: string;
  aspectRatio: CommercialAspectRatio | string;
  composition: {
    framing: string;
    subjectPlacement: string;
    foreground?: string;
    midground?: string;
    background?: string;
    negativeSpace?: string;
  };
  camera: {
    shotType: string;
    lens?: string;
    angle?: string;
    perspective?: string;
  };
  lighting: {
    style: string;
    direction?: string;
    quality?: string;
    colorTemperature?: string;
  };
  environment: {
    location: string;
    setting: string;
    atmosphere: string;
  };
  subjects: Array<{
    description: string;
    pose?: string;
    expression?: string;
    wardrobe?: string;
  }>;
  product: {
    required: boolean;
    visibility: string;
    placement?: string;
    state?: string;
    interaction?: string;
    referenceAssetIds?: string[];
  };
  visualTreatment: {
    style: string;
    colorLanguage: string;
    texture?: string;
    depth?: string;
  };
  continuity: {
    previousShotIds?: string[];
    mustMatch?: string[];
    mustMatchDimensions?: string[];
    characterContinuity?: string;
  };
  artifactAvoidance: {
    risks: string[];
    instructions: string[];
  };
  imageGenerationPrompt: string;
  negativePrompt?: string;
  resolvedStrategy: ResolvedReferenceStrategy;
  shotPlannerStrategyType?: ReferenceStrategyType;
  generationStrategyId: GenerationStrategyId;
}

export type KeyframeLifecycleStatus =
  | "pending"
  | "generated"
  | "approved"
  | "rejected"
  | "failed"
  | "skipped";

export type KeyframeQCCheckId =
  | "image_exists"
  | "asset_readable"
  | "aspect_ratio"
  | "specification_complete"
  | "product_reference_provided"
  | "product_visibility_declared"
  | "required_references_resolved"
  | "previous_shot_dependency"
  | "character_reference_declared"
  | "requires_visual_qc";

export interface KeyframeQCIssue {
  check: KeyframeQCCheckId | string;
  severity: "info" | "warning" | "error";
  message: string;
  /** True when this check cannot be verified without a vision model. */
  requiresVisualQc?: boolean;
}

export interface KeyframeQCResult {
  passed: boolean;
  score: number;
  issues: KeyframeQCIssue[];
  visualInspectionAvailable: boolean;
  checksPerformed: string[];
  checksDeferredToVisualQc: string[];
}

export interface KeyframeAttemptRecord {
  attempt: number;
  status: KeyframeLifecycleStatus;
  prompt: string;
  provider?: string;
  model?: string;
  assetId?: string;
  url?: string;
  qc?: KeyframeQCResult;
  errors?: string[];
  generatedAt: string;
  durationMs?: number;
}

export interface KeyframeResult {
  shotId: string;
  campaignId: string;
  keyframeId: string;
  status: KeyframeLifecycleStatus;
  keyframeRequired: boolean;
  skippedReason?: string;
  assetId?: string;
  url?: string;
  storagePath?: string;
  provider?: string;
  model?: string;
  generationPrompt?: string;
  negativePrompt?: string;
  referenceAssetIds: string[];
  specification?: KeyframeSpecification;
  metadata: {
    width?: number;
    height?: number;
    aspectRatio?: string;
    generationTimeMs?: number;
    attempt: number;
    idempotencyKey: string;
    visualInspectionAvailable: boolean;
  };
  qc?: KeyframeQCResult;
  attempts: KeyframeAttemptRecord[];
  errors?: string[];
  commercialKeyframe?: import("../keyframes/types").CommercialKeyframe;
}

export type VideoGenerationMode =
  | "image_to_video"
  | "text_to_video"
  | "motion_graphics"
  | "composited";

/**
 * Handoff to Phase 5 video production.
 * Reference Engine must NOT call Runway — only prepare this object.
 */
export interface PreparedShotForVideo {
  shot: CommercialShot;
  keyframe?: KeyframeResult;
  references: ReferenceAsset[];
  generationMode: VideoGenerationMode;
  providerRequirements: {
    provider: "runway";
    model: "seedance2_5";
  };
  readyForVideo: boolean;
  blockedReason?: string;
}

export interface AvailableCampaignAssets {
  productImages?: StoredAssetRef[];
  brandLogo?: StoredAssetRef;
  characterReferences?: StoredAssetRef[];
  /** Previously approved keyframes keyed by shot id. */
  approvedKeyframesByShotId?: Record<string, KeyframeResult>;
}

export interface GenerateCommercialKeyframeInput {
  blueprint: CommercialBlueprintCore;
  shot: CommercialShot;
  availableAssets?: AvailableCampaignAssets;
  /** Force regenerate even if approved keyframe exists. */
  forceRegenerate?: boolean;
  maxAttempts?: number;
  /** Optional user id for storage path namespacing. */
  userId?: string;
  /** Skip Supabase upload (tests). */
  skipStorage?: boolean;
}

export interface GenerateCommercialKeyframesInput {
  blueprint: CommercialBlueprintCore;
  shots: CommercialShot[];
  availableAssets?: AvailableCampaignAssets;
  forceRegenerate?: boolean;
  maxAttempts?: number;
  userId?: string;
  skipStorage?: boolean;
  concurrency?: number;
}

export type ReferenceEngineErrorCode =
  | "REFERENCE_MISSING"
  | "PRODUCT_REFERENCE_MISSING"
  | "CHARACTER_REFERENCE_MISSING"
  | "PREVIOUS_SHOT_REFERENCE_MISSING"
  | "IMAGE_GENERATION_FAILED"
  | "IMAGE_STORAGE_FAILED"
  | "KEYFRAME_QC_FAILED"
  | "INVALID_SHOT"
  | "INVALID_SPECIFICATION"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED";

export class ReferenceEngineError extends Error {
  constructor(
    public readonly code: ReferenceEngineErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ReferenceEngineError";
  }
}

export interface ImageGenerationProviderRequest {
  purpose: "commercial_keyframe";
  campaignId: string;
  shotId: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: string;
  referenceImages?: Array<{
    type: ReferenceAssetType;
    assetId: string;
    url?: string;
    dataUrl?: string;
    instruction: string;
  }>;
  metadata: {
    strategy: ResolvedReferenceStrategy;
    productReferenceRequired: boolean;
    keyframeRequired: boolean;
    idempotencyKey: string;
    attempt: number;
  };
}

export interface ImageGenerationProviderResult {
  buffer: Buffer;
  dataUrl: string;
  provider: string;
  model: string;
  aspectRatio: string;
  width?: number;
  height?: number;
}

export interface ImageGenerationProvider {
  readonly id: string;
  readonly modelId: string;
  checkAvailability(): { available: boolean; message: string };
  generateImage(request: ImageGenerationProviderRequest): Promise<ImageGenerationProviderResult>;
}

export interface KeyframeVisualQC {
  readonly available: boolean;
  inspect(
    image: KeyframeResult,
    specification: KeyframeSpecification
  ): Promise<{ issues: KeyframeQCIssue[]; notes: string[] }>;
}

export interface ReferenceEngineOptions {
  imageProvider?: ImageGenerationProvider;
  visualQc?: KeyframeVisualQC;
  maxAttempts?: number;
  log?: (event: string, payload: Record<string, unknown>) => void;
}
