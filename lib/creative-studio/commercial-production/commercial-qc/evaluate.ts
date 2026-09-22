/**
 * Commercial QC orchestrator — Phase 8 entry point.
 *
 * Final Commercial → Deterministic QC → (optional) Visual Sampling/Analysis
 * → Creative evaluation → Decision → Regeneration plan
 *
 * Does NOT call Runway / Seedance / Nano Banana.
 * Does NOT produce an overall quality score.
 */

import type { ProductionManifest } from "../campaign-orchestrator/types";
import { runDeterministicCommercialQc } from "./deterministic";
import { buildVisualSamplingPlan } from "./sampling";
import { evaluateCreativeCategories } from "./creative-evaluator";
import { evaluateArtifacts } from "./artifact-evaluator";
import { decideCommercialQC } from "./decision";
import {
  buildRegenerationPlan,
  regenerationCountFromVersion,
} from "./regeneration";
import { buildRequirementsSummary } from "./prompts";
import {
  DEFAULT_MAX_AUTO_REGENERATIONS,
  DEFAULT_QC_THRESHOLDS,
  type CommercialQCInput,
  type CommercialQCOptions,
  type CommercialQCReport,
  type CommercialVisualAnalysis,
  type CommercialVisualAnalyzer,
  type SampledFrame,
} from "./types";

function defaultLog(event: string, payload: Record<string, unknown>): void {
  if (process.env.COMMERCIAL_QC_DEBUG === "1") {
    console.log(`[commercial-qc] ${event}`, payload);
  }
}

async function resolveVisualAnalyzer(
  input: CommercialQCInput,
  options: CommercialQCOptions
): Promise<CommercialVisualAnalyzer | null> {
  if (input.visualAnalyzer) return input.visualAnalyzer;
  if (options.visualAnalyzer) return options.visualAnalyzer;
  if (process.env.COMMERCIAL_QC_LIVE_VISION === "1") {
    const { createGeminiVisualAnalyzer } = await import("./gemini-visual-analyzer");
    return createGeminiVisualAnalyzer();
  }
  return null;
}

/**
 * Run full Commercial QC for a generated final commercial.
 */
