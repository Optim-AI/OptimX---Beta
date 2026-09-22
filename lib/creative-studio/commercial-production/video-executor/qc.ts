/**
 * Deterministic shot-video QC.
 * Does NOT pretend to visually inspect video frames.
 */

import type { CommercialShot } from "../shot-planner/types";
import type {
  ShotVideoQCIssue,
  ShotVideoQCResult,
  ShotVideoResult,
  VideoExecutionRequest,
  VideoVisualQC,
} from "./types";

export class UnavailableVideoVisualQC implements VideoVisualQC {
  readonly available = false;
  async inspect(): Promise<{ issues: ShotVideoQCIssue[]; notes: string[] }> {
    return {
      issues: [
        {
          check: "requires_visual_qc",
          severity: "info",
          message: "AI visual video inspection is not implemented in Phase 5",
          requiresVisualQc: true,
        },
      ],
      notes: ["visualInspectionAvailable: false"],
    };
  }
}

const DURATION_TOLERANCE_SECONDS = 2;

export function runDeterministicVideoQc(input: {
  shot: CommercialShot;
  request: VideoExecutionRequest;
  result: Pick<
    ShotVideoResult,
    | "status"
    | "videoAsset"
    | "provider"
    | "model"
    | "campaignId"
    | "shotId"
    | "sourceKeyframeAssetId"
    | "generationMode"
    | "creativeDurationSeconds"
    | "providerDurationSeconds"
  >;
}): ShotVideoQCResult {
  const issues: ShotVideoQCIssue[] = [];
  const checksPerformed: string[] = [];
  const checksDeferredToVisualQc: string[] = [];

  checksPerformed.push(
    "status_completed",
    "video_exists",
    "campaign_shot_ids",
    "provider_model",
    "duration_tolerance",
    "generation_mode"
  );

  if (input.result.status !== "completed") {
    issues.push({
      check: "status_completed",
      severity: "error",
      message: `Expected completed status, got ${input.result.status}`,
    });
  }

  if (!input.result.videoAsset?.url?.trim()) {
    issues.push({
      check: "video_exists",
      severity: "error",
      message: "Completed result has no video URL",
    });
  }

  const mime = input.result.videoAsset?.mimeType;
  if (mime && !/^video\//i.test(mime) && mime !== "application/octet-stream") {
    issues.push({
      check: "mime_type",
      severity: "warning",
      message: `Unexpected mime type: ${mime}`,
    });
  }
  checksPerformed.push("mime_type");

  if (input.result.campaignId !== input.request.campaignId || input.result.shotId !== input.request.shotId) {
    issues.push({
      check: "campaign_shot_ids",
      severity: "error",
      message: "Campaign/shot id mismatch on result",
    });
  }

  if (input.result.provider !== "runway") {
    issues.push({
      check: "provider_model",
      severity: "error",
      message: `Unexpected provider: ${input.result.provider}`,
    });
  }

  if (input.result.model !== "seedance2_5" && !String(input.result.model).includes("seedance")) {
    issues.push({
      check: "provider_model",
      severity: "warning",
      message: `Unexpected model: ${input.result.model}`,
    });
  }

  const reportedDuration =
    input.result.videoAsset?.durationSeconds ?? input.result.providerDurationSeconds;
  const expected = input.result.providerDurationSeconds;
  if (
    reportedDuration != null &&
    Math.abs(reportedDuration - expected) > DURATION_TOLERANCE_SECONDS
  ) {
    issues.push({
      check: "duration_tolerance",
      severity: "error",
      message: `Duration ${reportedDuration}s outside ±${DURATION_TOLERANCE_SECONDS}s of provider target ${expected}s`,
    });
  }

  if (input.request.generationMode === "image_to_video") {
    checksPerformed.push("source_keyframe");
    if (!input.result.sourceKeyframeAssetId) {
      issues.push({
        check: "source_keyframe",
        severity: "error",
        message: "image_to_video result missing sourceKeyframeAssetId",
      });
    }
  }

  // Artifact risks cannot be verified without visual inspection
  for (const risk of input.shot.artifactRisks || []) {
    checksDeferredToVisualQc.push(risk.id || risk.risk);
  }
  if (input.shot.artifactRisk) {
    checksDeferredToVisualQc.push("artifact_risk_summary");
  }
  if (checksDeferredToVisualQc.length) {
    issues.push({
      check: "requires_visual_qc",
      severity: "info",
      message: "Artifact risks require visual QC (not available in Phase 5)",
      requiresVisualQc: true,
    });
  }

  const hasError = issues.some((i) => i.severity === "error");
  return {
    passed: !hasError,
    issues,
    checksPerformed,
    checksDeferredToVisualQc,
    visualInspectionAvailable: false,
  };
}
