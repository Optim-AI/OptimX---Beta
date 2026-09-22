/**
 * Deterministic fallback when the creative planner fails.
 * Simple prompt only — NOT a second blueprint architecture.
 */

import { compilePosterPrompt } from "./compile";
import type { PosterGenerationInput, PosterCreativeSpec, PosterPlanResult } from "./types";

function themeArtDirection(theme: string | null | undefined): string {
  const t = (theme || "commercial").toLowerCase();
  const map: Record<string, string> = {
    minimal:
      "Quiet composition, generous negative space, restrained type, soft lighting — art direction only.",
    professional:
      "Credible, structured hierarchy, clean materials, controlled palette — art direction only.",
    commercial:
      "Strong stop-power, clear hierarchy, conversion-minded clarity — art direction only, not a packshot template.",
    premium:
      "Editorial photography feel, refined type, controlled space, elevated materials — art direction only.",
    bold: "High contrast, confident scale, decisive focal point — art direction only.",
    playful:
      "Unexpected scale, expressive type, lively energy — art direction only, not cartoon clutter.",
    trendy:
      "Contemporary visual culture, fresh crop and type personality — art direction only.",
    festive:
      "Occasion-aware atmosphere and color warmth — art direction only, not decorations everywhere.",
    dynamic:
      "Motion energy and directional force in a still frame — art direction only, not diagonal-product cliché.",
  };
  return map[t] || `Express "${t}" as art direction language only — not a layout template.`;
}

export function buildFallbackSpec(
  input: PosterGenerationInput,
  variantIndex: number
): PosterCreativeSpec {
  const product = input.product;
  const brand = input.brand;
  const name = product?.name || brand?.name || "the product";
  const brief = input.userPrompt || input.creativeBrief || `Promote ${name}`;

  const mechanisms = [
    "PRODUCT_IN_USE",
    "BENEFIT_VISUALIZATION",
    "ENVIRONMENTAL_STORY",
  ] as const;
  const mechanism = mechanisms[Math.min(variantIndex, mechanisms.length - 1)];

  const concepts = [
    `Make the product's real-world moment the hero: ${brief}`,
    `Visualize the strongest benefit of ${name} so the viewer feels why it matters: ${brief}`,
    `Place ${name} inside an environment that tells the campaign story: ${brief}`,
  ];

  const headline =
    product?.shortBenefit ||
    brand?.coreValueProp ||
    brand?.tagline ||
    name;

  return {
    concept: concepts[Math.min(variantIndex, concepts.length - 1)],
    mechanism,
    message: brief.slice(0, 200),
    visualStory: `Show a clear relationship between the product, the benefit, and the audience moment implied by: ${brief}`,
    composition: `Build a natural scene around ${name}. Let the advertising idea — not a theme preset — decide placement. Keep quiet zones for type. Aspect ${input.aspectRatio}.`,
    productRole: variantIndex === 0 ? "hero" : variantIndex === 1 ? "in_use" : "environmental",
    typography:
      "One clear headline with optional short support. Type personality should match the brand voice. CTA only if conversion-focused.",
    graphicLanguage: "Minimal purposeful graphics — no badge stacks or decorative clutter.",
    imageTreatment: "Natural, commercial photography lighting that fits the scene.",
    copy: {
      headline: String(headline).slice(0, 80),
      supporting: product?.description
        ? String(product.description).slice(0, 120)
        : null,
      cta: null,
    },
    themeExpression: themeArtDirection(input.theme),
    brandIntegration: brand
      ? `Honor ${brand.name} identity (colors, voice, logo placement) without forcing brand color as the entire background.`
      : "No brand kit — keep design clean and product-true.",
    referenceInfluence: input.referencePoster
      ? "Borrow rhythm, hierarchy, and typographic character from the reference — never copy logos, text, or exact artwork."
      : "No reference poster.",
    variantLabel: `Fallback ${variantIndex + 1}`,
  };
}

export function buildFallbackPlan(input: PosterGenerationInput): PosterPlanResult {
  const variants = Array.from({ length: input.variantCount }, (_, i) => {
    const spec = buildFallbackSpec(input, i);
    return {
      spec,
      prompt: compilePosterPrompt(spec, input),
      variantIndex: i,
    };
  });

  return {
    usedFallback: true,
    model: null,
    selectedConcept: variants[0]?.spec.concept || "Fallback creative",
    variants,
  };
}
