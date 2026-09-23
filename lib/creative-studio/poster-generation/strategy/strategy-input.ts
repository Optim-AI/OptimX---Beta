/**
 * Strategist input assembly — Phase 4.
 * Consumes Phase 1 CreativeBrief + Phase 3 contexts only.
 */

import type { BrandContext } from "../context/brand-context";
import type { ProductContext } from "../context/product-context";
import type { ReferenceContext } from "../context/reference-context";
import type { CreativeBrief } from "../types";

export type MarketingStrategistInput = {
  brief: CreativeBrief;
  product: ProductContext;
  brand: BrandContext;
  references: ReferenceContext;
};

/** Explicit copy/intent overrides extracted from user instruction + brief hints */
export type DetectedUserOverrides = {
  headline: string | null;
  cta: string | null;
  audience: string | null;
  message: string | null;
  offer: string | null;
};

/**
 * Parse lightweight explicit overrides from user text.
 * Does not invent — only captures clear "must say" patterns.
 */
export function detectUserOverrides(brief: CreativeBrief): DetectedUserOverrides {
  const text = brief.userInstruction || "";
  const overrides: DetectedUserOverrides = {
    headline: null,
    cta: null,
    audience: null,
    message: null,
    offer: brief.offerHint?.trim() || null,
  };

  if (brief.audienceHint?.trim()) {
    overrides.audience = brief.audienceHint.trim();
  }

  const headlineMatch =
    text.match(
      /headline\s*(?:must\s*(?:say|be|read)|should\s*(?:say|be))\s*:?\s*["“]([^"”]+)["”]/i
    ) ||
    text.match(/headline\s*:\s*["“]([^"”]+)["”]/i) ||
    text.match(/use\s+(?:the\s+)?headline\s*["“]([^"”]+)["”]/i);
  if (headlineMatch?.[1]?.trim()) {
    overrides.headline = headlineMatch[1].trim();
  }

  const ctaMatch =
    text.match(
      /cta\s*(?:must\s*(?:say|be)|should\s*(?:say|be))\s*:?\s*["“]([^"”]+)["”]/i
    ) ||
    text.match(/cta\s*:\s*["“]([^"”]+)["”]/i) ||
    text.match(/call\s*to\s*action\s*:\s*["“]?([^"”\n]+)["”]?/i);
  if (ctaMatch?.[1]?.trim()) {
    overrides.cta = ctaMatch[1].trim();
  }

  const audienceMatch = text.match(
    /(?:target\s+)?audience\s*(?:is|:)\s*["“]?([^"”\n.]+)["”]?/i
  );
  if (audienceMatch?.[1]?.trim() && !overrides.audience) {
    overrides.audience = audienceMatch[1].trim();
  }

  return overrides;
}

export function formatProductFactsForStrategist(product: ProductContext): string {
  const lines: string[] = [];
  lines.push(`Source: ${product.source}`);
  lines.push(`Completeness: ${product.completeness}`);
  if (product.name) {
    lines.push(
      `Name: ${product.name.value} [${product.name.source}/${product.name.confidence}]`
    );
  }
  if (product.brandName) {
    lines.push(
      `Brand: ${product.brandName.value} [${product.brandName.source}/${product.brandName.confidence}]`
    );
  }
  if (product.category) {
    lines.push(
      `Category: ${product.category.value} [${product.category.confidence}]`
    );
  }
  if (product.description) {
    lines.push(
      `Description: ${product.description.value} [${product.description.confidence}]`
    );
  }
  if (product.shortDescription) {
    lines.push(`Short: ${product.shortDescription.value}`);
  }
  if (product.price) {
    lines.push(
      `Price: ${product.price.value} [${product.price.confidence}]`
    );
  }
  if (product.factualClaims.value.length) {
    lines.push(
      `FACTUAL CLAIMS (authoritative/extracted only — use these): ${product.factualClaims.value.join("; ")}`
    );
  }
  if (product.benefits.value.length) {
    lines.push(
      `Benefits (from source): ${product.benefits.value.join("; ")} [${product.benefits.confidence}]`
    );
  }
  if (product.marketingClaims.value.length) {
    lines.push(
      `Marketing phrases already in source (optional creative language, NOT facts): ${product.marketingClaims.value.join("; ")}`
    );
  }
  if (product.targetAudience) {
    lines.push(`Product audience: ${product.targetAudience.value}`);
  }
  if (product.conflicts.length) {
    lines.push(
      `Conflicts (do not invent resolution): ${product.conflicts
        .map(
          (c) =>
            `${c.field}=${c.values.map((v) => `${v.value}@${v.source}`).join("|")}`
        )
        .join("; ")}`
    );
  }
  if (!product.name && product.images.length === 0) {
    lines.push("NO PRODUCT FACTS AVAILABLE");
  }
  return lines.join("\n");
}

export function formatBrandForStrategist(brand: BrandContext): string {
  if (brand.completeness === "none") return "NO BRAND CONTEXT";
  const lines: string[] = [];
  if (brand.identity.name) lines.push(`Name: ${brand.identity.name.value}`);
  if (brand.communication.audience) {
    lines.push(`Audience: ${brand.communication.audience.value}`);
  }
  if (brand.communication.tone) {
    lines.push(`Tone: ${brand.communication.tone.value}`);
  }
  if (brand.communication.voice) {
    lines.push(`Voice: ${brand.communication.voice.value}`);
  }
  if (brand.communication.industry) {
    lines.push(`Industry: ${brand.communication.industry.value}`);
  }
  if (brand.communication.coreValueProp) {
    lines.push(`Value prop: ${brand.communication.coreValueProp.value}`);
  }
  if (brand.communication.tagline) {
    lines.push(`Tagline: ${brand.communication.tagline.value}`);
  }
  if (brand.communication.offering) {
    lines.push(`Offering: ${brand.communication.offering.value}`);
  }
  if (brand.communication.values.length) {
    lines.push(`Values: ${brand.communication.values.join("; ")}`);
  }
  return lines.join("\n");
}
