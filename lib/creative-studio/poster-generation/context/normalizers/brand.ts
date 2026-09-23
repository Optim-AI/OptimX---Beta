/**
 * Normalize BrandSnapshot → BrandContext.
 * Does not invent missing brand rules or colors.
 */

import type { BrandSnapshot } from "@/app/web/src/components/creative-studio/types";
import {
  computeBrandCompleteness,
  emptyBrandContext,
  type BrandContext,
} from "../brand-context";
import { provenanced } from "../provenance";
import { imageRefFromUrl } from "./helpers";

export function normalizeBrandSnapshot(
  snapshot: BrandSnapshot | null | undefined,
  options?: { brandId?: string | null; guidelinesApplied?: boolean }
): BrandContext {
  const ctx = emptyBrandContext();
  if (!snapshot) {
    ctx.completeness = "none";
    ctx.sourceMetadata.notes.push("No brand snapshot provided");
    return ctx;
  }

  ctx.snapshot = snapshot;
  ctx.brandId = options?.brandId ?? null;
  ctx.guidelinesApplied = options?.guidelinesApplied ?? true;

  if (snapshot.name?.trim()) {
    ctx.identity.name = provenanced(
      snapshot.name.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }

  const logoUrl = snapshot.logo || snapshot.logoUrl;
  if (logoUrl?.trim()) {
    ctx.identity.logo = imageRefFromUrl(logoUrl.trim());
  }

  const palette: string[] = [];
  if (Array.isArray(snapshot.primaryColors)) {
    for (const c of snapshot.primaryColors) {
      if (typeof c === "string" && c.trim()) palette.push(c.trim());
    }
  }
  ctx.identity.colors = {
    primary: snapshot.colors?.primary || palette[0] || null,
    secondary: snapshot.colors?.secondary || palette[1] || null,
    accent: snapshot.colors?.accent || palette[2] || null,
    background: null,
    text: null,
    palette,
  };

  const font =
    snapshot.primaryFont || snapshot.fontStyles || null;
  if (font && String(font).trim()) {
    ctx.identity.fonts = provenanced(
      String(font).trim(),
      "brand_snapshot",
      "authoritative"
    );
  }

  if (snapshot.tone?.trim()) {
    ctx.communication.tone = provenanced(
      snapshot.tone.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  if (snapshot.brandVoice) {
    ctx.communication.voice = provenanced(
      snapshot.brandVoice,
      "brand_snapshot",
      "authoritative"
    );
  }
  if (snapshot.audience?.trim()) {
    ctx.communication.audience = provenanced(
      snapshot.audience.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  if (snapshot.industry?.trim()) {
    ctx.communication.industry = provenanced(
      snapshot.industry.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  if (snapshot.tagline?.trim()) {
    ctx.communication.tagline = provenanced(
      snapshot.tagline.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  if (snapshot.coreValueProp?.trim()) {
    ctx.communication.coreValueProp = provenanced(
      snapshot.coreValueProp.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  if (snapshot.description?.trim()) {
    ctx.communication.description = provenanced(
      snapshot.description.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  if (snapshot.offering?.trim()) {
    ctx.communication.offering = provenanced(
      snapshot.offering.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }
  ctx.communication.values = Array.isArray(snapshot.brand_values)
    ? snapshot.brand_values.map(String).filter(Boolean)
    : [];
  ctx.communication.ctaPatterns = Array.isArray(snapshot.ctaPatterns)
    ? snapshot.ctaPatterns.map(String).filter(Boolean)
    : [];

  ctx.visual.aestheticTags = Array.isArray(snapshot.brand_aesthetic)
    ? snapshot.brand_aesthetic.map(String).filter(Boolean)
    : [];
  ctx.visual.toneTags = Array.isArray(snapshot.brand_tone)
    ? snapshot.brand_tone.map(String).filter(Boolean)
    : [];
  if (snapshot.pricePositioning) {
    ctx.visual.pricePositioning = provenanced(
      snapshot.pricePositioning,
      "brand_snapshot",
      "authoritative"
    );
  }
  if (snapshot.productCategory?.trim()) {
    ctx.visual.productCategory = provenanced(
      snapshot.productCategory.trim(),
      "brand_snapshot",
      "authoritative"
    );
  }

  ctx.completeness = computeBrandCompleteness(ctx);
  return ctx;
}
