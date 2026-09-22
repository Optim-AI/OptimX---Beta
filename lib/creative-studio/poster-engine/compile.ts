/**
 * Compile PosterCreativeSpec → final Nano Banana 2 image prompt.
 */

import type { PosterGenerationInput, PosterCreativeSpec } from "./types";

function aspectBrief(aspect: string): string {
  switch (aspect) {
    case "9:16":
      return "Vertical 9:16 story/reel format — tall composition, strong vertical hierarchy.";
    case "4:5":
      return "Portrait 4:5 feed format — slightly tall, mobile-first crop.";
    case "1.91:1":
      return "Landscape 1.91:1 — wide horizontal composition.";
    default:
      return "Square 1:1 — balanced crop for feed posts.";
  }
}

export function compilePosterPrompt(
  spec: PosterCreativeSpec,
  input: PosterGenerationInput
): string {
  const brand = input.brand;
  const product = input.product;
  const lines: string[] = [];

  lines.push(
    "Create a finished advertising poster based on this creative concept — not a generic AI product mockup."
  );
  lines.push("");
  lines.push("=== CREATIVE IDEA ===");
  lines.push(spec.concept);
  lines.push(`Advertising mechanism: ${spec.mechanism}`);
  lines.push(`Core message: ${spec.message}`);
  lines.push("");

  lines.push("=== VISUAL STORY ===");
  lines.push(spec.visualStory);
  lines.push("");

  lines.push("=== COMPOSITION ===");
  lines.push(spec.composition);
  lines.push(`Aspect ratio: ${input.aspectRatio} — ${aspectBrief(input.aspectRatio)}`);
  lines.push("");

  lines.push("=== PRODUCT ===");
  lines.push(`Role in the scene: ${spec.productRole}`);
  if (product) {
    lines.push(`Product: ${product.name}`);
    if (product.description) lines.push(`About: ${product.description}`);
    if (product.shortBenefit) lines.push(`Benefit: ${product.shortBenefit}`);
    const benefits = input.productBenefits || product.benefits;
    if (benefits?.length) lines.push(`Key benefits: ${benefits.join("; ")}`);
  }
  if (input.productImages) {
    lines.push(
      "CRITICAL — PRODUCT IMAGE IS SOURCE OF TRUTH: A real product photo is attached. Preserve packaging, logo, label, shape, color, proportions, and recognizable details exactly. Do NOT redesign or invent packaging. Place the real product naturally into the scene."
    );
  }
  lines.push("");

  lines.push("=== TYPOGRAPHY ===");
  lines.push(spec.typography);
  lines.push("");

  lines.push("=== COPY (render these exact words when present) ===");
  lines.push(`Headline: ${spec.copy.headline}`);
  if (spec.copy.supporting) lines.push(`Supporting: ${spec.copy.supporting}`);
  if (spec.copy.cta) lines.push(`CTA: ${spec.copy.cta}`);
  else lines.push("CTA: none required for this concept.");
  lines.push("Do not invent alternate headlines. Do not add filler marketing slogans.");
  lines.push("");

  lines.push("=== GRAPHIC ELEMENTS ===");
  lines.push(spec.graphicLanguage);
  lines.push("");

  lines.push("=== LIGHTING / MATERIAL / IMAGE TREATMENT ===");
  lines.push(spec.imageTreatment);
  lines.push("");

  lines.push("=== BRAND ===");
  lines.push(spec.brandIntegration);
  if (brand) {
    lines.push(`Brand name: ${brand.name}`);
    if (brand.tone || brand.brandVoice) {
      lines.push(`Voice/tone: ${brand.brandVoice || brand.tone}`);
    }
    if (brand.primaryColors?.length) {
      lines.push(
        `Brand colors (use intelligently — not as forced full-bleed backgrounds): ${brand.primaryColors.join(", ")}`
      );
    } else if (brand.colors?.primary) {
      const cols = [brand.colors.primary, brand.colors.secondary, brand.colors.accent]
        .filter(Boolean)
        .join(", ");
      lines.push(`Brand colors (use intelligently): ${cols}`);
    }
    if (brand.coreValueProp) lines.push(`Value prop: ${brand.coreValueProp}`);
    if (brand.tagline) lines.push(`Tagline (only if it fits the concept): ${brand.tagline}`);
  }
  if (input.hasLogo) {
    lines.push(
      "A brand logo image is attached — place it cleanly where the composition supports it. Do not invent a different logo."
    );
  }
  lines.push("");

  lines.push("=== THEME (art direction modifier — NOT a layout template) ===");
  lines.push(spec.themeExpression);
  if (input.theme) {
    lines.push(
      `Requested theme label: "${input.theme}". Apply as visual language only. Do NOT collapse into a preset layout (e.g. commercial ≠ product-center + headline-top + CTA-bottom).`
    );
  }
  lines.push("");

  lines.push("=== REFERENCE ===");
  lines.push(spec.referenceInfluence);
  lines.push("");

  if (input.userPrompt) {
    lines.push("=== USER BRIEF (honor this intent) ===");
    lines.push(input.userPrompt);
    lines.push("");
  }
  if (input.creativeBrief && input.creativeBrief !== input.userPrompt) {
    lines.push("=== CREATIVE BRIEF ===");
    lines.push(input.creativeBrief);
    lines.push("");
  }
  if (input.campaignObjective) {
    lines.push(`Campaign objective: ${input.campaignObjective}`);
  }
  if (input.audience) {
    lines.push(`Audience: ${input.audience}`);
  }
  if (input.platform) {
    lines.push(`Platform context: ${input.platform}`);
  }
  lines.push("");

  lines.push("=== OUTPUT REQUIREMENTS ===");
  lines.push(
    "Deliver a professionally art-directed advertising poster that communicates the creative idea above."
  );
  lines.push(
    "Typography must belong to the design. Product must belong naturally in the scene."
  );
  lines.push(
    "Avoid generic AI packshots, stock smiles, decorative clutter, and template layouts."
  );
  lines.push(
    "The result should feel like a human creative team designed the campaign."
  );

  return lines.filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
}
