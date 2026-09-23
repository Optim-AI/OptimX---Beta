/**
 * Adapt Phase 1 brief product/brand into Phase 3 contexts for the strategist.
 * Preserves provenance as authoritative when data came from the brief.
 */

import {
  computeBrandCompleteness,
  emptyBrandContext,
  type BrandContext,
} from "../context/brand-context";
import {
  classifyClaimStrings,
  computeProductCompleteness,
  emptyProductContext,
  type ProductContext,
} from "../context/product-context";
import {
  computeReferenceCompleteness,
  emptyReferenceContext,
  type ReferenceContext,
} from "../context/reference-context";
import { provenanced } from "../context/provenance";
import type { CreativeBrief, PosterProductContext } from "../types";

export function productContextFromBriefProduct(
  product: PosterProductContext | null
): ProductContext {
  if (!product) return emptyProductContext("manual");
  const ctx = emptyProductContext(product.source || "manual");
  ctx.source = product.source || "manual";
  ctx.sourceMetadata.sourcesUsed = [ctx.source];
  ctx.catalogProduct = product.catalogProduct ?? null;

  if (product.name?.trim()) {
    ctx.name = provenanced(product.name.trim(), ctx.source, "authoritative");
  }
  if (product.brandName?.trim()) {
    ctx.brandName = provenanced(
      product.brandName.trim(),
      ctx.source,
      "authoritative"
    );
  }
  if (product.category?.trim()) {
    ctx.category = provenanced(
      product.category.trim(),
      ctx.source,
      "authoritative"
    );
  }
  if (product.description?.trim()) {
    ctx.description = provenanced(
      product.description.trim(),
      ctx.source,
      "authoritative"
    );
  }
  if (product.shortBenefit?.trim()) {
    ctx.shortDescription = provenanced(
      product.shortBenefit.trim(),
      ctx.source,
      "authoritative"
    );
  }
  if (product.price?.trim()) {
    ctx.price = provenanced(product.price.trim(), ctx.source, "authoritative");
  }
  if (product.productUrl?.trim()) {
    ctx.productUrl = provenanced(
      product.productUrl.trim(),
      ctx.source,
      "authoritative"
    );
  }
  if (product.targetAudience?.trim()) {
    ctx.targetAudience = provenanced(
      product.targetAudience.trim(),
      ctx.source,
      "authoritative"
    );
  }

  const benefits = product.benefits || [];
  const classified = classifyClaimStrings([
    ...benefits,
    ...(product.factualClaims || []),
  ]);
  ctx.benefits = provenanced(benefits, ctx.source, "authoritative");
  ctx.factualClaims = provenanced(
    product.factualClaims?.length
      ? product.factualClaims
      : classified.factual,
    ctx.source,
    "authoritative"
  );
  ctx.marketingClaims = provenanced(
    classified.marketing,
    ctx.source,
    "extracted"
  );
  ctx.features = provenanced(product.features || [], ctx.source, "authoritative");
  ctx.emotionalAngles = provenanced(
    product.emotionalAngles || [],
    ctx.source,
    "authoritative"
  );
  ctx.useCases = provenanced(product.useCases || [], ctx.source, "authoritative");
  ctx.images = product.images || [];
  ctx.primaryImage = ctx.images[0] || null;
  ctx.completeness = computeProductCompleteness(ctx);
  return ctx;
}

export function brandContextFromBrief(brief: CreativeBrief): BrandContext {
  const b = brief.brand;
  if (!b || (!b.snapshot && !b.name)) {
    return emptyBrandContext();
  }
  const ctx = emptyBrandContext();
  ctx.snapshot = b.snapshot;
  ctx.guidelinesApplied = !!b.guidelinesApplied;
  if (b.name?.trim()) {
    ctx.identity.name = provenanced(b.name.trim(), "brand_snapshot", "authoritative");
  }
  ctx.identity.logo = b.logo || null;
  ctx.identity.colors = {
    primary: b.primaryColors?.[0] || null,
    secondary: b.primaryColors?.[1] || null,
    accent: b.primaryColors?.[2] || null,
    background: null,
    text: null,
    palette: b.primaryColors || [],
  };
  if (b.fonts?.trim()) {
    ctx.identity.fonts = provenanced(b.fonts.trim(), "brand_snapshot", "authoritative");
  }
  if (b.tone?.trim()) {
    ctx.communication.tone = provenanced(b.tone.trim(), "brand_snapshot", "authoritative");
  }
  if (b.voice?.trim()) {
    ctx.communication.voice = provenanced(b.voice.trim(), "brand_snapshot", "authoritative");
  }
  if (b.audience?.trim()) {
    ctx.communication.audience = provenanced(
      b.audience.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  if (b.industry?.trim()) {
    ctx.communication.industry = provenanced(
      b.industry.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  if (b.tagline?.trim()) {
    ctx.communication.tagline = provenanced(
      b.tagline.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  if (b.coreValueProp?.trim()) {
    ctx.communication.coreValueProp = provenanced(
      b.coreValueProp.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  ctx.communication.values = b.values || [];
  ctx.visual.aestheticTags = b.aestheticTags || [];
  ctx.completeness = computeBrandCompleteness(ctx);
  return ctx;
}

export function referenceContextFromBrief(brief: CreativeBrief): ReferenceContext {
  const ctx = emptyReferenceContext();
  ctx.productReferences = (brief.productReferences || []).map((r) => ({
    id: r.id,
    role: r.role,
    image: r.image,
    source: "user_session" as const,
    designAnalysis: r.designAnalysis,
    influence: r.influence,
  }));
  ctx.designReferences = (brief.designReferences || []).map((r) => ({
    id: r.id,
    role: r.role,
    image: r.image,
    source: "user_session" as const,
    designAnalysis: r.designAnalysis,
    influence: r.influence,
  }));
  ctx.supportingReferences = (brief.supportingReferences || []).map((r) => ({
    id: r.id,
    role: r.role,
    image: r.image,
    source: "user_session" as const,
  }));
  ctx.completeness = computeReferenceCompleteness(ctx);
  return ctx;
}

export function strategistInputFromBrief(
  brief: CreativeBrief
): {
  brief: CreativeBrief;
  product: ProductContext;
  brand: BrandContext;
  references: ReferenceContext;
} {
  return {
    brief,
    product: productContextFromBriefProduct(brief.product),
    brand: brandContextFromBrief(brief),
    references: referenceContextFromBrief(brief),
  };
}