export async function runCommercialQC(
  input: CommercialQCInput,
  options: CommercialQCOptions = {}
): Promise<CommercialQCReport> {
  const log = options.log ?? defaultLog;
  const thresholds = {
    ...DEFAULT_QC_THRESHOLDS,
    ...(options.thresholds || {}),
    ...(input.thresholds || {}),
  };
  const maxAuto =
    input.maxAutoRegenerations ??
    options.maxAutoRegenerations ??
    DEFAULT_MAX_AUTO_REGENERATIONS;

  const regenerationCount =
    input.regenerationCount ??
    regenerationCountFromVersion(input.finalCommercial.generationVersion);

  log("qc.start", {
    campaignId: input.finalCommercial.campaignId,
    generationVersion: input.finalCommercial.generationVersion,
    regenerationCount,
  });

  const deterministic = runDeterministicCommercialQc({
    blueprint: input.blueprint,
    shotPlan: input.shotPlan,
    finalCommercial: input.finalCommercial,
    manifest: input.manifest ?? input.finalCommercial.manifest,
    availableAssets: input.availableAssets,
  });

  const skipVisual =
    input.skipVisualIfDeterministicFails !== false &&
    deterministic.skipVisualAnalysis;

  let visual: CommercialVisualAnalysis = {
    available: false,
    observations: [],
  };
  let samplingPlan = buildVisualSamplingPlan(input.finalCommercial.duration);

  if (skipVisual) {
    visual = {
      available: false,
      observations: [],
      error: "Skipped visual analysis due to hard deterministic failure",
      samplingPlan,
    };
  } else {
    samplingPlan = buildVisualSamplingPlan(input.finalCommercial.duration);
    const analyzer = await resolveVisualAnalyzer(input, options);

    if (!analyzer) {
      visual = {
        available: false,
        observations: [],
        error:
          "Visual analyzer not configured — inject visualAnalyzer (tests) or set COMMERCIAL_QC_LIVE_VISION=1",
        samplingPlan,
      };
    } else {
      let frames: SampledFrame[] = input.frames ? [...input.frames] : [];
      const frameSampler = input.frameSampler || options.frameSampler;

      if (!frames.length && frameSampler) {
        try {
          frames = await frameSampler.sample({
            videoUrl: input.finalCommercial.videoUrl,
            durationSeconds: input.finalCommercial.duration,
            plan: samplingPlan,
          });
        } catch (err) {
          visual = {
            available: false,
            observations: [],
            error:
              err instanceof Error
                ? `Frame sampling failed: ${err.message}`
                : "Frame sampling failed",
            samplingPlan,
          };
        }
      }

      if (!visual.error) {
        if (!frames.length) {
          frames = samplingPlan.timestamps.map((t) => ({
            timestamp: t,
            imageRef: `stub-frame://${input.finalCommercial.campaignId}@${t}`,
            isMock: true,
          }));
        }

        visual = await analyzer.analyze({
          campaignId: input.finalCommercial.campaignId,
          generationVersion: input.finalCommercial.generationVersion,
          durationSeconds: input.finalCommercial.duration,
          frames,
          samplingPlan,
          blueprint: input.blueprint,
          shotPlan: input.shotPlan,
          productReference: input.availableAssets?.productImages?.[0],
          requirementsSummary: buildRequirementsSummary(
            input.blueprint,
            input.shotPlan
          ),
        });
      }
    }
  }

  let creative = evaluateCreativeCategories({
    blueprint: input.blueprint,
    shotPlan: input.shotPlan,
    visual,
  });

  creative = {
    ...creative,
    artifacts: evaluateArtifacts({
      blueprint: input.blueprint,
      shotPlan: input.shotPlan,
      visual,
    }),
  };

  const decisionResult = decideCommercialQC({
    deterministic,
    visual,
    creative,
    regenerationCount,
    maxAutoRegenerations: maxAuto,
    thresholds,
  });

  const regeneration = buildRegenerationPlan({
    decision: decisionResult.decision,
    reason: decisionResult.reason,
    issues: decisionResult.materialFailures,
    blueprint: input.blueprint,
    sourceGenerationVersion: input.finalCommercial.generationVersion,
    priorRegenerationCount: regenerationCount,
    maxAutoRegenerations: maxAuto,
  });

  const report: CommercialQCReport = {
    campaignId: input.finalCommercial.campaignId,
    generationVersion: input.finalCommercial.generationVersion,
    decision: decisionResult.decision,
    deterministic,
    visual: {
      available: visual.available,
      observations: visual.observations,
      samplingPlan: visual.samplingPlan ?? samplingPlan,
      error: visual.error,
    },
    categories: {
      product: creative.product.status,
      brand: creative.brand.status,
      narrative: creative.narrative.status,
      continuity: creative.continuity.status,
      artifacts: creative.artifacts.status,
      ending: creative.ending.status,
      treatment: creative.treatment.status,
    },
    regeneration,
    regenerationHistory: input.regenerationHistory,
    analyzerConfidence: visual.analyzerConfidence,
    evaluatedAt: new Date().toISOString(),
  };

  log("qc.complete", {
    campaignId: report.campaignId,
    decision: report.decision,
    deterministicPassed: deterministic.passed,
    visualAvailable: visual.available,
  });

  return report;
}

/**
 * Attach a compact QC summary onto ProductionManifest (avoid duplicating full report trees).
 */
export function attachQcToManifest(
  manifest: ProductionManifest,
  report: CommercialQCReport
): ProductionManifest {
  return {
    ...manifest,
    finalProduction: {
      ...(manifest.finalProduction || {}),
      generationMode:
        manifest.finalProduction?.generationMode || "native_continuous",
      qcStatus: report.decision,
      generationVersion: report.generationVersion,
    },
    qc: {
      decision: report.decision,
      generationVersion: report.generationVersion,
      evaluatedAt: report.evaluatedAt,
      deterministicPassed: report.deterministic.passed,
      visualAvailable: report.visual.available,
      categories: report.categories,
      regeneration: report.regeneration
        ? {
            toVersion: report.regeneration.generationVersion,
            reason: report.regeneration.reason,
          }
        : undefined,
      regenerationHistory: report.regenerationHistory,
    },
  };
}
