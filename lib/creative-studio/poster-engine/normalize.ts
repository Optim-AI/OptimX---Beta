/**
 * Normalize raw request body / studio inputs into PosterGenerationInput.
 */

import type { BrandSnapshot } from "@/app/web/src/components/creative-studio/types";
import type { ReferencePosterAnalysis, ReferenceInfluenceLevel } from "./reference-types";
import {
  productToPosterContext,
  type PosterAspectRatio,
  type PosterGenerationInput,
  type PosterProductContext,
} from "./types";

function clampVariant(n: unknown): 1 | 2 | 3 {
  const num = Number(n);
  if (num <= 1) return 1;
  if (num === 2) return 2;
  return 3;
}

function normalizeAspect(v: unknown): PosterAspectRatio {
  const s = String(v || "1:1");
  if (s === "4:5" || s === "9:16" || s === "1.91:1" || s === "1:1") return s;
  return "1:1";
}

function asInfluence(v: unknown): ReferenceInfluenceLevel {
  if (v === "subtle" || v === "strong" || v === "balanced") return v;
  return "balanced";
}

export type NormalizePosterInputRaw = {
  brand?: BrandSnapshot | null;
  brandSnapshot?: BrandSnapshot | null;
  product?: Record<string, unknown> | null;
  productName?: string;
  userRequest?: string;
  prompt?: string;
  userPrompt?: string;
  campaignObjective?: string | null;
  objective?: string | null;
  audience?: string | null;
  theme?: string | null;
  aspectRatio?: string | null;
  variantCount?: number | null;
  websiteContext?: string | null;
  productBenefits?: string[] | null;
  brandGuidelines?: string | null;
  userConstraints?: string | null;
  creativeBrief?: string | null;
  hookBrief?: string | null;
  platform?: string | null;
  hasProductImage?: boolean;
  hasLogo?: boolean;
  hasReferencePoster?: boolean;
  referencePosterAnalysis?: ReferencePosterAnalysis | null;
  referenceInfluence?: ReferenceInfluenceLevel | string;
};

export function normalizePosterInput(raw: NormalizePosterInputRaw): PosterGenerationInput {
  const brand = (raw.brandSnapshot || raw.brand || null) as BrandSnapshot | null;

  let product: PosterProductContext | null = null;
  if (raw.product && typeof raw.product === "object") {
    product = productToPosterContext(raw.product as any);
  } else if (raw.productName) {
    product = { name: String(raw.productName) };
  }

  const userPrompt = String(
    raw.userPrompt || raw.userRequest || raw.prompt || ""
  ).trim();

  const benefits =
    raw.productBenefits ||
    product?.benefits ||
    null;

  return {
    brand,
    product,
    productImages: !!raw.hasProductImage,
    hasLogo: !!raw.hasLogo,
    referencePoster: raw.referencePosterAnalysis || null,
    referenceInfluence: asInfluence(raw.referenceInfluence),
    userPrompt,
    campaignObjective: raw.campaignObjective || raw.objective || null,
    audience: raw.audience || brand?.audience || product?.targetAudience || null,
    theme: raw.theme || null,
    aspectRatio: normalizeAspect(raw.aspectRatio),
    variantCount: clampVariant(raw.variantCount),
    websiteContext: raw.websiteContext || brand?.website_url || null,
    productBenefits: benefits,
    brandGuidelines: raw.brandGuidelines || null,
    userConstraints: raw.userConstraints || null,
    creativeBrief: raw.creativeBrief || raw.hookBrief || null,
    platform: raw.platform || null,
  };
}
