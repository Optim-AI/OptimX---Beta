/**
 * Carousel Story Planner — one ordered story + shared visual system + per-slide
 * concepts, produced before any image generation. 0 image credits.
 */

import { createDefaultStructuredGenerator } from "@/lib/creative-studio/commercial-production/commercial-director/gemini-structured";
import {
  StructuredGenerationError,
  type StructuredGenerator,
} from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import type { BrandContext } from "../context/brand-context";
import type { ProductContext } from "../context/product-context";
import type { ReferenceContext } from "../context/reference-context";
import {
  formatReferencesForDirector,
  formatStrategyForDirector,
} from "../concept/concept-input";
import {
  formatBrandForStrategist,
  formatProductFactsForStrategist,
} from "../strategy/strategy-input";
import { formatThemeRecipeForDirector, resolveThemeRecipe } from "../theme-recipes";
import type { CreativeBrief, MarketingStrategy } from "../types";
import { PosterCarouselError } from "./errors";
import { isCarouselNarrativeStructure } from "./guards";
import {
  validateCarouselDraft,
  type CarouselPlanDraft,
} from "./story-validation";
import { slugifyRole, titleCase } from "./text-analysis";
import type { CarouselSlide, CarouselStory } from "./types";
import {
  buildSharedCarouselDNA,
  buildSlideConcept,
  buildSlideDNA,
  type CampaignDirection,
} from "./visual-system";

export type CarouselPlannerInput = {
  campaignId: string;
  slideCount: number;
  brief: CreativeBrief;
  strategy: MarketingStrategy;
  product: ProductContext;
  brand: BrandContext;
  references: ReferenceContext;
  direction: CampaignDirection;
};

export type PlanCarouselStoryOptions = {
  generator?: StructuredGenerator;
  /** Re-asks after validation failure (default 2) */
  maxRepairAttempts?: number;
  now?: () => string;
};

const SYSTEM_PROMPT = `You are a Campaign Story Planner and Creative Director for multi-slide social carousels.

A carousel is ONE campaign: one marketing strategy, one connected narrative, one shared visual identity — and a distinct creative idea per slide.

Rules:
1. Choose a narrative structure that fits the campaign goal (product_launch, educational, problem_solution, product_benefits, lifestyle_story, promotion, feature_explanation, social_proof, custom). Do NOT default to a fixed hook/problem/solution/proof/CTA template.
2. Use social_proof ONLY when the product data contains genuine evidence (reviews, ratings, awards). Never invent testimonials, ratings, awards, customer counts, prices, discounts, ingredients, or benefits.
3. Every slide has a DISTINCT narrative role and contribution. Copy must PROGRESS — never restate the same claim in different words.
4. Short carousels compress the story; long carousels expand it with genuinely new information, never filler.
5. Claims on any slide must come from the approved allowed claims or the product facts. Keep the strategy's objective, audience, and core message.
6. Only the closing slide carries a CTA, following the campaign CTA intent. Respect explicit user headline/CTA/offer overrides exactly.
7. Define ONE shared visual system (palette, typography, photography/illustration style, graphic language, lighting, mood, product representation, consistency rules, permitted variation) derived from the selected campaign direction and theme lock.
8. Consistency is NOT identical layouts. Vary composition, product scale/placement, subject treatment, environment, text hierarchy, and visual focus per slide. Do not make every slide a centered product hero.
9. Product references define WHAT the product looks like (exact packaging). Design references only influence visual language and never replace the product.
10. Headlines are short and renderable (max ~8 words). Supporting copy is one short sentence or null.

Return JSON only.`;

function narrativeGuidance(n: number): string {
  if (n <= 2) {
    return "2 slides: a compressed but complete story — an opening that earns the swipe, then a payoff/close.";
  }
  if (n <= 4) {
    return `${n} slides: opening, ${n - 2} focused development beat(s), closing.`;
  }
  if (n <= 7) {
    return `${n} slides: opening, a developed middle where each slide adds one new idea, and a closing slide.`;
  }
  return `${n} slides: an expanded narrative — each middle slide must add a new, specific contribution (feature, use, step, context). No filler, no repetition.`;
}

