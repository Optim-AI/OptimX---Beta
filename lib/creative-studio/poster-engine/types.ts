/**
 * Poster Engine V1 — creative types.
 * Concept → Spec → Prompt. No blueprints, registries, or QC loops.
 */

import type { BrandSnapshot } from "@/app/web/src/components/creative-studio/types";
import type {
  ReferenceInfluenceLevel,
  ReferencePosterAnalysis,
} from "./reference-types";

export type PosterAspectRatio = "1:1" | "4:5" | "9:16" | "1.91:1";

/** Conceptual advertising mechanisms — not layout templates */
export const CREATIVE_MECHANISMS = [
  "HUMAN_RITUAL",
  "PROBLEM_SOLUTION",
  "TRANSFORMATION",
  "BEFORE_AFTER",
  "DEMONSTRATION",
  "HOW_IT_WORKS",
  "BENEFIT_VISUALIZATION",
  "INGREDIENT_STORY",
  "VISUAL_METAPHOR",
  "SURPRISE",
  "SOCIAL_CONNECTION",
  "OCCASION",
  "CULTURAL_MOMENT",
  "DESIRE",
  "PROOF",
  "PRODUCT_REVEAL",
  "PRODUCT_HERO",
  "PRODUCT_IN_USE",
  "OBJECT_STORY",
  "EDITORIAL",
  "ANNOTATED_PRODUCT",
  "SCALE_CONTRAST",
  "INTERACTION",
  "ENVIRONMENTAL_STORY",
  "SEQUENTIAL_STORY",
  "COMPARISON",
] as const;

export type CreativeMechanism = (typeof CREATIVE_MECHANISMS)[number];

export const PRODUCT_ROLES = [
  "hero",
  "supporting_object",
  "in_use",
  "environmental",
  "held",
  "secondary",
  "ingredient_anchor",
  "visual_endpoint",
  "dramatic_scale",
  "collection",
] as const;

export type ProductRole = (typeof PRODUCT_ROLES)[number];

export type PosterProductContext = {
  name: string;
  description?: string | null;
  benefits?: string[] | null;
  shortBenefit?: string | null;
  category?: string | null;
  emotionalAngles?: string[] | null;
  targetAudience?: string | null;
};

/** Single normalized input for the entire poster pipeline */
export type PosterGenerationInput = {
  brand: BrandSnapshot | null;
  product: PosterProductContext | null;
  productImages?: boolean;
  hasLogo?: boolean;
  referencePoster?: ReferencePosterAnalysis | null;
  referenceInfluence?: ReferenceInfluenceLevel;
  userPrompt: string;
  campaignObjective?: string | null;
  audience?: string | null;
  theme?: string | null;
  aspectRatio: PosterAspectRatio;
  variantCount: 1 | 2 | 3;
  websiteContext?: string | null;
  productBenefits?: string[] | null;
  brandGuidelines?: string | null;
  userConstraints?: string | null;
  creativeBrief?: string | null;
  platform?: string | null;
};

/**
 * Lean creative specification — every field must reach the image prompt.
 */
export type PosterCreativeSpec = {
  concept: string;
  mechanism: CreativeMechanism;
  message: string;
  visualStory: string;
  composition: string;
  productRole: ProductRole;
  typography: string;
  graphicLanguage: string;
  imageTreatment: string;
  copy: {
    headline: string;
    supporting?: string | null;
    cta?: string | null;
  };
  themeExpression: string;
  brandIntegration: string;
  referenceInfluence: string;
  /** Variant identity for logging / UI */
  variantLabel?: string;
};

export type PosterPlanResult = {
  usedFallback: boolean;
  model?: string | null;
  variants: Array<{
    spec: PosterCreativeSpec;
    prompt: string;
    variantIndex: number;
  }>;
  selectedConcept: string;
};

export function productToPosterContext(product: {
  product_name?: string;
  name?: string;
  description?: string | null;
  key_benefits?: string[] | null;
  benefits?: string[] | null;
  short_benefit?: string | null;
  shortBenefit?: string | null;
  category?: string | null;
  emotional_angles?: string[] | null;
  emotionalAngles?: string[] | null;
  target_audience?: string | null;
  targetAudience?: string | null;
} | null): PosterProductContext | null {
  if (!product) return null;
  const name = product.name || product.product_name;
  if (!name) return null;
  return {
    name: String(name),
    description: product.description,
    benefits: product.benefits || product.key_benefits || null,
    shortBenefit: product.shortBenefit || product.short_benefit || null,
    category: product.category,
    emotionalAngles: product.emotionalAngles || product.emotional_angles || null,
    targetAudience: product.targetAudience || product.target_audience || null,
  };
}
