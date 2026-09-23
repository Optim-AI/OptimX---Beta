/**
 * Creative Director — Phase 5.
 * Translates MarketingStrategy into diverse CreativeConcept[] + CreativeDNA.
 * Does NOT generate images, GenSpecs, or prompts.
 */

import { createDefaultStructuredGenerator } from "@/lib/creative-studio/commercial-production/commercial-director/gemini-structured";
import {
  StructuredGenerationError,
  type StructuredGenerator,
} from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import type { CreativeConcept, CreativeDNA } from "../types";
import {
  buildDirectorContextBlock,
  type CreativeDirectorInput,
} from "./concept-input";
import { PosterConceptError } from "./concept-errors";
import {
  normalizeConceptsRaw,
  validateConceptSet,
} from "./concept-validation";
import { validateConceptDiversity } from "./diversity";

const SYSTEM_PROMPT = `You are a Creative Director for advertising posters.

Your job: invent DISTINCT creative CONCEPTS — actual visual storytelling ideas — that communicate the MarketingStrategy.

A concept is NOT a style tag (Premium / Minimal / Bold / Festive).
A concept IS a creative territory with a clear idea (e.g. Morning Ritual, Protein Hero, Editorial Breakfast).

Rules:
1. Every concept must serve the SAME strategy (objective, audience, primary message, allowed claims, CTA).
2. Do NOT rewrite factual claims, invent medical outcomes, or change the CTA.
3. The VISUAL DIRECTION THEME LOCK is REQUIRED look & feel for EVERY concept. Territories differ; theme must still be obvious (Festive ≠ Minimal). Bake the recipe into visualDirectionExpression and DNA (color, type, graphics, mood, lighting, rhythm).
4. Each concept must explore a DIFFERENT creative territory / route.
5. Prefer ONE strong idea over decorative clutter (no random floating objects, particles, meaningless shapes) — unless the theme recipe explicitly calls for celebratory/playful supporting cues, and even then keep them purposeful.
6. Design references = high-level inspiration only. NEVER copy exact layout, text, or distinctive arrangement. Theme lock outranks vague design-ref mood if they conflict.
7. Product references = fidelity (true packaging/appearance). ALWAYS composite the exact user-uploaded packshot. Do not invent, redraw, or redesign packaging or logos.
8. Human presence is intentional: none | implied | partial | full | hands only — do not force people everywhere.
9. Environment must answer "why is this product here?" — no generic "beautiful studio background" for everything.
10. Typography/color are strategic directions shaped by the theme recipe + brand/product — not font/hex lists unless brand data provides them.
11. Do NOT invent packaging, URLs, phone numbers, or unsupported claims.
12. Include CreativeDNA for each concept (structured visual grammar — NOT an image prompt). DNA must reflect the theme lock.

Return JSON only.`;

function buildUserPrompt(input: CreativeDirectorInput): string {
  const schema = `
Return JSON:
{
  "concepts": [
    {
      "name": "Memorable creative idea name (not a style tag)",
      "description": "2-3 sentences: the actual creative idea",
      "territory": "one of: lifestyle|product_hero|editorial|typography_led|conceptual_metaphor|demonstration|social_ritual|environment_story|graphic|ingredient_feature|social_proof|seasonal",
      "rationale": "Why this concept serves the MarketingStrategy",
      "visualStory": "Narrative of what the viewer sees and understands",
      "composition": "Conceptual composition (centered hero / asymmetric editorial / typography-led / etc.) — no pixel coords",
      "subjectTreatment": "How the main subject is treated",
      "productTreatment": "hero|integrated|contextual|handheld|foreground|background|ingredient-associated — ALWAYS composite the exact user-uploaded product packshot; never invent or redesign packaging",
      "environment": "Specific contextual environment",
      "humanPresence": "none|implied|partial|full|hands only",
      "emotionalExpression": "Intended emotional expression — must fit the theme lock",
      "cameraDirection": "Conceptual camera/viewpoint — not lens mm",
      "typographyTreatment": "Role, hierarchy, density, personality — shaped by theme lock; no font picking unless brand specifies",
      "colorTreatment": "Color strategy from theme lock + brand/product — avoid automatic black/gold or red/green defaults",
      "graphicLanguage": "Graphic treatment language — must match theme lock",
      "supportingElements": "Only elements with a reason (theme-appropriate)",
      "copyHierarchy": "How strategy copy is ordered visually",
      "ctaTreatment": "How/whether CTA appears",
      "visualDirectionExpression": "REQUIRED: concrete sentence on how the selected theme chip is visibly expressed in THIS concept (not just repeating the chip name)",
      "differentiation": "One sentence: how this differs from sibling concepts",
      "dna": {
        "composition": "",
        "subjectTreatment": "",
        "productTreatment": "",
        "photographyStyle": "",
        "lighting": "must reflect theme lock",
        "colorStrategy": "must reflect theme lock",
        "typographyStrategy": "must reflect theme lock",
        "graphicLanguage": "must reflect theme lock",
        "humanPresence": "",
        "environment": "",
        "mood": "must reflect theme lock",
        "hierarchy": "",
        "visualRhythm": "must reflect theme lock",
        "aspectAwareNotes": ""
      }
    }
  ]
}

Produce exactly ${input.conceptCount} concept(s). Each must have a different territory. All must clearly express the same VISUAL DIRECTION THEME LOCK.`;

  return `${buildDirectorContextBlock(input)}\n\n${schema}`;
}

