/**
 * Build ProductionManifest from a completed/partial CampaignProductionRun.
 * Preserves Shot Planner editorial order (sequence), never completion time.
 */

import type {
  CampaignProductionRun,
  CampaignShotProductionState,
  ProductionManifest,
  ProductionManifestShot,
} from "./types";

function shotQc(state: CampaignShotProductionState): ProductionManifestShot["qc"] {
  const notes: string[] = [];
  const keyframeQcPassed = state.keyframe?.qc?.passed;
  const videoQcPassed = state.video?.qc?.passed;
  const visualInspectionAvailable = Boolean(
    state.keyframe?.metadata?.visualInspectionAvailable ||
      state.video?.qc?.visualInspectionAvailable
  );

  if (state.keyframe?.qc?.checksDeferredToVisualQc?.length) {
    notes.push(...state.keyframe.qc.checksDeferredToVisualQc.map((c) => `keyframe:${c}`));
  }
  if (state.video?.qc?.checksDeferredToVisualQc?.length) {
    notes.push(...state.video.qc.checksDeferredToVisualQc.map((c) => `video:${c}`));
  }
  if (!visualInspectionAvailable) {
    notes.push("visualInspectionAvailable: false");
  }

  let status = "pending";
  if (state.status === "failed" || state.status === "blocked") status = "failed";
  else if (state.status === "deferred") status = "deferred";
  else if (state.status === "video_ready" || state.status === "reference_ready") {
    if (videoQcPassed === false || keyframeQcPassed === false) status = "qc_warning";
    else status = "passed_deterministic";
  }

  return {
    status,
    keyframeQcPassed,
    videoQcPassed,
    visualInspectionAvailable,
    notes: notes.length ? notes : undefined,
  };
}

function compositionFor(state: CampaignShotProductionState): ProductionManifestShot["composition"] {
  if (state.status === "deferred") {
    return {
      eligible: true,
      reason: "handled_by_compositor",
    };
  }
  if (state.status === "video_ready" && state.video?.status === "completed" && state.video.videoAsset) {
    return { eligible: true };
  }
  if (state.status === "failed" || state.status === "blocked") {
    return {
      eligible: false,
      reason: state.errors?.[0]?.message || state.status,
    };
  }
  return {
    eligible: false,
    reason: `shot status=${state.status}`,
  };
}

export function buildProductionManifest(run: CampaignProductionRun): ProductionManifest {
  const plan = run.shotPlan;
  const blueprint = run.blueprint;
  if (!plan || !blueprint) {
    throw new Error("Cannot build manifest without blueprint and shotPlan");
  }

  // Editorial order by Shot Planner sequence
  const ordered = [...run.shots].sort((a, b) => a.sequence - b.sequence);
  const planById = new Map(plan.shots.map((s) => [s.id, s]));

  const shots: ProductionManifestShot[] = ordered.map((state, index) => {
    const shot = planById.get(state.shotId);
    const generationMode =
      state.generationMode ||
      state.preparedShot?.generationMode ||
      (state.status === "deferred" ? "motion_graphics" : "text_to_video");

    return {
      shotId: state.shotId,
      index,
      sequence: state.sequence,
      durationSeconds: shot?.durationSeconds ?? 0,
      role: shot?.role || "unknown",
      shotWhy: shot?.shotWhy || "",
      beatIds: shot?.beatIds || [],
      storyBeat: shot?.storyBeat,
      transitionIn: shot?.transitionIn,
      transitionOut: shot?.transitionOut,
      generationStrategy: state.generationStrategy,
      generationMode,
      keyframe: state.keyframe?.assetId
        ? {
            assetId: state.keyframe.assetId,
            url: state.keyframe.url,
            status: state.keyframe.status,
            keyframeId: state.keyframe.keyframeId,
          }
        : state.keyframe
          ? {
              assetId: state.keyframe.keyframeId,
              url: state.keyframe.url,
              status: state.keyframe.status,
              keyframeId: state.keyframe.keyframeId,
            }
          : undefined,
      video:
        state.video?.videoAsset
          ? {
              assetId: state.video.videoAsset.assetId,
              url: state.video.videoAsset.url,
              durationSeconds:
                state.video.videoAsset.durationSeconds ?? state.video.providerDurationSeconds,
              width: state.video.videoAsset.width,
              height: state.video.videoAsset.height,
              provider: state.video.provider,
              model: state.video.model,
            }
          : undefined,
      sourceReferences:
        state.preparedShot?.references?.map((r) => r.assetId) ||
        state.keyframe?.referenceAssetIds ||
        [],
      continuity: {
        continuesFromShotIds: shot?.continuity?.continuesFromShotIds || [],
        mustMatch: shot?.continuity?.mustMatch || [],
        mustMatchDimensions: shot?.continuity?.mustMatchDimensions,
        characterContinuity: shot?.characterContinuity,
        productState: shot?.productState,
      },
      artifactRisks: [
        shot?.artifactRisk,
        ...(shot?.artifactRisks || []).map((r) => r.risk),
      ].filter(Boolean) as string[],
      qc: shotQc(state),
      composition: compositionFor(state),
    };
  });

  const allEligible = shots.every((s) => s.composition.eligible);
  const anyFailed = ordered.some((s) => s.status === "failed" || s.status === "blocked");
  const productionStatus = anyFailed
    ? "incomplete"
    : allEligible
      ? "ready_for_composition"
      : "incomplete";

  return {
    campaignId: run.campaignId,
    generationVersion: run.generationVersion,
    campaign: {
      durationSeconds: plan.campaignDuration,
      aspectRatio: blueprint.aspectRatio,
    },
    creative: {
      selectedConcept: blueprint.selectedConcept,
      visualTreatment: blueprint.visualTreatment,
    },
    shots,
    totalShotDurationSeconds: plan.totalDurationSeconds,
    productionStatus,
    createdAt: new Date().toISOString(),
    runStatus: run.status,
  };
}
