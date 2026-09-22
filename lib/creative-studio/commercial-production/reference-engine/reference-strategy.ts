/**
 * Resolve Shot Planner reference/generation decisions into a Reference Engine strategy.
 * Does not invent a new campaign — only interprets CommercialShot requirements.
 */

import type { CommercialShot } from "../shot-planner/types";
import type { ResolvedReferenceStrategy } from "./types";

export interface ResolvedReferencePlan {
  strategy: ResolvedReferenceStrategy;
  keyframeRequired: boolean;
  callImageProvider: boolean;
  productReferenceRequired: boolean;
  characterReferenceRequired: boolean;
  previousShotReferenceRequired: boolean;
  reasons: string[];
}

export function resolveReferenceStrategy(shot: CommercialShot): ResolvedReferencePlan {
  const reasons: string[] = [];
  const genId = shot.generationStrategy.id;
  const refs = shot.referenceRequirements;

  const productReferenceRequired =
    refs.productReferenceRequired || shot.generationStrategy.requiresProductReference;
  const keyframeRequired =
    refs.keyframeRequired ||
    shot.generationStrategy.requiresKeyframe ||
    genId === "keyframe-first" ||
    genId === "hybrid";
  const characterReferenceRequired = Boolean(refs.characterReference);
  const previousShotReferenceRequired = Boolean(
    (refs.previousShotReferenceIds && refs.previousShotReferenceIds.length > 0) ||
      refs.strategyType === "previous_shot"
  );

  if (genId === "motion-graphics") {
    reasons.push("Shot Planner selected motion-graphics");
    return {
      strategy: "motion_graphics",
      keyframeRequired: false,
      callImageProvider: false,
      productReferenceRequired,
      characterReferenceRequired,
      previousShotReferenceRequired,
      reasons,
    };
  }

  if (genId === "composited") {
    reasons.push("Shot Planner selected composited");
    return {
      strategy: "composited",
      keyframeRequired: false,
      callImageProvider: false,
      productReferenceRequired,
      characterReferenceRequired,
      previousShotReferenceRequired,
      reasons,
    };
  }

  if (genId === "text-to-video" && !keyframeRequired) {
    reasons.push("text-to-video without keyframe requirement");
    return {
      strategy: "text_to_video",
      keyframeRequired: false,
      callImageProvider: false,
      productReferenceRequired,
      characterReferenceRequired,
      previousShotReferenceRequired,
      reasons,
    };
  }

  // Keyframe / image-to-video path
  let strategy: ResolvedReferenceStrategy = "keyframe_first";
  if (
    productReferenceRequired &&
    (characterReferenceRequired || previousShotReferenceRequired)
  ) {
    strategy = "multi_reference";
    reasons.push("product + character/previous references");
  } else if (previousShotReferenceRequired && !productReferenceRequired) {
    strategy = "previous_shot_reference";
    reasons.push("previous-shot continuity reference");
  } else if (characterReferenceRequired && !productReferenceRequired) {
    strategy = "character_reference";
    reasons.push("character reference");
  } else if (productReferenceRequired && !keyframeRequired && genId === "product-reference-first") {
    strategy = "product_reference";
    reasons.push("product-reference-first without forced keyframe");
  } else if (keyframeRequired) {
    strategy = "keyframe_first";
    reasons.push("keyframe required by shot plan");
  }

  const callImageProvider = keyframeRequired || strategy === "product_reference";

  // product_reference without keyframe may still skip Nano Banana if planner only wanted refs for video
  if (strategy === "product_reference" && !keyframeRequired) {
    return {
      strategy,
      keyframeRequired: false,
      callImageProvider: false,
      productReferenceRequired,
      characterReferenceRequired,
      previousShotReferenceRequired,
      reasons: [...reasons, "product reference for video handoff only — no keyframe generation"],
    };
  }

  return {
    strategy,
    keyframeRequired: callImageProvider,
    callImageProvider,
    productReferenceRequired,
    characterReferenceRequired,
    previousShotReferenceRequired,
    reasons,
  };
}
