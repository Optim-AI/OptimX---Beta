/**
 * Prepare CommercialShot (+ optional keyframe) for Phase 5 video generation.
 * Does NOT call Runway / Seedance.
 */

import type { CommercialShot } from "../shot-planner/types";
import { resolveReferenceStrategy } from "./reference-strategy";
import type {
  KeyframeResult,
  PreparedShotForVideo,
  ReferenceAsset,
  VideoGenerationMode,
} from "./types";

export function prepareShotForVideo(input: {
  shot: CommercialShot;
  keyframe?: KeyframeResult;
  references?: ReferenceAsset[];
}): PreparedShotForVideo {
  const plan = resolveReferenceStrategy(input.shot);
  const genId = input.shot.generationStrategy.id;

  let generationMode: VideoGenerationMode = "text_to_video";
  if (genId === "motion-graphics") generationMode = "motion_graphics";
  else if (genId === "composited") generationMode = "composited";
  else if (
    plan.keyframeRequired ||
    genId === "keyframe-first" ||
    genId === "image-to-video" ||
    genId === "existing-asset-ai-motion" ||
    (genId === "product-reference-first" &&
      (plan.keyframeRequired || input.keyframe?.status === "approved"))
  ) {
    generationMode = "image_to_video";
  }

  const references = input.references || [];
  if (input.keyframe?.url) {
    // Ensure keyframe is represented for video I2V handoff
    if (!references.some((r) => r.type === "previous_shot" && r.url === input.keyframe!.url)) {
      references.push({
        type: "other",
        assetId: input.keyframe.assetId || input.keyframe.keyframeId,
        url: input.keyframe.url,
      });
    }
  }

  let readyForVideo = true;
  let blockedReason: string | undefined;

  if (plan.callImageProvider || plan.keyframeRequired) {
    if (!input.keyframe || input.keyframe.status !== "approved") {
      readyForVideo = false;
      blockedReason = `Keyframe required for shot ${input.shot.id} but status=${input.keyframe?.status || "missing"}`;
    }
  }

  if (generationMode === "motion_graphics" || generationMode === "composited") {
    readyForVideo = true;
    blockedReason = undefined;
  }

  if (generationMode === "text_to_video") {
    readyForVideo = true;
  }

  return {
    shot: input.shot,
    keyframe: input.keyframe,
    references,
    generationMode,
    providerRequirements: {
      provider: "runway",
      model: "seedance2_5",
    },
    readyForVideo,
    blockedReason,
  };
}
