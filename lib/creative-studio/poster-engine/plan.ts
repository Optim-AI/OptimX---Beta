/**
 * Creative Planner — decides WHAT the advertisement is.
 * Does NOT generate images. Theme is art direction, not structure.
 */

import { createDefaultStructuredGenerator } from "@/lib/creative-studio/commercial-production/commercial-director/gemini-structured";
import {
  StructuredGenerationError,
  type StructuredGenerator,
} from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import { compilePosterPrompt } from "./compile";
import { buildFallbackPlan, buildFallbackSpec } from "./fallback";
import { formatReferenceForPlanner } from "./reference-types";
import {
  CREATIVE_MECHANISMS,
  PRODUCT_ROLES,
  type PosterGenerationInput,
  type PosterPlanResult,
} from "./types";
import { normalizeSpec, validateCreativeSpec } from "./validate";

const SYSTEM_PROMPT = `You are an advertising creative director + art director + brand strategist.

Your job is to invent a SPECIFIC, VISUALIZABLE advertising concept for a poster.
You are NOT a prompt engineer. You do NOT describe "premium product on beautiful background."

Rules:
1. CONCEPT FIRST — a sharp advertising idea someone could pitch in one sentence.
2. THEME IS NOT THE IDEA — theme is art-direction language only (minimal/commercial/premium/etc.). Never map theme → fixed layout.
3. MECHANISM — choose one from the allowed list because it fits THIS product and brief. Unexpected choices are welcome when they work.
4. COMPOSITION — describe the scene naturally in prose. Never output template labels like CENTERED_HERO.
5. PRODUCT ROLE — product need not be centered; choose a role that serves the idea.
6. TYPOGRAPHY & COPY — serve the concept. Sometimes headline is hero; sometimes one line; sometimes no CTA.
7. VARIANTS — each variant must be a genuinely different creative approach (different mechanism/idea), not minor layout tweaks.
8. REFERENCE (if any) — design inspiration only; never copy logos/text/product/artwork.
9. PRODUCT IMAGE — when a real product photo exists, packaging must stay true.

Avoid generic concepts:
- "Promote the product in a premium setting"
- "Create an attractive product advertisement"
- "Show the product with a beautiful background"

Good concepts:
- "The first quiet moment of the morning becomes the stage for a protein-rich breakfast ritual."
- "Turn sodium reduction into a visual comparison between what you normally pour and what changes."
- "Treat the perfume like an invisible trail of desire moving through the environment."

Return JSON only.`;

function buildUserPrompt(input: PosterGenerationInput, variantCount: number): string {
  const brand = input.brand;
  const product = input.product;
  const parts: string[] = [];

  parts.push(`Create ${variantCount} distinct poster creative specification(s).`);
  parts.push("");
  parts.push("=== BRIEF ===");
  parts.push(input.userPrompt || "(no user prompt — invent from product/brand)");
  if (input.creativeBrief && input.creativeBrief !== input.userPrompt) {
    parts.push(`Creative brief: ${input.creativeBrief}`);
  }
  if (input.campaignObjective) parts.push(`Campaign objective: ${input.campaignObjective}`);
  if (input.audience) parts.push(`Audience: ${input.audience}`);
  if (input.platform) parts.push(`Platform: ${input.platform}`);
  if (input.userConstraints) parts.push(`Constraints: ${input.userConstraints}`);
  parts.push("");

  parts.push("=== PRODUCT ===");
  if (product) {
    parts.push(`Name: ${product.name}`);
    if (product.category) parts.push(`Category: ${product.category}`);
    if (product.description) parts.push(`Description: ${product.description}`);
    if (product.shortBenefit) parts.push(`Short benefit: ${product.shortBenefit}`);
    const benefits = input.productBenefits || product.benefits;
    if (benefits?.length) parts.push(`Benefits: ${benefits.join("; ")}`);
    if (product.emotionalAngles?.length) {
      parts.push(`Emotional angles: ${product.emotionalAngles.join("; ")}`);
    }
  } else {
    parts.push("No specific product — brand-level campaign.");
  }
  parts.push(`Has real product photo attached at generation: ${input.productImages ? "YES" : "NO"}`);
  parts.push("");

  parts.push("=== BRAND ===");
  if (brand) {
    parts.push(`Name: ${brand.name}`);
    if (brand.description) parts.push(`Description: ${brand.description}`);
    if (brand.offering) parts.push(`Offering: ${brand.offering}`);
    if (brand.tone || brand.brandVoice) {
      parts.push(`Tone/voice: ${brand.brandVoice || brand.tone}`);
    }
    if (brand.primaryColors?.length) {
      parts.push(`Colors: ${brand.primaryColors.join(", ")}`);
    }
    if (brand.coreValueProp) parts.push(`Value prop: ${brand.coreValueProp}`);
    if (brand.personality) parts.push(`Personality: ${brand.personality}`);
    if (brand.industry) parts.push(`Industry: ${brand.industry}`);
  } else {
    parts.push("No brand snapshot.");
  }
  parts.push(`Has logo asset: ${input.hasLogo ? "YES" : "NO"}`);
  parts.push("");

  parts.push("=== THEME (art direction ONLY) ===");
  parts.push(input.theme || "commercial");
  parts.push(
    "Theme must NOT define structure. Concept decides composition; theme flavors materials, type energy, and atmosphere."
  );
  parts.push("");

  parts.push(`=== ASPECT RATIO === ${input.aspectRatio}`);
  parts.push("");

  if (input.referencePoster) {
    parts.push(
      formatReferenceForPlanner(
        input.referencePoster,
        input.referenceInfluence || "balanced"
      )
    );
    parts.push("");
  }

  parts.push("=== ALLOWED MECHANISMS ===");
  parts.push(CREATIVE_MECHANISMS.join(", "));
  parts.push("");
  parts.push("=== ALLOWED PRODUCT ROLES ===");
  parts.push(PRODUCT_ROLES.join(", "));
  parts.push("");

  parts.push(`Return JSON:
{
  "variants": [
    {
      "variantLabel": "short label for this creative direction",
      "concept": "specific visualizable advertising concept",
      "mechanism": "ONE of allowed mechanisms",
      "message": "what the ad is saying / why someone cares",
      "visualStory": "relationship between elements in the image",
      "composition": "natural prose description of how the scene is built — NOT a template id",
      "productRole": "ONE of allowed roles",
      "typography": "personality, hierarchy, placement relative to imagery",
      "graphicLanguage": "graphic devices if any — purposeful only",
      "imageTreatment": "lighting, materials, photographic/graphic finish",
      "copy": {
        "headline": "concise advertising headline",
        "supporting": "optional short support or null",
        "cta": "optional CTA or null if not needed"
      },
      "themeExpression": "how the theme flavors THIS concept without becoming a template",
      "brandIntegration": "how brand identity appears intelligently",
      "referenceInfluence": "how reference grammar is adapted, or 'none'"
    }
  ]
}
Exactly ${variantCount} variant object(s). Each must be a different advertising idea.`);

  return parts.join("\n");
}

