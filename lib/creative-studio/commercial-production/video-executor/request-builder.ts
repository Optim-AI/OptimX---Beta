/**
 * Build provider-agnostic VideoExecutionRequest from PreparedShotForVideo.
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { CommercialAspectRatio } from "../campaign/types";
import type { PreparedShotForVideo } from "../reference-engine/types";
import type { VideoProviderCapabilities } from "../video/providers/types";
import { buildVideoGenerationPrompt } from "./prompt-builder";
import { resolveVideoReferences } from "./reference-resolver";
import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
  VideoExecutorError,
  type VideoExecutionRequest,
} from "./types";

export function videoIdempotencyKey(input: {
  campaignId: string;
  shotId: string;
  generationVersion?: string;
  attempt?: number;
}): string {
  const version = input.generationVersion || "v1";
  const attempt = input.attempt ?? 0;
  return `${input.campaignId}:${input.shotId}:${version}:a${attempt}`;
}

/**
 * Map creative shot duration to a provider-accepted clip duration.
 * Does NOT mutate CommercialShot.durationSeconds.
 */
export function adaptProviderDuration(
  creativeDurationSeconds: number,
  caps: Pick<VideoProviderCapabilities, "minDurationSeconds" | "maxDurationSeconds">
): number {
  const n = Math.round(Number(creativeDurationSeconds) || 0);
  if (!Number.isFinite(n) || n <= 0) {
    throw new VideoExecutorError(
      "VIDEO_REQUEST_INVALID",
      `Invalid creative duration: ${creativeDurationSeconds}`
    );
  }
  return Math.max(caps.minDurationSeconds, Math.min(caps.maxDurationSeconds, n));
}

export function buildVideoExecutionRequest(input: {
  blueprint: CommercialBlueprintCore;
  prepared: PreparedShotForVideo;
  generationVersion?: string;
  attempt?: number;
  capabilities: VideoProviderCapabilities;
}): VideoExecutionRequest {
  const { blueprint, prepared, capabilities } = input;
  const shot = prepared.shot;
  const generationVersion = input.generationVersion || "v1";
  const attempt = input.attempt ?? 0;
  const campaignId = blueprint.campaignId;
  const shotId = shot.id;

  if (!campaignId || !shotId) {
    throw new VideoExecutorError("VIDEO_REQUEST_INVALID", "campaignId and shot.id are required");
  }

  if (prepared.providerRequirements.provider !== VIDEO_EXECUTOR_PROVIDER) {
    throw new VideoExecutorError(
      "VIDEO_PROVIDER_UNAVAILABLE",
      `Unsupported provider requirement: ${prepared.providerRequirements.provider}`,
      { required: prepared.providerRequirements.provider }
    );
  }

  if (prepared.providerRequirements.model !== VIDEO_EXECUTOR_MODEL) {
    throw new VideoExecutorError(
      "VIDEO_MODEL_UNAVAILABLE",
      `Unsupported model requirement: ${prepared.providerRequirements.model} (expected ${VIDEO_EXECUTOR_MODEL})`,
      { required: prepared.providerRequirements.model, expected: VIDEO_EXECUTOR_MODEL }
    );
  }

  const mode = prepared.generationMode;
  if (mode === "motion_graphics" || mode === "composited") {
    throw new VideoExecutorError(
      "UNSUPPORTED_GENERATION_MODE",
      `Mode ${mode} is deferred to compositor — do not build a Seedance request`,
      { mode }
    );
  }

  if (mode !== "image_to_video" && mode !== "text_to_video") {
    throw new VideoExecutorError(
      "UNSUPPORTED_GENERATION_MODE",
      `Unsupported generation mode: ${mode}`
    );
  }

  if (!prepared.readyForVideo && mode === "image_to_video") {
    throw new VideoExecutorError(
      "KEYFRAME_REQUIRED",
      prepared.blockedReason || `Shot ${shotId} is not ready for video`,
      { blockedReason: prepared.blockedReason }
    );
  }

  // Capability checks
  if (mode === "image_to_video" && !capabilities.imageToVideo) {
    throw new VideoExecutorError(
      "PROVIDER_CAPABILITY_MISMATCH",
      "Provider does not support image-to-video"
    );
  }
  if (mode === "text_to_video" && !capabilities.textToVideo) {
    throw new VideoExecutorError(
      "PROVIDER_CAPABILITY_MISMATCH",
      "Provider does not support text-to-video"
    );
  }

  const aspectRatio = blueprint.aspectRatio as CommercialAspectRatio;
  if (!capabilities.supportedAspectRatios.includes(aspectRatio)) {
    throw new VideoExecutorError(
      "PROVIDER_CAPABILITY_MISMATCH",
      `Aspect ratio ${aspectRatio} not supported by provider`,
      { aspectRatio, supported: capabilities.supportedAspectRatios }
    );
  }

  const refs = resolveVideoReferences(prepared);
  if (refs.missing.includes("product_reference")) {
    throw new VideoExecutorError(
      "REFERENCE_MISSING",
      `Product reference required for shot ${shotId} but none resolved`
    );
  }

  const creativeDurationSeconds = shot.durationSeconds;
  const providerDurationSeconds = adaptProviderDuration(creativeDurationSeconds, capabilities);

  const prompt = buildVideoGenerationPrompt({
    blueprint,
    shot,
    generationMode: mode,
  });

  const idempotencyKey = videoIdempotencyKey({
    campaignId,
    shotId,
    generationVersion,
    attempt,
  });

  const jobId = `cv_${campaignId}_${shotId}_${generationVersion}_a${attempt}`;

  return {
    campaignId,
    shotId,
    shot,
    generationMode: mode,
    keyframe: prepared.keyframe,
    references: prepared.references,
    prompt,
    creativeDurationSeconds,
    providerDurationSeconds,
    aspectRatio,
    generationVersion,
    attempt,
    idempotencyKey,
    jobId,
    providerMode: mode === "image_to_video" ? "image-to-video" : "text-to-video",
    startFrame: refs.startFrame,
    productReferences: refs.productReferences.length ? refs.productReferences : undefined,
    referenceImages: refs.referenceImages.length ? refs.referenceImages : undefined,
  };
}
