/**
 * Resolve keyframe / product / character / previous-shot refs for video generation.
 */

import type { StoredAssetRef } from "../assets";
import type { PreparedShotForVideo, ReferenceAsset } from "../reference-engine/types";
import type { ResolvedVideoReferences } from "./types";
import { VideoExecutorError } from "./types";

function toStored(ref: ReferenceAsset, kind: StoredAssetRef["kind"]): StoredAssetRef {
  return {
    id: ref.assetId,
    kind,
    url: ref.url || ref.dataUrl || "",
    mimeType: ref.mimeType || "image/jpeg",
  };
}

export function resolveVideoReferences(prepared: PreparedShotForVideo): ResolvedVideoReferences {
  const productReferences: StoredAssetRef[] = [];
  const characterReferences: StoredAssetRef[] = [];
  const previousShotReferences: StoredAssetRef[] = [];
  const referenceImages: StoredAssetRef[] = [];
  const missing: string[] = [];

  const mode = prepared.generationMode;
  const shot = prepared.shot;
  const reqs = shot.referenceRequirements;

  let startFrame: StoredAssetRef | undefined;
  let sourceKeyframeAssetId: string | undefined;

  if (mode === "image_to_video") {
    const kf = prepared.keyframe;
    if (!kf || kf.status !== "approved") {
      throw new VideoExecutorError(
        "KEYFRAME_REQUIRED",
        `image_to_video requires an approved keyframe for shot ${shot.id} (got status=${kf?.status || "missing"})`,
        { shotId: shot.id, keyframeStatus: kf?.status }
      );
    }
    const url = kf.url?.trim();
    if (!url) {
      throw new VideoExecutorError(
        "KEYFRAME_INVALID",
        `Approved keyframe for shot ${shot.id} has no url`,
        { shotId: shot.id, keyframeId: kf.keyframeId }
      );
    }
    sourceKeyframeAssetId = kf.assetId || kf.keyframeId;
    startFrame = {
      id: sourceKeyframeAssetId,
      kind: "keyframe",
      url,
      mimeType: "image/png",
      shotId: shot.id,
      keyframeId: kf.keyframeId,
      campaignId: kf.campaignId,
    };
  }

  for (const ref of prepared.references || []) {
    if (!ref.url && !ref.dataUrl) {
      missing.push(`${ref.type}:${ref.assetId}`);
      continue;
    }
    if (ref.type === "product") {
      productReferences.push(toStored(ref, "product_image"));
    } else if (ref.type === "character") {
      characterReferences.push(toStored(ref, "creative_reference"));
    } else if (ref.type === "previous_shot") {
      previousShotReferences.push(toStored(ref, "keyframe"));
    } else if (ref.type === "brand") {
      referenceImages.push(toStored(ref, "brand_logo"));
    } else {
      referenceImages.push(toStored(ref, "creative_reference"));
    }
  }

  if (reqs.productReferenceRequired && productReferences.length === 0 && !startFrame) {
    // For I2V the keyframe already embeds product; for T2V product ref is required when flagged.
    if (mode === "text_to_video") {
      missing.push("product_reference");
    }
  }

  if (reqs.characterReference && characterReferences.length === 0) {
    // Soft: character system may not exist yet — record missing, do not hard-fail unless no keyframe.
    missing.push("character_reference");
  }

  if (
    (reqs.previousShotReferenceIds?.length || 0) > 0 &&
    previousShotReferences.length === 0 &&
    mode === "text_to_video"
  ) {
    missing.push("previous_shot_reference");
  }

  // For image-to-video, do not blindly duplicate product refs as start-frame peers.
  // Keyframe is the controlled visual; extra product refs only for text-to-video path.
  const refsForProvider =
    mode === "image_to_video"
      ? []
      : [...productReferences, ...characterReferences, ...previousShotReferences, ...referenceImages];

  return {
    startFrame,
    productReferences: mode === "image_to_video" ? [] : productReferences,
    characterReferences,
    previousShotReferences,
    referenceImages: refsForProvider,
    sourceKeyframeAssetId,
    missing: missing.filter((m) => m !== "character_reference"), // character soft
  };
}
