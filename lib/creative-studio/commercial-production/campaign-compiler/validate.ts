/**
 * Validate CampaignGenerationSpec before provider submission.
 */

import { isCampaignDurationSeconds } from "../campaign/campaign-duration";
import { VIDEO_EXECUTOR_MODEL, VIDEO_EXECUTOR_PROVIDER } from "../video-executor/types";
import type { CampaignGenerationSpec } from "./types";
import { CampaignCompilerError } from "./types";

export interface CampaignSpecValidationResult {
  ok: boolean;
  issues: string[];
}

export function validateCampaignGenerationSpec(
  spec: CampaignGenerationSpec
): CampaignSpecValidationResult {
  const issues: string[] = [];

  if (!spec.campaignId?.trim()) issues.push("campaignId required");
  if (!isCampaignDurationSeconds(spec.duration)) {
    issues.push(`Unsupported duration ${spec.duration} (expected 15 or 30)`);
  }
  if (!spec.aspectRatio) issues.push("aspectRatio required");
  if (!spec.campaignPrompt?.trim() || spec.campaignPrompt.length < 40) {
    issues.push("campaignPrompt too short or missing");
  }
  if (spec.provider !== VIDEO_EXECUTOR_PROVIDER) {
    issues.push(`provider must be ${VIDEO_EXECUTOR_PROVIDER}`);
  }
  if (spec.model !== VIDEO_EXECUTOR_MODEL) {
    issues.push(`model must be ${VIDEO_EXECUTOR_MODEL}`);
  }
  if (!spec.creativeConcept?.title || !spec.creativeConcept?.creativeConcept) {
    issues.push("creativeConcept incomplete");
  }
  if (!spec.visualBeats?.length) {
    issues.push("visualBeats required");
  }
  if (spec.generationMode === "native_continuous") {
    if (spec.diagnostics.maxReferencesAllowed < 1) {
      issues.push("maxReferencesAllowed invalid");
    }
  }

  return { ok: issues.length === 0, issues };
}

export function assertCampaignGenerationSpec(spec: CampaignGenerationSpec): void {
  const result = validateCampaignGenerationSpec(spec);
  if (!result.ok) {
    throw new CampaignCompilerError(
      "COMPILATION_FAILED",
      `CampaignGenerationSpec invalid: ${result.issues.join("; ")}`,
      { issues: result.issues }
    );
  }
}
