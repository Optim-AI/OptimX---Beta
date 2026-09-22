/**
 * Deterministic campaign reference selection for native Seedance generation.
 * Consumes existing assets — does not generate new ones.
 */

import type { AvailableCampaignAssets, KeyframeResult } from "../reference-engine/types";
import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { ShotPlan } from "../shot-planner/types";
import type { CampaignReferenceAsset } from "./types";
import { CampaignCompilerError } from "./types";

const DEFAULT_MAX_REFS = 8; // matches current RunwayProvider selection loop

export interface BuildCampaignReferencesResult {
  selected: CampaignReferenceAsset[];
  omitted: Array<{ assetId: string; purpose: string; reason: string }>;
  usesProductReference: boolean;
}

/**
 * Priority: product (required) → character → environment/style → continuity keyframes.
 */
export function buildCampaignReferences(input: {
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
  availableAssets?: AvailableCampaignAssets;
  approvedKeyframesByShotId?: Record<string, KeyframeResult>;
  maxReferenceImages?: number;
  /** When true, missing product images fail hard if any shot requires product reference. */
  requireProductWhenNeeded?: boolean;
}): BuildCampaignReferencesResult {
  const max = input.maxReferenceImages ?? DEFAULT_MAX_REFS;
  const omitted: BuildCampaignReferencesResult["omitted"] = [];
  const candidates: CampaignReferenceAsset[] = [];

  const needsProduct = input.shotPlan.shots.some(
    (s) =>
      s.referenceRequirements.productReferenceRequired ||
      s.generationStrategy.requiresProductReference ||
      (s.productVisibility !== "none" && s.productVisibility !== "implied")
  );

  const products = input.availableAssets?.productImages || [];
  if (needsProduct && products.length === 0) {
    if (input.requireProductWhenNeeded !== false) {
      throw new CampaignCompilerError(
        "MISSING_PRODUCT_REFERENCE",
        `Campaign ${input.blueprint.campaignId} requires a product reference image but none were provided`
      );
    }
  }

  for (const p of products) {
    if (!p.url) continue;
    candidates.push({
      purpose: "product",
      assetId: p.id,
      url: p.url,
      mimeType: p.mimeType,
      priority: 1,
      required: true,
      source: "product_image",
    });
  }

  if (input.availableAssets?.brandLogo?.url) {
    const logo = input.availableAssets.brandLogo;
    candidates.push({
      purpose: "style",
      assetId: logo.id,
      url: logo.url,
      mimeType: logo.mimeType,
      priority: 40,
      required: false,
      source: "brand_logo",
    });
  }

  for (const c of input.availableAssets?.characterReferences || []) {
    if (!c.url) continue;
    candidates.push({
      purpose: "character",
      assetId: c.id,
      url: c.url,
      mimeType: c.mimeType,
      priority: 10,
      required: false,
      source: "character",
    });
  }

  // Continuity keyframes — lower priority than real product imagery
  const keyframes = {
    ...(input.availableAssets?.approvedKeyframesByShotId || {}),
    ...(input.approvedKeyframesByShotId || {}),
  };
  const continuityShotIds = new Set(
    input.shotPlan.shots.flatMap((s) => [
      ...(s.referenceRequirements.previousShotReferenceIds || []),
      ...(s.continuity.continuesFromShotIds || []),
    ])
  );
  for (const shotId of continuityShotIds) {
    const kf = keyframes[shotId];
    if (!kf?.url || kf.status !== "approved") continue;
    candidates.push({
      purpose: "continuity",
      assetId: kf.assetId || kf.keyframeId,
      url: kf.url,
      priority: 30,
      required: false,
      source: "keyframe",
    });
  }

  // Deduplicate by assetId, keep best priority (lower number = higher priority)
  const byId = new Map<string, CampaignReferenceAsset>();
  for (const c of candidates) {
    const existing = byId.get(c.assetId);
    if (!existing || c.priority < existing.priority) byId.set(c.assetId, c);
  }

  const ranked = [...byId.values()].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.assetId.localeCompare(b.assetId);
  });

  // Never drop required product refs
  const required = ranked.filter((r) => r.required);
  const optional = ranked.filter((r) => !r.required);

  if (required.length > max) {
    throw new CampaignCompilerError(
      "COMPILATION_FAILED",
      `Required references (${required.length}) exceed provider limit (${max})`,
      { required: required.map((r) => r.assetId), max }
    );
  }

  const selected: CampaignReferenceAsset[] = [...required];
  for (const opt of optional) {
    if (selected.length >= max) {
      omitted.push({
        assetId: opt.assetId,
        purpose: opt.purpose,
        reason: `Exceeded maxReferenceImages=${max}`,
      });
      continue;
    }
    selected.push(opt);
  }

  return {
    selected,
    omitted,
    usesProductReference: selected.some((r) => r.purpose === "product"),
  };
}
