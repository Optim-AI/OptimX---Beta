/**
 * Campaign Production Compiler — Phase 7 types.
 *
 * Converts Blueprint + ShotPlan + approved references into a campaign-level
 * Seedance 2.5 generation request. Does NOT call Runway.
 */

import type { CampaignDurationSeconds } from "../campaign/campaign-duration";
import type { CommercialAspectRatio } from "../campaign/types";
import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { ShotPlan } from "../shot-planner/types";
import type { AvailableCampaignAssets, KeyframeResult } from "../reference-engine/types";
import type { StoredAssetRef } from "../assets";
import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
} from "../video-executor/types";

export type CampaignGenerationMode = "native_continuous" | "shot_based_fallback";

export type CampaignReferencePurpose =
  | "product"
  | "character"
  | "environment"
  | "style"
  | "continuity"
  | "keyframe";

export interface CampaignReferenceAsset {
  purpose: CampaignReferencePurpose;
  assetId: string;
  url: string;
  mimeType?: string;
  priority: number;
  required: boolean;
  source: "product_image" | "brand_logo" | "character" | "keyframe";
}

export interface CampaignGenerationSpec {
  campaignId: string;
  generationVersion: string;
  duration: CampaignDurationSeconds;
  aspectRatio: CommercialAspectRatio;
  generationMode: CampaignGenerationMode;
  provider: typeof VIDEO_EXECUTOR_PROVIDER;
  model: typeof VIDEO_EXECUTOR_MODEL;
  creativeConcept: {
    title: string;
    coreIdea: string;
    creativeConcept: string;
    emotionalDirection: string;
    oneLinePitch: string;
  };
  visualTreatment: {
    visualStyle: string;
    colorLanguage: string;
    lighting: string;
    cameraLanguage: string;
    motionLanguage: string;
    environment: string;
    texture?: string;
    pacing?: string;
  };
  narrative: {
    storyStructure: string;
    pacing: string;
    heroMomentSeconds?: number;
  };
  visualBeats: Array<{
    id: string;
    purpose: string;
    timestampStartSeconds: number;
    timestampEndSeconds: number;
    emotion?: string;
    intent?: string;
    productVisible?: boolean;
  }>;
  editorialPlan: {
    storyStructure: string;
    pacing: string;
  };
  productRequirements: {
    name: string;
    visibilityRequirements: string;
    firstAppearanceSeconds?: number;
    preservePackaging: boolean;
  };
  brandRequirements: {
    name: string;
    message: string;
    constraints: string[];
  };
  platformRequirements: {
    aspectRatio: CommercialAspectRatio;
    firstFrameHook: string;
    ctaStrategy?: string;
  };
  continuityRequirements: string[];
  artifactRisks: string[];
  /** Campaign-level Seedance prompt — one coherent commercial. */
  campaignPrompt: string;
  negativePrompt?: string;
  referenceAssets: CampaignReferenceAsset[];
  omittedReferences: Array<{ assetId: string; purpose: string; reason: string }>;
  diagnostics: {
    shotCount: number;
    beatCount: number;
    referenceCount: number;
    maxReferencesAllowed: number;
    usesProductReference: boolean;
  };
}

export interface CompileCampaignGenerationInput {
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
  availableAssets?: AvailableCampaignAssets;
  /** Approved keyframes from Phase 4, keyed by shot id. */
  approvedKeyframesByShotId?: Record<string, KeyframeResult>;
  generationVersion?: string;
  generationMode?: CampaignGenerationMode;
  /** Override provider reference cap (default from Runway capabilities). */
  maxReferenceImages?: number;
}

export type CampaignCompilerErrorCode =
  | "INVALID_BLUEPRINT"
  | "INVALID_SHOT_PLAN"
  | "UNSUPPORTED_DURATION"
  | "MISSING_PRODUCT_REFERENCE"
  | "EMPTY_CREATIVE"
  | "COMPILATION_FAILED";

export class CampaignCompilerError extends Error {
  constructor(
    public readonly code: CampaignCompilerErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "CampaignCompilerError";
  }
}

export type { CommercialBlueprintCore, ShotPlan, AvailableCampaignAssets, StoredAssetRef };