function buildUserPrompt(input: CarouselPlannerInput, repairHint: string): string {
  const theme = resolveThemeRecipe(input.brief.visualDirection);
  const parts: string[] = [];
  parts.push("=== USER INTENT ===");
  parts.push(input.brief.userInstruction || "(none)");
  parts.push(`Requested slide count: EXACTLY ${input.slideCount}`);
  parts.push(narrativeGuidance(input.slideCount));
  parts.push(`Aspect ratio: ${input.brief.aspectRatio}`);
  parts.push("\n" + formatThemeRecipeForDirector(theme));
  parts.push("\n=== MARKETING STRATEGY (authoritative — do not rewrite objective, message, or claims) ===");
  parts.push(formatStrategyForDirector(input.strategy));
  parts.push(`User overrides (must be preserved exactly): ${JSON.stringify(input.strategy.userOverrides)}`);
  parts.push("\n=== PRODUCT FACTS ===");
  parts.push(formatProductFactsForStrategist(input.product));
  parts.push("\n=== BRAND ===");
  parts.push(formatBrandForStrategist(input.brand));
  parts.push("\n=== REFERENCES ===");
  parts.push(formatReferencesForDirector(input.references));
  if (input.direction) {
    const c = input.direction.concept;
    const d = input.direction.dna;
    parts.push("\n=== SELECTED CAMPAIGN DIRECTION (seed for the shared visual system) ===");
    parts.push(`Name: ${c.name}\nIdea: ${c.description}\nTerritory: ${c.territory}`);
    parts.push(
      `DNA: palette=${d.colorStrategy}; typography=${d.typographyStrategy}; photography=${d.photographyStyle}; lighting=${d.lighting}; graphics=${d.graphicLanguage}; mood=${d.mood}`
    );
  }
  parts.push(`\nReturn JSON:
{
  "story": {
    "objective": "",
    "audience": "",
    "coreMessage": "",
    "narrativeStructure": "product_launch|educational|problem_solution|product_benefits|lifestyle_story|promotion|feature_explanation|social_proof|custom",
    "narrativeRationale": "why this structure fits the goal",
    "copyProgression": "how the copy builds slide to slide",
    "ctaIntent": "what the closing CTA should achieve, or \\"none\\""
  },
  "sharedVisualSystem": {
    "brandIdentity": "", "palette": "", "typography": "", "photographyStyle": "",
    "graphicLanguage": "", "productRepresentation": "", "mood": "", "visualHierarchy": "",
    "lighting": "", "recurringElements": [""], "consistencyRules": [""], "permittedVariation": [""]
  },
  "slides": [
    {
      "role": "short distinct narrative role, e.g. hook / why_it_matters / how_it_works / everyday_moment / close",
      "objective": "what this slide must achieve in the story",
      "headline": "",
      "supporting": "or null",
      "cta": "closing slide only, else null",
      "badges": ["only approved claims"],
      "claimsUsed": ["subset of allowed claims"],
      "concept": {
        "name": "", "description": "", "territory": "lifestyle|product_hero|editorial|typography_led|conceptual_metaphor|demonstration|social_ritual|environment_story|graphic|ingredient_feature|social_proof|seasonal",
        "visualStory": "", "composition": "distinct per slide", "subjectTreatment": "",
        "productTreatment": "hero|integrated|contextual|handheld|foreground|background|ingredient-associated",
        "environment": "", "humanPresence": "none|implied|partial|full|hands only",
        "cameraDirection": "", "typographyTreatment": "", "copyHierarchy": "", "differentiation": "how this slide differs from its neighbours"
      }
    }
  ]
}
Produce EXACTLY ${input.slideCount} slides in story order.${repairHint}`);
  return parts.join("\n");
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

function strList(v: unknown, max = 4): string[] {
  return Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean).slice(0, max) : [];
}

export function slideIdFor(campaignId: string, index: number): string {
  return `slide_${campaignId.replace(/-/g, "").slice(0, 12)}_${String(index + 1).padStart(2, "0")}`;
}

