/**
 * Resolve product / character / previous-shot reference assets for a CommercialShot.
 */

import type { CommercialShot } from "../shot-planner/types";
import type { ResolvedReferencePlan } from "./reference-strategy";
import type {
  AvailableCampaignAssets,
  KeyframeResult,
  ReferenceAsset,
} from "./types";
import { ReferenceEngineError } from "./types";

export interface ResolveReferencesInput {
  shot: CommercialShot;
  plan: ResolvedReferencePlan;
  availableAssets?: AvailableCampaignAssets;
  /** When regenerating in-batch, pass keyframes approved earlier in the run. */
  sessionKeyframes?: Record<string, KeyframeResult>;
  /** If true, throw when required refs are missing. Default true for generation. */
  strict?: boolean;
}

export interface ResolveReferencesResult {
  references: ReferenceAsset[];
  missing: string[];
}

export function resolveKeyframeReferences(
  input: ResolveReferencesInput
): ResolveReferencesResult {
  const { shot, plan, availableAssets, sessionKeyframes, strict = true } = input;
  const references: ReferenceAsset[] = [];
  const missing: string[] = [];

  if (plan.productReferenceRequired) {
    const products = availableAssets?.productImages || [];
    if (products.length === 0) {
      missing.push("product");
      if (strict) {
        throw new ReferenceEngineError(
          "PRODUCT_REFERENCE_MISSING",
          `Shot ${shot.id} requires a product reference image but none were provided in availableAssets.productImages`
        );
      }
    } else {
      for (const p of products.slice(0, 2)) {
        references.push({
          type: "product",
          assetId: p.id,
          url: p.url,
          mimeType: p.mimeType,
        });
      }
    }
  }

  if (plan.characterReferenceRequired) {
    const chars = availableAssets?.characterReferences || [];
    if (chars.length === 0) {
      // Soft gap: character product system may not exist yet.
      // Do NOT add to `missing` (that fails deterministic QC as an error).
      // Callers observe characterReferenceRequired + empty character refs via strategy.
      if (strict && plan.strategy === "character_reference") {
        throw new ReferenceEngineError(
          "CHARACTER_REFERENCE_MISSING",
          `Shot ${shot.id} requires character reference assets but none were provided`
        );
      }
    } else {
      for (const c of chars.slice(0, 2)) {
        references.push({
          type: "character",
          assetId: c.id,
          url: c.url,
          mimeType: c.mimeType,
        });
      }
    }
  }

  if (plan.previousShotReferenceRequired) {
    const prevIds =
      shot.referenceRequirements.previousShotReferenceIds ||
      shot.continuity.continuesFromShotIds ||
      [];
    for (const prevId of prevIds) {
      const fromSession = sessionKeyframes?.[prevId];
      const fromAssets = availableAssets?.approvedKeyframesByShotId?.[prevId];
      const kf = fromSession || fromAssets;
      if (!kf || (kf.status !== "approved" && kf.status !== "generated") || !kf.url) {
        missing.push(`previous_shot:${prevId}`);
        if (strict) {
          throw new ReferenceEngineError(
            "PREVIOUS_SHOT_REFERENCE_MISSING",
            `Shot ${shot.id} requires approved keyframe from ${prevId} but it is not available`
          );
        }
        continue;
      }
      references.push({
        type: "previous_shot",
        assetId: kf.assetId || kf.keyframeId,
        url: kf.url,
      });
    }
  }

  if (availableAssets?.brandLogo) {
    references.push({
      type: "brand",
      assetId: availableAssets.brandLogo.id,
      url: availableAssets.brandLogo.url,
      mimeType: availableAssets.brandLogo.mimeType,
    });
  }

  return { references, missing };
}
