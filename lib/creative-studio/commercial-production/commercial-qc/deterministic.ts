/**
 * Deterministic Commercial QC — no AI.
 * Validates technical/production requirements against FinalCommercial + blueprint/manifest.
 */

import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
} from "../video-executor/types";
import { isCampaignDurationSeconds } from "../campaign/campaign-duration";
import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { ShotPlan } from "../shot-planner/types";
import type { ProductionManifest } from "../campaign-orchestrator/types";
import type { FinalCommercial } from "../campaign-executor/types";
import type { AvailableCampaignAssets } from "../reference-engine/types";
import type { DeterministicCheck, DeterministicQCResult } from "./types";

const DURATION_TOLERANCE_SECONDS = 2;

export interface DeterministicQCInput {
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
  finalCommercial: FinalCommercial;
  manifest?: ProductionManifest;
  availableAssets?: AvailableCampaignAssets;
}

function check(
  id: string,
  passed: boolean,
  message: string,
  severity: DeterministicCheck["severity"] = "error",
  expected?: string | number | boolean,
  actual?: string | number | boolean
): DeterministicCheck {
  return { check: id, passed, severity, message, expected, actual };
}

/**
 * Hard failures that make visual analysis pointless (missing video, failed status, etc.).
 */
function isHardFailure(checks: DeterministicCheck[]): boolean {
  const hardIds = new Set([
    "video_exists",
    "generation_status",
    "campaign_id",
  ]);
  return checks.some((c) => !c.passed && hardIds.has(c.check) && c.severity !== "info");
}

