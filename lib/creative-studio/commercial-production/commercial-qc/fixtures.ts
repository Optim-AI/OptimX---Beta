/**
 * Fixtures for Commercial QC tests — no live providers.
 */

import { makeValidBrief, makeValidBlueprint } from "../commercial-director/fixtures";
import { makeValid15sShotPlan } from "../shot-planner/fixtures";
import { makeAvailableAssets } from "../reference-engine/fixtures";
import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
} from "../video-executor/types";
import type { FinalCommercial } from "../campaign-executor/types";
import type { CommercialQCInput, VisualObservation } from "./types";
import { MockVisualAnalyzer } from "./visual-analyzer";

export function makeFinalCommercial(
  overrides: Partial<FinalCommercial> = {}
): FinalCommercial {
  return {
    campaignId: "camp_test_001",
    generationVersion: "v1",
    duration: 15,
    aspectRatio: "9:16",
    productionMode: "native_continuous",
    videoAssetId: "asset_final_001",
    videoUrl: "https://example.com/final.mp4",
    provider: VIDEO_EXECUTOR_PROVIDER,
    model: VIDEO_EXECUTOR_MODEL,
    qc: {
      passed: true,
      issues: [],
      checksPerformed: ["video_exists"],
      visualInspectionAvailable: false,
      durationToleranceSeconds: 2,
    },
    compositionStatus: "completed",
    audioTracks: [],
    nativeResult: {
      campaignId: "camp_test_001",
      generationVersion: "v1",
      provider: VIDEO_EXECUTOR_PROVIDER,
      model: VIDEO_EXECUTOR_MODEL,
      generationMode: "native_continuous",
      duration: 15,
      aspectRatio: "9:16",
      videoAssetId: "asset_final_001",
      videoUrl: "https://example.com/final.mp4",
      providerJobId: "job_001",
      status: "completed",
      prompt: "mock campaign prompt",
      referenceAssetIds: ["product-1"],
      qc: {
        passed: true,
        issues: [],
        checksPerformed: [],
        visualInspectionAvailable: false,
        durationToleranceSeconds: 2,
      },
      metadata: { idempotencyKey: "idem-1" },
    },
    createdAt: "2026-09-21T12:00:00.000Z",
    ...overrides,
  };
}

export function makeQCInput(
  overrides: Partial<CommercialQCInput> = {}
): CommercialQCInput {
  const shotPlan = makeValid15sShotPlan();
  const blueprint = makeValidBlueprint({
    campaignId: shotPlan.campaignId,
    campaignDuration: 15,
    aspectRatio: "9:16",
  });
  return {
    campaignBrief: makeValidBrief({
      campaignId: shotPlan.campaignId,
      campaignDuration: 15,
      aspectRatio: "9:16",
    }),
    blueprint,
    shotPlan,
    finalCommercial: makeFinalCommercial({
      campaignId: shotPlan.campaignId,
      duration: 15,
      aspectRatio: "9:16",
      nativeResult: {
        campaignId: shotPlan.campaignId,
        generationVersion: "v1",
        provider: VIDEO_EXECUTOR_PROVIDER,
        model: VIDEO_EXECUTOR_MODEL,
        generationMode: "native_continuous",
        duration: 15,
        aspectRatio: "9:16",
        videoAssetId: "asset_final_001",
        videoUrl: "https://example.com/final.mp4",
        providerJobId: "job_001",
        status: "completed",
        prompt: "mock campaign prompt",
        referenceAssetIds: ["product-1"],
        qc: {
          passed: true,
          issues: [],
          checksPerformed: [],
          visualInspectionAvailable: false,
          durationToleranceSeconds: 2,
        },
        metadata: { idempotencyKey: "idem-1" },
      },
    }),
    availableAssets: makeAvailableAssets(),
    ...overrides,
  };
}

export function observation(
  partial: Partial<VisualObservation> &
    Pick<VisualObservation, "category" | "observation" | "evidence">
): VisualObservation {
  return {
    severity: "info",
    confidence: 0.9,
    ...partial,
  };
}

export function productFailObservation(): VisualObservation {
  return observation({
    category: "product",
    severity: "critical",
    confidence: 0.92,
    observation:
      "Generated product packaging differs materially from the canonical product reference",
    evidence:
      "At t≈12s label colors and lid shape do not match supplied product reference",
    timestamp: 12,
  });
}

export function narrativeFailObservation(): VisualObservation {
  return observation({
    category: "narrative",
    severity: "error",
    confidence: 0.9,
    observation:
      "Intended emotional progression replaced by generic product montage",
    evidence:
      "Sampled frames show immediate product hero without fatigue→decision arc",
    timestamp: 4,
  });
}

export function ambiguousObservation(): VisualObservation {
  return observation({
    category: "product",
    severity: "error",
    confidence: 0.45,
    observation: "Possible product label mismatch — unclear at sample resolution",
    evidence: "Frame at t=10s is motion-blurred; packaging text not readable",
    timestamp: 10,
  });
}

export { MockVisualAnalyzer, makeValidBrief, makeValidBlueprint, makeAvailableAssets };
