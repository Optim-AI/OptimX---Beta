/**
 * Creative concept + DNA normalization and quality validation — Phase 5.
 */

import { assertCreativeConceptShape, assertCreativeDnaShape } from "../guards";
import {
  CREATIVE_TERRITORIES,
  type CreativeConcept,
  type CreativeDNA,
  type CreativeTerritory,
  type MarketingStrategy,
} from "../types";
import { PosterConceptError } from "./concept-errors";

const TERRITORY_SET = new Set<string>(CREATIVE_TERRITORIES);

const GENERIC_CONCEPT_PATTERNS =
  /\b(premium product on a beautiful background|beautiful studio background|product centered on gradient|generic premium)\b/i;

function asTerritory(raw: unknown, fallback: CreativeTerritory): CreativeTerritory {
  const t = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const aliases: Record<string, CreativeTerritory> = {
    typographic: "typography_led",
    typography: "typography_led",
    conceptual: "conceptual_metaphor",
    metaphor: "conceptual_metaphor",
    producthero: "product_hero",
    hero: "product_hero",
    ingredient: "ingredient_feature",
    feature: "ingredient_feature",
    social: "social_proof",
    proof: "social_proof",
    environment: "environment_story",
    ritual: "social_ritual",
  };
  if (TERRITORY_SET.has(t)) return t as CreativeTerritory;
  if (aliases[t]) return aliases[t];
  return fallback;
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v).trim() || fallback;
}

export type NormalizeConceptsMeta = {
  briefId: string;
  strategyId: string;
  createdAt: string;
  conceptCount: number;
};

export type NormalizedConceptSet = {
  concepts: CreativeConcept[];
  dnaByConceptId: Record<string, CreativeDNA>;
};

export function normalizeConceptsRaw(
  raw: unknown,
  meta: NormalizeConceptsMeta
): NormalizedConceptSet {
  if (!raw || typeof raw !== "object") {
    throw new PosterConceptError({
      code: "MALFORMED_MODEL_OUTPUT",
      message: "Concept model returned non-object",
      stage: "normalize",
      retryable: true,
    });
  }

  const root = raw as Record<string, any>;
  const list = Array.isArray(root.concepts)
    ? root.concepts
    : Array.isArray(root)
      ? root
      : null;

  if (!list || !list.length) {
    throw new PosterConceptError({
      code: "MALFORMED_MODEL_OUTPUT",
      message: "Concept model returned no concepts array",
      stage: "normalize",
      retryable: true,
    });
  }

  const concepts: CreativeConcept[] = [];
  const dnaByConceptId: Record<string, CreativeDNA> = {};
  const fallbackTerritories: CreativeTerritory[] = [
    "lifestyle",
    "product_hero",
    "editorial",
  ];

  for (let i = 0; i < Math.min(list.length, meta.conceptCount); i++) {
    const item = list[i] && typeof list[i] === "object" ? list[i] : {};
    const id =
      str(item.id) ||
      `concept_${Math.random().toString(36).slice(2, 10)}_${i + 1}`;
    const territory = asTerritory(
      item.territory,
      fallbackTerritories[i] || "product_hero"
    );

    const concept: CreativeConcept = {
      id,
      briefId: meta.briefId,
      strategyId: meta.strategyId,
      createdAt: meta.createdAt,
      name: str(item.name, `Concept ${i + 1}`),
      description: str(
        item.description,
        str(item.visualStory, "Creative direction for this poster")
      ),
      territory,
      rationale: str(item.rationale),
      visualStory: str(item.visualStory),
      composition: str(item.composition),
      subjectTreatment: str(item.subjectTreatment),
      productTreatment: str(item.productTreatment),
      environment: str(item.environment),
      humanPresence: str(item.humanPresence, "none"),
      emotionalExpression: str(
        item.emotionalExpression,
        str(item.mood, "confidence")
      ),
      cameraDirection: str(item.cameraDirection, "Straightforward product framing"),
      typographyTreatment: str(item.typographyTreatment),
      colorTreatment: str(item.colorTreatment),
      graphicLanguage: str(item.graphicLanguage, "Restrained supporting graphics"),
      supportingElements: str(item.supportingElements, "Only elements that serve the idea"),
      copyHierarchy: str(item.copyHierarchy),
      ctaTreatment: str(item.ctaTreatment, "CTA only if strategy provides one"),
      visualDirectionExpression: str(
        item.visualDirectionExpression,
        "Apply visual direction as a modifier to this concept"
      ),
      differentiation: str(item.differentiation),
    };

    const dnaRaw =
      item.dna && typeof item.dna === "object"
        ? item.dna
        : root.dnaByConceptId?.[id] && typeof root.dnaByConceptId[id] === "object"
          ? root.dnaByConceptId[id]
          : {};

    const dna: CreativeDNA = {
      id: str(dnaRaw.id, `dna_${id}`),
      conceptId: id,
      visualTerritory: asTerritory(dnaRaw.visualTerritory, territory),
      composition: str(dnaRaw.composition, concept.composition),
      subjectTreatment: str(dnaRaw.subjectTreatment, concept.subjectTreatment),
      productTreatment: str(dnaRaw.productTreatment, concept.productTreatment),
      photographyStyle: str(
        dnaRaw.photographyStyle,
        "Photography or illustration direction matching the concept"
      ),
      lighting: str(dnaRaw.lighting, "Lighting that supports mood — not a template"),
      colorStrategy: str(dnaRaw.colorStrategy, concept.colorTreatment),
      typographyStrategy: str(
        dnaRaw.typographyStrategy,
        concept.typographyTreatment
      ),
      graphicLanguage: str(dnaRaw.graphicLanguage, concept.graphicLanguage),
      humanPresence: str(dnaRaw.humanPresence, concept.humanPresence),
      environment: str(dnaRaw.environment, concept.environment),
      mood: str(dnaRaw.mood, concept.emotionalExpression),
      hierarchy: str(dnaRaw.hierarchy, concept.copyHierarchy),
      visualRhythm: str(
        dnaRaw.visualRhythm,
        "Clear primary beat with restrained secondary accents"
      ),
      aspectAwareNotes: str(
        dnaRaw.aspectAwareNotes,
        "Respect requested aspect ratio without pixel-level layout"
      ),
    };

    concepts.push(concept);
    dnaByConceptId[id] = dna;
  }

  if (concepts.length !== meta.conceptCount) {
    throw new PosterConceptError({
      code: "VALIDATION",
      message: `Expected ${meta.conceptCount} concepts, got ${concepts.length}`,
      stage: "normalize",
      retryable: true,
    });
  }

  return { concepts, dnaByConceptId };
}