export function normalizeCarouselPlanRaw(
  raw: unknown,
  input: CarouselPlannerInput,
  createdAt: string
): CarouselPlanDraft {
  if (!raw || typeof raw !== "object") {
    throw new PosterCarouselError({
      code: "STORY_INVALID",
      message: "Planner returned a non-object",
      stage: "normalize",
      retryable: true,
    });
  }
  const r = raw as Record<string, any>;
  const s = r.story && typeof r.story === "object" ? r.story : {};
  const list: any[] = Array.isArray(r.slides) ? r.slides : [];

  const sharedDNA = buildSharedCarouselDNA({
    raw: r.sharedVisualSystem,
    id: `cdna_${input.campaignId.replace(/-/g, "").slice(0, 12)}`,
    direction: input.direction,
    brand: input.brand,
  });

  const slides: CarouselSlide[] = list.slice(0, 10).map((item, index) => {
    const it = item && typeof item === "object" ? item : {};
    const slideId = slideIdFor(input.campaignId, index);
    const roleRaw = str(it.role, `slide ${index + 1}`);
    const role = slugifyRole(roleRaw);
    const roleLabel = titleCase(roleRaw);
    const objective = str(it.objective);
    const concept = buildSlideConcept({
      raw: it.concept && typeof it.concept === "object" ? it.concept : {},
      slideId,
      index,
      roleLabel,
      objective,
      briefId: input.brief.id,
      strategyId: input.strategy.id,
      createdAt,
      direction: input.direction,
      shared: sharedDNA,
    });
    const supporting = str(it.supporting);
    const cta = str(it.cta);
    return {
      slideId,
      campaignId: input.campaignId,
      index,
      role,
      roleLabel,
      objective,
      copy: {
        headline: str(it.headline),
        supporting: supporting && !/^null$/i.test(supporting) ? supporting : null,
        cta: cta && !/^null$/i.test(cta) ? cta : null,
        badges: strList(it.badges, 3),
      },
      claimsUsed: strList(it.claimsUsed, 6),
      concept,
      dna: buildSlideDNA({ slideId, concept, shared: sharedDNA, direction: input.direction }),
      status: "planned",
      generationId: null,
      specification: null,
      asset: null,
      qc: null,
      error: null,
      attemptCount: 0,
      versionNumber: 1,
      history: [],
      iteration: null,
      lease: null,
      creditsCharged: 0,
      createdAt,
      updatedAt: createdAt,
    };
  });

  const structure = str(s.narrativeStructure, "custom");
  const story: CarouselStory = {
    objective: input.strategy.objective,
    audience: input.strategy.audience,
    coreMessage: input.strategy.primaryMessage || str(s.coreMessage),
    narrativeStructure: isCarouselNarrativeStructure(structure) ? structure : "custom",
    narrativeRationale: str(s.narrativeRationale),
    slideRoles: slides.map((x) => x.role),
    copyProgression: str(s.copyProgression),
    ctaIntent: str(s.ctaIntent, input.strategy.copy.cta ? "drive the strategy CTA" : "none"),
    strategyConstraints: {
      allowedClaims: [...input.strategy.allowedClaims],
      forbiddenClaims: [...input.strategy.forbiddenClaims],
      requiredDisclaimers: [...input.strategy.requiredDisclaimers],
    },
  };

  return { story, sharedDNA, slides };
}

export async function planCarouselStory(
  input: CarouselPlannerInput,
  options: PlanCarouselStoryOptions = {}
): Promise<CarouselPlanDraft & { repairs: string[]; attempts: number }> {
  if (input.strategy.briefId !== input.brief.id) {
    throw new PosterCarouselError({
      code: "STALE_STRATEGY",
      message: "Strategy does not match the current brief",
      stage: "planCarouselStory",
    });
  }
  const generator = options.generator ?? createDefaultStructuredGenerator();
  const maxRepairs = options.maxRepairAttempts ?? 2;
  const createdAt = (options.now ?? (() => new Date().toISOString()))();
  let lastIssues: string[] = [];

  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const hint = lastIssues.length
      ? `\n\nTHE PREVIOUS PLAN FAILED VALIDATION — fix every issue:\n- ${lastIssues.join("\n- ")}`
      : "";
    let raw: unknown;
    try {
      const result = await generator.generateJson<Record<string, unknown>>({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(input, hint),
        schemaName: "poster-carousel-story-v1",
        temperature: attempt === 0 ? 0.5 : 0.65,
        maxOutputTokens: 12288,
      });
      raw = result.data;
    } catch (err) {
      if (err instanceof StructuredGenerationError) {
        throw new PosterCarouselError({
          code: "PROVIDER",
          message: err.message || "Story planner provider failed",
          stage: "llm",
          retryable: true,
        });
      }
      throw err;
    }

    let draft: CarouselPlanDraft;
    try {
      draft = normalizeCarouselPlanRaw(raw, input, createdAt);
    } catch (err) {
      if (err instanceof PosterCarouselError && attempt < maxRepairs) {
        lastIssues = [err.message];
        continue;
      }
      throw err;
    }

    const result = validateCarouselDraft(draft, {
      slideCount: input.slideCount,
      strategy: input.strategy,
      brief: input.brief,
      product: input.product,
    });
    if (result.ok) {
      return { ...result.draft, repairs: result.repairs, attempts: attempt + 1 };
    }
    lastIssues = result.issues;
  }

  throw new PosterCarouselError({
    code: "STORY_INVALID",
    message: `Carousel story failed validation: ${lastIssues.join("; ")}`,
    stage: "validate",
    retryable: true,
    issues: lastIssues,
  });
}
