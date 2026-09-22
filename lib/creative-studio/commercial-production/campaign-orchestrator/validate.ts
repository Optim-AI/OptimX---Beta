/**
 * Production-level validation for CampaignProductionRun → Phase 7 handoff.
 */

import {
  CAMPAIGN_DURATION_TOLERANCE_SECONDS,
  isCampaignDurationSeconds,
  shotDurationsMatchCampaign,
} from "../campaign/campaign-duration";
import { VIDEO_EXECUTOR_MODEL, VIDEO_EXECUTOR_PROVIDER } from "../video-executor/types";
import { buildShotDependencyGraph } from "./dependencies";
import type {
  CampaignProductionRun,
  ProductionError,
} from "./types";

export interface ProductionValidationResult {
  ok: boolean;
  issues: ProductionError[];
}

export function validateProductionRun(run: CampaignProductionRun): ProductionValidationResult {
  const issues: ProductionError[] = [];
  const campaignId = run.campaignId;

  const push = (
    code: string,
    message: string,
    stage: string,
    shotId?: string
  ): void => {
    issues.push({
      code,
      message,
      stage,
      campaignId,
      shotId,
      retryable: false,
    });
  };

  if (!run.blueprint) {
    push("MANIFEST_VALIDATION_FAILED", "Blueprint missing", "validate");
  }
  if (!run.shotPlan) {
    push("MANIFEST_VALIDATION_FAILED", "ShotPlan missing", "validate");
  }

  const plan = run.shotPlan;
  const blueprint = run.blueprint;

  if (blueprint && !isCampaignDurationSeconds(blueprint.campaignDuration)) {
    push(
      "DURATION_MISMATCH",
      `Invalid campaign duration ${blueprint.campaignDuration}`,
      "validate"
    );
  }

  if (plan) {
    if (!isCampaignDurationSeconds(plan.campaignDuration)) {
      push("DURATION_MISMATCH", `Invalid plan duration ${plan.campaignDuration}`, "validate");
    }

    const durations = plan.shots.map((s) => s.durationSeconds);
    if (!shotDurationsMatchCampaign(durations, plan.campaignDuration, CAMPAIGN_DURATION_TOLERANCE_SECONDS)) {
      push(
        "DURATION_MISMATCH",
        `Shot durations sum does not match campaign ${plan.campaignDuration}s ±${CAMPAIGN_DURATION_TOLERANCE_SECONDS}s`,
        "validate"
      );
    }

    const ids = plan.shots.map((s) => s.id);
    if (new Set(ids).size !== ids.length) {
      push("MANIFEST_VALIDATION_FAILED", "Duplicate shot ids in ShotPlan", "validate");
    }

    // Every planned shot has a production state
    for (const shot of plan.shots) {
      if (!run.shots.some((s) => s.shotId === shot.id)) {
        push(
          "MANIFEST_VALIDATION_FAILED",
          `Missing production state for shot ${shot.id}`,
          "validate",
          shot.id
        );
      }
    }

    try {
      buildShotDependencyGraph(plan);
    } catch (e) {
      push(
        "DEPENDENCY_GRAPH_INVALID",
        e instanceof Error ? e.message : String(e),
        "validate"
      );
    }
  }

  for (const state of run.shots) {
    if (state.status === "failed" || state.status === "blocked") {
      push(
        state.errors?.[0]?.code || "PRODUCTION_INCOMPLETE",
        state.errors?.[0]?.message || `Shot ${state.shotId} is ${state.status}`,
        "validate",
        state.shotId
      );
      continue;
    }

    if (state.status === "deferred") {
      // compositor-owned — OK
      continue;
    }

    const mode = state.generationMode || state.preparedShot?.generationMode;
    if (mode === "image_to_video") {
      if (!state.keyframe || state.keyframe.status !== "approved") {
        push(
          "REFERENCE_GENERATION_FAILED",
          `Keyframe-first shot ${state.shotId} missing approved keyframe`,
          "validate",
          state.shotId
        );
      } else if (!state.keyframe.url && !state.keyframe.assetId) {
        push(
          "REFERENCE_GENERATION_FAILED",
          `Approved keyframe for ${state.shotId} has no asset`,
          "validate",
          state.shotId
        );
      }
    }

    if (mode === "image_to_video" || mode === "text_to_video") {
      if (state.status !== "video_ready" || state.video?.status !== "completed") {
        push(
          "VIDEO_GENERATION_FAILED",
          `Video-producing shot ${state.shotId} is not completed`,
          "validate",
          state.shotId
        );
      } else {
        if (state.video.provider !== VIDEO_EXECUTOR_PROVIDER) {
          push(
            "VIDEO_GENERATION_FAILED",
            `Unexpected provider ${state.video.provider}`,
            "validate",
            state.shotId
          );
        }
        if (
          state.video.model !== VIDEO_EXECUTOR_MODEL &&
          !String(state.video.model).includes("seedance")
        ) {
          push(
            "VIDEO_GENERATION_FAILED",
            `Unexpected model ${state.video.model}`,
            "validate",
            state.shotId
          );
        }
        if (!state.video.videoAsset?.url) {
          push(
            "VIDEO_GENERATION_FAILED",
            `Completed video for ${state.shotId} has no URL`,
            "validate",
            state.shotId
          );
        }
      }
    }
  }

  return { ok: issues.length === 0, issues };
}