export type ConceptQualityResult = {
  ok: boolean;
  issues: string[];
};

export function validateConceptSet(
  concepts: CreativeConcept[],
  dnaByConceptId: Record<string, CreativeDNA>,
  strategy: MarketingStrategy
): ConceptQualityResult {
  const issues: string[] = [];

  for (const c of concepts) {
    if (!assertCreativeConceptShape(c)) {
      const id =
        c && typeof c === "object" && "id" in c
          ? String((c as { id?: unknown }).id ?? "?")
          : "?";
      issues.push(`Concept ${id} failed shape validation`);
      continue;
    }
    if (c.strategyId !== strategy.id) {
      issues.push(`Concept ${c.id} strategyId mismatch`);
    }
    if (!c.name.trim() || c.name.toLowerCase() === "premium") {
      issues.push(`Concept ${c.id} needs a real creative name, not a style tag`);
    }
    if (!c.description.trim() || c.description.length < 20) {
      issues.push(`Concept ${c.id} description too thin`);
    }
    if (!c.visualStory.trim() || c.visualStory.length < 12) {
      issues.push(`Concept ${c.id} missing visual story`);
    }
    if (!c.rationale.trim()) {
      issues.push(`Concept ${c.id} missing strategy rationale`);
    }
    if (!c.differentiation.trim()) {
      issues.push(`Concept ${c.id} missing differentiation`);
    }
    if (GENERIC_CONCEPT_PATTERNS.test(`${c.description} ${c.visualStory}`)) {
      issues.push(`Concept ${c.id} is too generic`);
    }
    // Style-tag-as-concept detection
    if (
      /^(premium|minimal|bold|festive|commercial|trendy|playful|professional|dynamic)$/i.test(
        c.name.trim()
      )
    ) {
      issues.push(`Concept ${c.id} name is a style tag, not a creative idea`);
    }

    const dna = dnaByConceptId[c.id];
    if (!dna || !assertCreativeDnaShape(dna)) {
      issues.push(`Concept ${c.id} missing valid CreativeDNA`);
    } else if (dna.conceptId !== c.id) {
      issues.push(`DNA conceptId mismatch for ${c.id}`);
    }
  }

  // Strategy must remain intact — concepts must not invent competing CTAs as facts
  // (soft check: copy hierarchy should acknowledge strategy headline when present)
  if (strategy.copy.headline && concepts.length) {
    const mentions = concepts.some(
      (c) =>
        c.copyHierarchy.toLowerCase().includes("headline") ||
        c.copyHierarchy.toLowerCase().includes(strategy.copy.headline.toLowerCase().slice(0, 12)) ||
        c.rationale.toLowerCase().includes("message") ||
        c.rationale.toLowerCase().includes("strategy")
    );
    if (!mentions) {
      // soft — do not fail hard; director may express hierarchy differently
    }
  }

  return { ok: issues.length === 0, issues };
}
