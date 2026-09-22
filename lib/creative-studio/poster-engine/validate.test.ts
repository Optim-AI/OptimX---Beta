/**
 * Poster Engine V1 — smoke tests for normalize / validate / compile / fallback.
 * Run: node --import tsx lib/creative-studio/poster-engine/validate.test.ts
 */

import { compilePosterPrompt } from "./compile";
import { buildFallbackPlan, buildFallbackSpec } from "./fallback";
import { normalizePosterInput } from "./normalize";
import {
  normalizeSpec,
  validateCreativeSpec,
} from "./validate";
import type { PosterGenerationInput } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

const sampleInput: PosterGenerationInput = normalizePosterInput({
  brandSnapshot: {
    name: "Yoga Bar",
    description: "High protein nutrition",
    audience: "Fitness-minded adults",
    offering: "Protein oats",
    tone: "energetic",
    primaryColors: ["#2D5A27", "#F5A623"],
    coreValueProp: "20g protein breakfast",
  },
  product: {
    name: "Yoga Bar High Protein Oats",
    description: "Protein-packed oats for morning fuel",
    benefits: ["20g protein", "No added sugar"],
    shortBenefit: "20g protein breakfast",
    category: "breakfast",
  },
  userRequest: "Create a breakfast ritual campaign.",
  theme: "minimal",
  aspectRatio: "4:5",
  variantCount: 3,
  hasProductImage: true,
  hasLogo: true,
  campaignObjective: "Drive consideration",
  audience: "Busy professionals",
});

assert(sampleInput.product?.name === "Yoga Bar High Protein Oats", "normalize product");
assert(sampleInput.variantCount === 3, "normalize variants");
assert(sampleInput.theme === "minimal", "normalize theme");

const fallback = buildFallbackPlan(sampleInput);
assert(fallback.usedFallback === true, "fallback flag");
assert(fallback.variants.length === 3, "3 fallback variants");
assert(
  fallback.variants[0].spec.mechanism !== fallback.variants[1].spec.mechanism ||
    fallback.variants[0].spec.concept !== fallback.variants[1].spec.concept,
  "fallback variants differ"
);

const prompt = fallback.variants[0].prompt;
assert(prompt.includes("CREATIVE IDEA"), "prompt has creative idea section");
assert(prompt.includes("THEME (art direction"), "prompt treats theme as art direction");
assert(prompt.includes("PRODUCT IMAGE IS SOURCE OF TRUTH"), "product preservation");
assert(!/CENTERED_HERO|headline top.*cta bottom/i.test(prompt), "no template ids");

const goodSpec = normalizeSpec({
  concept:
    "The first quiet moment of the morning becomes the visual stage for a protein-rich breakfast ritual.",
  mechanism: "HUMAN_RITUAL",
  message: "Start strong without rushing the morning.",
  visualStory: "Person → breakfast bowl → product → calm energy.",
  composition:
    "Place the breakfast bowl in the foreground and let the product sit slightly behind on the counter. Morning light creates a path toward the product. Keep upper-right quiet for headline.",
  productRole: "supporting_object",
  typography: "Quiet sans headline, integrated into the light wall.",
  graphicLanguage: "None beyond natural scene elements.",
  imageTreatment: "Soft morning window light, natural materials.",
  copy: { headline: "The quiet protein morning", supporting: null, cta: null },
  themeExpression: "Minimal: negative space and restraint — not empty template.",
  brandIntegration: "Yoga Bar greens as accents in ceramics and type, not full background.",
  referenceInfluence: "none",
});
assert(goodSpec, "normalize good spec");
const v = validateCreativeSpec(goodSpec!);
assert(v.ok, `good spec should validate: ${v.notes.join(", ")}`);

const compiled = compilePosterPrompt(goodSpec!, sampleInput);
assert(compiled.includes(goodSpec!.concept), "compiler includes concept");
assert(compiled.includes("The quiet protein morning"), "compiler includes headline");

const badSpec = buildFallbackSpec(sampleInput, 0);
badSpec.concept = "Promote the product in a premium setting.";
const badV = validateCreativeSpec(badSpec);
assert(!badV.ok || badV.notes.length > 0, "generic concept flagged");

console.log("poster-engine validate.test.ts: PASS");
