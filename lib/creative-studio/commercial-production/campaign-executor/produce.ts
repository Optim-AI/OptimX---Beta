/**
 * Produce final commercial — Phase 7 entry.
 *
 * Default: native continuous Seedance 2.5 (ONE 15s/30s generation).
 * Explicit fallback: shot-based Phase 6 path + minimal timeline.
 */

import { createCommercialDirector } from "../commercial-director/director";
import { validateCommercialBlueprint } from "../commercial-director/validate";
import { createShotPlanner } from "../shot-planner/planner";
import { validateShotPlan } from "../shot-planner/validate";
import { compileCampaignGeneration } from "../campaign-compiler";
import { runCommercialQC, attachQcToManifest } from "../commercial-qc/evaluate";
import { buildCreativePlanSummary } from "../studio-mapper";
import { generateCampaignVideo } from "./generate-campaign-video";
import { produceShotBasedFallback } from "./fallback";
import {
  CampaignExecutorError,
  type CampaignExecutorOptions,
  type FinalCommercial,
  type ProduceFinalCommercialInput,
} from "./types";
import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
} from "../video-executor/types";

function defaultLog(event: string, payload: Record<string, unknown>): void {
  console.log(`[campaign-executor] ${event}`, payload);
}

/**
 * Full Phase 7 production:
 * Brief → (Director → Planner) → CampaignGenerationSpec → native Seedance OR shot fallback.
 */
export async function produceFinalCommercial(
  input: ProduceFinalCommercialInput,
  options: CampaignExecutorOptions = {}
): Promise<FinalCommercial> {
  const log = options.log ?? defaultLog;
  const generationVersion = input.generationVersion || "v1";
  const generationMode = input.generationMode || "native_continuous";
  const brief = input.brief;

  if (!brief?.campaignId) {
    throw new CampaignExecutorError("INVALID_SPEC", "brief.campaignId is required");
  }

  log("produce.start", {
    campaignId: brief.campaignId,
    generationVersion,
    generationMode,
    duration: brief.campaignDuration,
  });

  // Explicit fallback — never silently switch from native failure
  if (generationMode === "shot_based_fallback") {
    log("produce.fallback_explicit", { campaignId: brief.campaignId });
    return produceShotBasedFallback(
      {
        brief,
        generationVersion,
        forceRegenerate: input.forceRegenerate,
        availableAssets: input.availableAssets,
        skipDownload: input.skipDownload,
        skipStorage: input.skipStorage,
        concurrency: input.concurrency,
        userId: input.userId,
      },
      options
    );
  }

  // Native continuous path
  let blueprint = input.blueprint;
  let shotPlan = input.shotPlan;

  if (!blueprint) {
    const director = options.director ?? createCommercialDirector();
    const output = await director.direct(brief);
    const validation = validateCommercialBlueprint(output.blueprint);
    if (!validation.ok) {
      throw new CampaignExecutorError(
        "INVALID_SPEC",
        `Blueprint validation failed: ${validation.issues.map((i) => i.message).join("; ")}`
      );
    }
    blueprint = output.blueprint;
  }

  if (!shotPlan) {
    const planner = options.shotPlanner ?? createShotPlanner();
    const plan = await planner.plan(blueprint);
    const validation = validateShotPlan(plan);
    if (!validation.ok) {
      throw new CampaignExecutorError(
        "INVALID_SPEC",
        `ShotPlan validation failed: ${validation.issues.map((i) => i.message).join("; ")}`
      );
    }
    shotPlan = plan;
  }

  const spec = compileCampaignGeneration({
    blueprint,
    shotPlan,
    availableAssets: input.availableAssets,
    generationVersion,
    generationMode: "native_continuous",
  });

  log("produce.compiled", {
    campaignId: spec.campaignId,
    duration: spec.duration,
    referenceCount: spec.referenceAssets.length,
    promptLength: spec.campaignPrompt.length,
  });

  const native = await generateCampaignVideo(
    {
      spec,
      forceRegenerate: input.forceRegenerate,
      skipDownload: input.skipDownload ?? true,
      skipStorage: input.skipStorage ?? true,
      userId: input.userId,
    },
    options
  );

  if (native.status !== "completed") {
    throw new CampaignExecutorError(
      "NATIVE_GENERATION_FAILED",
      native.error?.message || "Native campaign generation failed",
      { error: native.error },
      true
    );
  }

  let final: FinalCommercial = {
    campaignId: native.campaignId,
    generationVersion: native.generationVersion,
    duration: native.duration,
    aspectRatio: native.aspectRatio,
    productionMode: "native_continuous",
    videoAssetId: native.videoAssetId,
    videoUrl: native.videoUrl,
    provider: VIDEO_EXECUTOR_PROVIDER,
    model: native.model || VIDEO_EXECUTOR_MODEL,
    qc: native.qc,
    compositionStatus: "completed",
    audioTracks: [],
    nativeResult: native,
    creativePlan: buildCreativePlanSummary(blueprint),
    createdAt: new Date().toISOString(),
  };

  // Phase 8 — Commercial QC (deterministic always; visual when analyzer injected / live flag)
  if (input.runCommercialQc !== false) {
    const report = await runCommercialQC(
      {
        campaignBrief: brief,
        blueprint,
        shotPlan,
        finalCommercial: final,
        availableAssets: input.availableAssets,
        visualAnalyzer: options.visualAnalyzer,
        maxAutoRegenerations: options.maxAutoRegenerations,
      },
      {
        visualAnalyzer: options.visualAnalyzer,
        maxAutoRegenerations: options.maxAutoRegenerations,
        log,
      }
    );
    final = { ...final, commercialQC: report };
    if (final.manifest) {
      final = {
        ...final,
        manifest: attachQcToManifest(final.manifest, report),
      };
    }
    log("produce.qc", {
      campaignId: final.campaignId,
      decision: report.decision,
      deterministicPassed: report.deterministic.passed,
      visualAvailable: report.visual.available,
    });
  }

  log("produce.complete", {
    campaignId: final.campaignId,
    productionMode: final.productionMode,
    duration: final.duration,
    providerJobId: native.providerJobId,
  });

  return final;
}