export type GenerateCreativeConceptsOptions = {
  generator?: StructuredGenerator;
  /** Max diversity-repair regenerations (default 2) */
  maxDiversityRetries?: number;
};

export type GenerateCreativeConceptsResult = {
  concepts: CreativeConcept[];
  dnaByConceptId: Record<string, CreativeDNA>;
};

export async function generateCreativeConcepts(
  input: CreativeDirectorInput,
  options: GenerateCreativeConceptsOptions = {}
): Promise<GenerateCreativeConceptsResult> {
  if (!input?.brief?.id) {
    throw new PosterConceptError({
      code: "MISSING_BRIEF",
      message: "CreativeBrief is required",
      stage: "generateCreativeConcepts",
    });
  }
  if (!input?.strategy?.id) {
    throw new PosterConceptError({
      code: "MISSING_STRATEGY",
      message: "MarketingStrategy is required",
      stage: "generateCreativeConcepts",
    });
  }
  if (input.strategy.briefId !== input.brief.id) {
    throw new PosterConceptError({
      code: "STALE_STRATEGY",
      message: "Strategy does not match the current brief",
      stage: "generateCreativeConcepts",
    });
  }

  const generator = options.generator ?? createDefaultStructuredGenerator();
  const maxRetries = options.maxDiversityRetries ?? 2;
  const createdAt = new Date().toISOString();

  let lastDiversityIssues: string[] = [];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const diversityHint =
      attempt === 0
        ? ""
        : `\n\nPREVIOUS SET FAILED DIVERSITY VALIDATION:\n${lastDiversityIssues.join(
            "\n"
          )}\nRegenerate ${input.conceptCount} concepts with DIFFERENT territories and meaningfully different human presence / product treatment / composition. Do not merely change colors or backgrounds.`;

    let raw: unknown;
    try {
      const result = await generator.generateJson<Record<string, unknown>>({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: buildUserPrompt(input) + diversityHint,
        schemaName: "poster-creative-concepts-v1",
        temperature: attempt === 0 ? 0.55 : 0.7,
        maxOutputTokens: 8192,
      });
      raw = result.data;
    } catch (err) {
      if (err instanceof StructuredGenerationError) {
        throw new PosterConceptError({
          code: "PROVIDER",
          message: err.message || "Concept provider failed",
          stage: "llm",
          retryable: true,
        });
      }
      throw err;
    }

    let normalized: GenerateCreativeConceptsResult;
    try {
      normalized = normalizeConceptsRaw(raw, {
        briefId: input.brief.id,
        strategyId: input.strategy.id,
        createdAt,
        conceptCount: input.conceptCount,
      });
    } catch (err) {
      if (err instanceof PosterConceptError && attempt < maxRetries) {
        lastDiversityIssues = [err.message];
        continue;
      }
      throw err;
    }

    const quality = validateConceptSet(
      normalized.concepts,
      normalized.dnaByConceptId,
      input.strategy
    );
    if (!quality.ok) {
      if (attempt < maxRetries) {
        lastDiversityIssues = quality.issues;
        continue;
      }
      throw new PosterConceptError({
        code: "VALIDATION",
        message: `Concepts failed quality checks: ${quality.issues.join("; ")}`,
        stage: "validate",
        retryable: true,
      });
    }

    const diversity = validateConceptDiversity(normalized.concepts);
    if (!diversity.ok) {
      lastDiversityIssues = diversity.issues;
      if (attempt < maxRetries) continue;
      throw new PosterConceptError({
        code: "INSUFFICIENT_DIVERSITY",
        message: `Insufficient concept diversity: ${diversity.issues.join("; ")}`,
        stage: "diversity",
        retryable: true,
      });
    }

    return normalized;
  }

  throw new PosterConceptError({
    code: "INSUFFICIENT_DIVERSITY",
    message: `Could not produce diverse concepts: ${lastDiversityIssues.join("; ")}`,
    stage: "diversity",
    retryable: true,
  });
}

export type { CreativeDirectorInput };
