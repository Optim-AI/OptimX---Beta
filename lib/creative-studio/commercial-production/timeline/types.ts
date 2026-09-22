import type { CampaignDurationSeconds } from "../campaign/campaign-duration";
import type { CommercialAspectRatio } from "../campaign/types";
import type { StoredAssetRef } from "../assets";
import type { TransitionType } from "../shot-planner/types";

export type TimelineTrackKind = "video" | "audio" | "music" | "sfx" | "text" | "overlay";

export interface TimelineClip {
  id: string;
  trackId: string;
  shotId?: string;
  asset?: StoredAssetRef;
  startSeconds: number;
  durationSeconds: number;
  trimInSeconds?: number;
  trimOutSeconds?: number;
  transitionIn?: TransitionType;
  transitionOut?: TransitionType;
}

export interface TimelineTrack {
  id: string;
  kind: TimelineTrackKind;
  clips: TimelineClip[];
}

export interface TimelineTextLayer {
  id: string;
  text: string;
  startSeconds: number;
  durationSeconds: number;
  position: "lower_third" | "center" | "top_third" | "full_width";
}

export interface TimelineOverlay {
  id: string;
  asset: StoredAssetRef;
  startSeconds: number;
  durationSeconds: number;
}

export interface CommercialTimeline {
  campaignId: string;
  duration: CampaignDurationSeconds;
  aspectRatio: CommercialAspectRatio;
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  transitions: Array<{ fromClipId: string; toClipId: string; type: TransitionType }>;
  overlays: TimelineOverlay[];
  music?: StoredAssetRef;
  soundEffects: StoredAssetRef[];
  textLayers: TimelineTextLayer[];
}

export interface CompositorInput {
  timeline: CommercialTimeline;
  outputFileName?: string;
}

export interface CompositorAccepted {
  jobId: string;
  status: "pending";
}

export interface CompositorResult {
  jobId: string;
  status: "succeeded" | "failed";
  output?: StoredAssetRef;
  failureReason?: string;
}

/**
 * Provider-independent compositor boundary.
 * Phase 8 implements FFmpeg. Phase 1 defines the contract only.
 */
export interface TimelineCompositor {
  compose(input: CompositorInput): Promise<CompositorAccepted>;
  getJob?(jobId: string): Promise<CompositorResult>;
}

export const COMPOSITOR_OPERATIONS = [
  "concatenate",
  "trim",
  "transition",
  "aspect_ratio",
  "crop",
  "overlay",
  "text",
  "music",
  "sound_effects",
  "volume",
  "fade",
  "encode",
] as const;

export type CompositorOperation = (typeof COMPOSITOR_OPERATIONS)[number];
