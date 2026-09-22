/**
 * Deterministic QC for native campaign videos.
 * visualInspectionAvailable is always false in Phase 7.
 */

import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
} from "../video-executor/types";
import { isCampaignDurationSeconds } from "../campaign/campaign-duration";
import type { CampaignGenerationSpec } from "../campaign-compiler/types";
import {
  CAMPAIGN_VIDEO_DURATION_TOLERANCE_SECONDS,
  type CampaignVideoQC,
  type CampaignVideoResult,
} from "./types";

export function runDeterministicCampaignVideoQc(input: {
  spec: CampaignGenerationSpec;
  result: Pick<
    CampaignVideoResult,
    | "campaignId"
    | "provider"
    | "model"
    | "duration"
    | "aspectRatio"
    | "generationMode"
    | "status"
    | "videoUrl"
    | "videoAssetId"
    | "providerJobId"
  >;
  reportedDurationSeconds?: number;
}): CampaignVideoQC {
  const issues: CampaignVideoQC["issues"] = [];
  const checksPerformed = [
    "video_exists",
    "campaign_id",
    "provider",
    "model",
    "duration_requested",
    "duration_output",
    "aspect_ratio",
    "generation_mode",
    "job_completed",
  ];

  if (input.result.status !== "completed") {
    issues.push({
      check: "job_completed",
      severity: "error",
      message: `Expected completed, got ${input.result.status}`,
    });
  }
  if (!input.result.videoUrl?.trim() || !input.result.videoAssetId?.trim()) {
    issues.push({
      check: "video_exists",
      severity: "error",
      message: "Missing video URL or asset id",
    });
  }
  if (input.result.campaignId !== input.spec.campaignId) {
    issues.push({
      check: "campaign_id",
      severity: "error",
      message: "Campaign id mismatch",
    });
  }
  if (input.result.provider !== VIDEO_EXECUTOR_PROVIDER) {
    issues.push({
      check: "provider",
      severity: "error",
      message: `Expected provider ${VIDEO_EXECUTOR_PROVIDER}`,
    });
  }
  if (
    input.result.model !== VIDEO_EXECUTOR_MODEL &&
    !String(input.result.model).includes("seedance")
  ) {
    issues.push({
      check: "model",
      severity: "error",
      message: `Expected model ${VIDEO_EXECUTOR_MODEL}`,
    });
  }
  if (!isCampaignDurationSeconds(input.result.duration)) {
    issues.push({
      check: "duration_requested",
      severity: "error",
      message: `Duration must be 15 or 30, got ${input.result.duration}`,
    });
  }
  if (input.result.duration !== input.spec.duration) {
    issues.push({
      check: "duration_requested",
      severity: "error",
      message: `Result duration ${input.result.duration} != spec ${input.spec.duration}`,
    });
  }
  const reported = input.reportedDurationSeconds ?? input.result.duration;
  if (
    Math.abs(reported - input.spec.duration) > CAMPAIGN_VIDEO_DURATION_TOLERANCE_SECONDS
  ) {
    issues.push({
      check: "duration_output",
      severity: "error",
      message: `Output duration ${reported}s outside ±${CAMPAIGN_VIDEO_DURATION_TOLERANCE_SECONDS}s of ${input.spec.duration}s`,
    });
  }
  if (input.result.aspectRatio !== input.spec.aspectRatio) {
    issues.push({
      check: "aspect_ratio",
      severity: "error",
      message: `Aspect ratio mismatch: ${input.result.aspectRatio} vs ${input.spec.aspectRatio}`,
    });
  }
  if (input.result.generationMode !== "native_continuous") {
    issues.push({
      check: "generation_mode",
      severity: "error",
      message: "Expected native_continuous",
    });
  }
  if (!input.result.providerJobId) {
    issues.push({
      check: "job_completed",
      severity: "error",
      message: "Missing providerJobId",
    });
  }

  issues.push({
    check: "requires_visual_qc",
    severity: "info",
    message: "AI visual campaign inspection is not implemented in Phase 7",
  });

  return {
    passed: !issues.some((i) => i.severity === "error"),
    issues,
    checksPerformed,
    visualInspectionAvailable: false,
    durationToleranceSeconds: CAMPAIGN_VIDEO_DURATION_TOLERANCE_SECONDS,
  };
}