export type PlanPosterCreativeOptions = {
  generator?: StructuredGenerator;
  disableFallback?: boolean;
};

export async function planPosterCreative(
  input: PosterGenerationInput,
  options: PlanPosterCreativeOptions = {}
): Promise<PosterPlanResult> {
  const generator = options.generator ?? createDefaultStructuredGenerator();
  const variantCount = input.variantCount;

  try {
    const result = await generator.generateJson<{ variants?: unknown[] }>({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input, variantCount),
      schemaName: "poster-creative-spec-v1",
      temperature: 0.9,
      maxOutputTokens: 8192,
    });

    const rawVariants = Array.isArray(result.data?.variants)
      ? result.data.variants
      : [];

    const specs = rawVariants
      .map((r) => normalizeSpec(r, input.theme))
      .filter(Boolean)
      .slice(0, variantCount) as NonNullable<ReturnType<typeof normalizeSpec>>[];

    if (specs.length === 0) {
      throw new StructuredGenerationError("Planner returned no valid specs");
    }

    // Soft-validate; keep specs even with notes — only replace if critically empty
    for (const spec of specs) {
      const v = validateCreativeSpec(spec);
      if (!v.ok && process.env.NODE_ENV === "development") {
        console.warn("[posterEngine] spec.validation.notes", {
          concept: spec.concept.slice(0, 80),
          notes: v.notes,
        });
      }
    }

    // Pad with fallback specs if planner returned fewer than requested
    while (specs.length < variantCount) {
      specs.push(buildFallbackSpec(input, specs.length));
    }

    const variants = specs.map((spec, i) => ({
      spec,
      prompt: compilePosterPrompt(spec, input),
      variantIndex: i,
    }));

    if (process.env.NODE_ENV === "development" || process.env.POSTER_ENGINE_DEBUG === "1") {
      for (const v of variants) {
        console.log("\n========== POSTER CREATIVE PLAN ==========");
        console.log("Concept:", v.spec.concept);
        console.log("Mechanism:", v.spec.mechanism);
        console.log("Message:", v.spec.message);
        console.log("Visual Story:", v.spec.visualStory);
        console.log("Composition:", v.spec.composition);
        console.log("Product Role:", v.spec.productRole);
        console.log("Typography:", v.spec.typography);
        console.log("Copy:", JSON.stringify(v.spec.copy));
        console.log("Theme:", v.spec.themeExpression);
        console.log("Reference:", v.spec.referenceInfluence);
        console.log("\n========== FINAL IMAGE PROMPT ==========");
        console.log(v.prompt);
        console.log("========================================\n");
      }
    }

    return {
      usedFallback: false,
      model: result.model || null,
      selectedConcept: specs[0].concept,
      variants,
    };
  } catch (err: any) {
    console.warn("[posterEngine] plan failed — using deterministic fallback", err?.message || err);
    if (options.disableFallback) throw err;
    return buildFallbackPlan(input);
  }
}