export function runDeterministicCommercialQc(
  input: DeterministicQCInput
): DeterministicQCResult {
  const { blueprint, shotPlan, finalCommercial: fc, manifest, availableAssets } =
    input;
  const checks: DeterministicCheck[] = [];

  // Video asset present
  const hasVideo =
    Boolean(fc.videoUrl?.trim()) && Boolean(fc.videoAssetId?.trim());
  checks.push(
    check(
      "video_exists",
      hasVideo,
      hasVideo ? "Final video asset present" : "Missing video URL or asset id",
      "critical",
      true,
      hasVideo
    )
  );

  // Generation / production status
  const nativeStatus = fc.nativeResult?.status;
  const statusOk =
    fc.productionMode === "shot_based_composed"
      ? fc.compositionStatus === "completed" ||
        fc.compositionStatus === "timeline_ready"
      : nativeStatus === "completed" || (!nativeStatus && hasVideo);
  checks.push(
    check(
      "generation_status",
      statusOk,
      statusOk
        ? "Generation status acceptable"
        : `Generation not completed (native=${nativeStatus ?? "n/a"}, composition=${fc.compositionStatus ?? "n/a"})`,
      "critical",
      "completed",
      nativeStatus ?? fc.compositionStatus
    )
  );

  // Campaign ID consistency
  const campaignOk =
    fc.campaignId === blueprint.campaignId &&
    fc.campaignId === shotPlan.campaignId &&
    (!manifest || fc.campaignId === manifest.campaignId);
  checks.push(
    check(
      "campaign_id",
      campaignOk,
      campaignOk
        ? "Campaign id consistent across commercial, blueprint, shot plan"
        : "Campaign id mismatch across production artifacts",
      "critical",
      blueprint.campaignId,
      fc.campaignId
    )
  );

  // Duration
  const durationValid = isCampaignDurationSeconds(fc.duration);
  checks.push(
    check(
      "duration_valid",
      durationValid,
      durationValid
        ? `Duration ${fc.duration}s is a supported campaign duration`
        : `Duration ${fc.duration} is not 15 or 30`,
      "error",
      "15|30",
      fc.duration
    )
  );

  const durationMatchesBrief =
    fc.duration === blueprint.campaignDuration &&
    fc.duration === shotPlan.campaignDuration;
  checks.push(
    check(
      "duration_matches_brief",
      durationMatchesBrief,
      durationMatchesBrief
        ? "Duration matches blueprint and shot plan"
        : `Duration ${fc.duration} != blueprint ${blueprint.campaignDuration} / plan ${shotPlan.campaignDuration}`,
      "error",
      blueprint.campaignDuration,
      fc.duration
    )
  );

  if (fc.nativeResult?.duration != null) {
    const reported = fc.nativeResult.duration;
    const withinTol =
      Math.abs(reported - blueprint.campaignDuration) <= DURATION_TOLERANCE_SECONDS;
    checks.push(
      check(
        "duration_output_tolerance",
        withinTol,
        withinTol
          ? `Output duration within ±${DURATION_TOLERANCE_SECONDS}s`
          : `Output duration ${reported}s outside ±${DURATION_TOLERANCE_SECONDS}s of ${blueprint.campaignDuration}s`,
        "error",
        blueprint.campaignDuration,
        reported
      )
    );
  }

  // Aspect ratio (blueprint is source of truth; shot plan inherits campaign aspect)
  const aspectOk = fc.aspectRatio === blueprint.aspectRatio;
  checks.push(
    check(
      "aspect_ratio",
      aspectOk,
      aspectOk
        ? `Aspect ratio ${fc.aspectRatio} matches specification`
        : `Aspect ratio ${fc.aspectRatio} != blueprint ${blueprint.aspectRatio}`,
      "error",
      blueprint.aspectRatio,
      fc.aspectRatio
    )
  );

  // Provider
  const providerOk = fc.provider === VIDEO_EXECUTOR_PROVIDER;
  checks.push(
    check(
      "provider",
      providerOk,
      providerOk
        ? `Provider ${fc.provider} is expected`
        : `Expected provider ${VIDEO_EXECUTOR_PROVIDER}, got ${fc.provider}`,
      "error",
      VIDEO_EXECUTOR_PROVIDER,
      fc.provider
    )
  );

  // Model
  const modelOk =
    fc.model === VIDEO_EXECUTOR_MODEL ||
    String(fc.model).toLowerCase().includes("seedance");
  checks.push(
    check(
      "model",
      modelOk,
      modelOk
        ? `Model ${fc.model} is acceptable`
        : `Expected model ${VIDEO_EXECUTOR_MODEL}, got ${fc.model}`,
      "error",
      VIDEO_EXECUTOR_MODEL,
      fc.model
    )
  );

  // Production mode
  const modeOk =
    fc.productionMode === "native_continuous" ||
    fc.productionMode === "shot_based_composed";
  checks.push(
    check(
      "production_mode",
      modeOk,
      modeOk
        ? `Production mode ${fc.productionMode}`
        : `Unknown production mode ${fc.productionMode}`,
      "error",
      "native_continuous|shot_based_composed",
      fc.productionMode
    )
  );

  // Generation version present
  const versionOk = Boolean(fc.generationVersion?.trim());
  checks.push(
    check(
      "generation_version",
      versionOk,
      versionOk
        ? `Generation version ${fc.generationVersion}`
        : "Missing generation version",
      "error",
      true,
      fc.generationVersion
    )
  );

  // Manifest consistency (when provided)
  if (manifest) {
    const manifestVersionOk =
      manifest.generationVersion === fc.generationVersion;
    checks.push(
      check(
        "manifest_generation_version",
        manifestVersionOk,
        manifestVersionOk
          ? "Manifest generation version matches final commercial"
          : `Manifest version ${manifest.generationVersion} != commercial ${fc.generationVersion}`,
        "error",
        fc.generationVersion,
        manifest.generationVersion
      )
    );

    const manifestDurationOk =
      manifest.campaign.durationSeconds === fc.duration;
    checks.push(
      check(
        "manifest_duration",
        manifestDurationOk,
        manifestDurationOk
          ? "Manifest duration matches"
          : "Manifest duration mismatch",
        "error",
        fc.duration,
        manifest.campaign.durationSeconds
      )
    );

    if (manifest.finalProduction?.videoAssetId) {
      const assetOk = manifest.finalProduction.videoAssetId === fc.videoAssetId;
      checks.push(
        check(
          "manifest_video_asset",
          assetOk,
          assetOk
            ? "Manifest video asset matches"
            : "Manifest videoAssetId does not match final commercial",
          "error",
          fc.videoAssetId,
          manifest.finalProduction.videoAssetId
        )
      );
    }
  } else {
    checks.push(
      check(
        "manifest_present",
        true,
        "Manifest not provided — skipped consistency checks",
        "info"
      )
    );
  }

  // Required product references when blueprint requires identity lock
  const productRefRequired =
    blueprint.productStrategy?.avoidRegeneratingProductWhenReferenceExists ===
      true ||
    shotPlan.shots.some(
      (s) => s.referenceRequirements?.productReferenceRequired === true
    );
  if (productRefRequired) {
    const hasProduct =
      (availableAssets?.productImages?.length ?? 0) > 0 ||
      Boolean(
        fc.nativeResult?.referenceAssetIds?.some((id) =>
          id.toLowerCase().includes("product")
        )
      );
    checks.push(
      check(
        "required_product_reference",
        hasProduct,
        hasProduct
          ? "Product reference available for identity-locked campaign"
          : "Product reference required but not found in available assets",
        hasProduct ? "info" : "warning",
        true,
        hasProduct
      )
    );
  }

  // Shot plan duration sum vs campaign (informational for native continuous)
  const shotSum = shotPlan.shots.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  const shotSumOk =
    Math.abs(shotSum - shotPlan.campaignDuration) <= 1 ||
    fc.productionMode === "native_continuous";
  checks.push(
    check(
      "shot_plan_duration_sum",
      shotSumOk || fc.productionMode === "native_continuous",
      fc.productionMode === "native_continuous"
        ? `Shot plan conceptual sum ${shotSum}s (native continuous — narrative structure only)`
        : shotSumOk
          ? `Shot durations sum to ${shotSum}s`
          : `Shot duration sum ${shotSum}s != campaign ${shotPlan.campaignDuration}s`,
      shotSumOk || fc.productionMode === "native_continuous" ? "info" : "warning",
      shotPlan.campaignDuration,
      shotSum
    )
  );

  const errorOrCriticalFailed = checks.some(
    (c) =>
      !c.passed && (c.severity === "error" || c.severity === "critical")
  );

  return {
    passed: !errorOrCriticalFailed,
    checks,
    skipVisualAnalysis: isHardFailure(checks),
  };
}
