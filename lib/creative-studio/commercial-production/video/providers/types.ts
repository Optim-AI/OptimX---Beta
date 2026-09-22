import type { StoredAssetRef } from "../../assets";
import type { CommercialAspectRatio } from "../../campaign/types";
import type { GenerationStrategyId } from "../../generation/types";
import type { CompiledPrompt } from "../prompt/types";
import type { VideoProviderId } from "./ids";

export type { VideoProviderId } from "./ids";
export { VIDEO_PROVIDER_IDS, PRIMARY_VIDEO_PROVIDERS } from "./ids";

export type VideoGenerationMode =
  | "text-to-video"
  | "image-to-video"
  | "video-to-video"
  | "first-last-frame";

export type ProviderIntegrationStatus = "not_implemented" | "legacy_route" | "ready";

export type ProviderAvailabilityStatus =
  | "unavailable"
  | "credentials_missing"
  | "adapter_not_implemented"
  | "available";

export interface VideoProviderCapabilities {
  id: VideoProviderId;
  label: string;
  model: string;
  supportedDurationsSeconds: number[];
  minDurationSeconds: number;
  maxDurationSeconds: number;
  supportedAspectRatios: CommercialAspectRatio[];
  supportedResolutions: string[];
  textToVideo: boolean;
  imageToVideo: boolean;
  startFrame: boolean;
  endFrame: boolean;
  referenceImages: boolean;
  maxReferenceImages: number;
  cameraControl: boolean;
  audioSupport: boolean;
  generationSpeed: "fast" | "standard" | "slow";
  /** USD per output second when configured via env; undefined if unknown. */
  estimatedCostPerSecondUsd?: number;
  integrationStatus: ProviderIntegrationStatus;
}

export interface ProviderAvailability {
  id: VideoProviderId;
  status: ProviderAvailabilityStatus;
  credentialsConfigured: boolean;
  adapterImplemented: boolean;
  message: string;
}

export interface CostEstimate {
  currency: "USD";
  estimatedCostUsd?: number;
  durationSeconds: number;
  notes?: string;
}

export interface ProviderGenerateRequest {
  jobId: string;
  campaignId: string;
  shotId: string;
  mode: VideoGenerationMode;
  prompt: CompiledPrompt;
  durationSeconds: number;
  aspectRatio: CommercialAspectRatio;
  resolution?: string;
  generateAudio?: boolean;
  startFrame?: StoredAssetRef;
  endFrame?: StoredAssetRef;
  referenceImages?: StoredAssetRef[];
  productReferences?: StoredAssetRef[];
}

export interface ProviderGenerateAccepted {
  providerJobId: string;
  status: "submitted" | "pending";
  provider: VideoProviderId;
  model: string;
}

export type ProviderJobState = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export interface ProviderJobStatus {
  providerJobId: string;
  state: ProviderJobState;
  progress?: number;
  assetUrl?: string;
  failureReason?: string;
  actualCostUsd?: number;
}

export interface ProviderCostEstimateInput {
  durationSeconds: number;
  mode: VideoGenerationMode;
  resolution?: string;
  referenceImageCount?: number;
}

/**
 * Video generation provider. Commercial Director / Shot Planner never call a
 * vendor SDK. Adapters convert provider-agnostic requests into vendor payloads.
 *
 * generateVideo MUST return an accepted job, not a finished MP4.
 */
export interface VideoProvider {
  readonly id: VideoProviderId;
  getCapabilities(): VideoProviderCapabilities;
  generateVideo(request: ProviderGenerateRequest): Promise<ProviderGenerateAccepted>;
  getJob(providerJobId: string): Promise<ProviderJobStatus>;
  estimateVideoCost(request: ProviderCostEstimateInput): CostEstimate;
  estimateKeyframeCost?(request: ProviderCostEstimateInput): CostEstimate;
  checkAvailability(): Promise<ProviderAvailability> | ProviderAvailability;
}

/**
 * Maps a compiled prompt + shot requirements into a vendor request.
 * Implemented per provider in later phases — types only here.
 */
export interface ProviderAdapter<TVendorRequest> {
  readonly providerId: VideoProviderId;
  toVendorRequest(request: ProviderGenerateRequest): TVendorRequest;
}

export interface ProviderSelectionInput {
  strategy: GenerationStrategyId;
  durationSeconds: number;
  aspectRatio: CommercialAspectRatio;
  requiresStartFrame: boolean;
  requiresEndFrame: boolean;
  requiresReferenceImages: boolean;
  requiresAudio: boolean;
  preferredResolution?: string;
  preferredProviderId?: VideoProviderId;
  /** When true, skip providers whose adapter is not implemented. */
  requireLive?: boolean;
}

export interface ProviderSelectionResult {
  providerId: VideoProviderId;
  score: number;
  reasons: string[];
  capabilities: VideoProviderCapabilities;
}

export interface VideoProviderRegistration {
  id: VideoProviderId;
  capabilities: VideoProviderCapabilities;
  checkAvailability: () => ProviderAvailability;
  /**
   * Live factory. Absent until the provider adapter is implemented.
   * Must not return a stub that pretends to generate video.
   */
  createProvider?: () => VideoProvider;
}
