/**
 * Canonical ReferenceContext — Phase 3.
 * Product references (WHAT) vs design references (HOW) stay strictly separate.
 */

import type {
  PosterDesignReferenceAnalysis,
  PosterImageRef,
  PosterReferenceAsset,
  ReferenceAssetRole,
} from "../types";
import type { ContextCompleteness, DataSourceKind } from "./provenance";

export type NormalizedReference = {
  id: string;
  role: ReferenceAssetRole;
  image: PosterImageRef;
  source: DataSourceKind;
  /** Optional design-grammar analysis — metadata only, never source of truth */
  designAnalysis?: PosterDesignReferenceAnalysis | null;
  influence?: "subtle" | "balanced" | "strong";
  metadata?: Record<string, string | number | boolean | null>;
};

export type ReferenceContext = {
  productReferences: NormalizedReference[];
  designReferences: NormalizedReference[];
  supportingReferences: NormalizedReference[];
  completeness: ContextCompleteness;
};

export function emptyReferenceContext(): ReferenceContext {
  return {
    productReferences: [],
    designReferences: [],
    supportingReferences: [],
    completeness: "none",
  };
}

export function computeReferenceCompleteness(
  ctx: Pick<
    ReferenceContext,
    "productReferences" | "designReferences" | "supportingReferences"
  >
): ContextCompleteness {
  const n =
    ctx.productReferences.length +
    ctx.designReferences.length +
    ctx.supportingReferences.length;
  if (n === 0) return "none";
  if (
    ctx.productReferences.length > 0 &&
    (ctx.designReferences.length > 0 || ctx.supportingReferences.length > 0)
  ) {
    return "complete";
  }
  if (n >= 1) return "partial";
  return "none";
}

/** Convert to Phase 1 PosterReferenceAsset for CreativeBrief compatibility */
export function toPosterReferenceAsset(
  ref: NormalizedReference
): PosterReferenceAsset {
  return {
    id: ref.id,
    role: ref.role,
    image: ref.image,
    designAnalysis: ref.designAnalysis ?? null,
    influence: ref.influence,
  };
}
