/**
 * QC input assembly — Phase 7.
 */

import type { BrandContext } from "../context/brand-context";
import type { ProductContext } from "../context/product-context";
import type { ReferenceContext } from "../context/reference-context";
import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  GenerationSpecification,
  MarketingStrategy,
  PosterGeneratedAsset,
} from "../types";

export type PosterQcInput = {
  sessionId: string;
  brief: CreativeBrief;
  strategy: MarketingStrategy;
  concept: CreativeConcept;
  dna: CreativeDNA;
  specification: GenerationSpecification;
  asset: PosterGeneratedAsset;
  product: ProductContext;
  brand: BrandContext;
  references: ReferenceContext;
  /** data URL or http(s) URL of generated poster */
  imageUrl: string;
  /** Optional product reference image URLs for fidelity comparison */
  productReferenceUrls: string[];
};

export function formatQcContextForEvaluator(input: PosterQcInput): string {
  const parts: string[] = [];

  parts.push("=== GENERATION SPECIFICATION (authoritative render plan) ===");
  parts.push(`Aspect: ${input.specification.aspectRatio}`);
  parts.push(`Platform: ${input.specification.intendedPlatform}`);
  parts.push(`Territory: ${input.specification.scene.visualTerritory}`);
  parts.push(`Visual story: ${input.specification.scene.visualStory}`);
  parts.push(`Composition: ${input.specification.scene.composition}`);
  parts.push(`Product treatment: ${input.specification.scene.productTreatment}`);
  parts.push(`Environment: ${input.specification.scene.environment}`);
  parts.push(`Human presence: ${input.specification.scene.humanPresence}`);
  parts.push(`Lighting: ${input.specification.scene.lighting}`);
  parts.push(`Photography: ${input.specification.scene.photographyStyle}`);
  parts.push(`Color: ${input.specification.scene.colorStrategy}`);
  parts.push(`Typography: ${input.specification.scene.typography}`);
  parts.push(`Hierarchy: ${input.specification.scene.hierarchy}`);
  parts.push(`Mood: ${input.specification.scene.mood}`);
  parts.push("Approved copy (exact):");
  for (const slot of input.specification.copyHierarchy) {
    parts.push(`  [${slot.role}/${slot.importance}] ${slot.text}`);
  }
  parts.push(
    `Allowed claims: ${input.specification.strategyAlignment.allowedClaims.join("; ") || "(none)"}`
  );
  parts.push(
    `Forbidden claims: ${input.specification.strategyAlignment.forbiddenClaims.join("; ") || "(none)"}`
  );
  parts.push(`Product fidelity: ${input.specification.scene.productFidelityRules}`);
  parts.push(`Constraints: ${input.specification.constraints.referenceHandling}`);

  parts.push("\n=== CREATIVE CONCEPT ===");
  parts.push(`Name: ${input.concept.name}`);
  parts.push(`Territory: ${input.concept.territory}`);
  parts.push(`Description: ${input.concept.description}`);
  parts.push(`Rationale: ${input.concept.rationale}`);
  parts.push(`Differentiation: ${input.concept.differentiation}`);

  parts.push("\n=== CREATIVE DNA ===");
  parts.push(JSON.stringify({
    visualTerritory: input.dna.visualTerritory,
    composition: input.dna.composition,
    subjectTreatment: input.dna.subjectTreatment,
    productTreatment: input.dna.productTreatment,
    photographyStyle: input.dna.photographyStyle,
    lighting: input.dna.lighting,
    colorStrategy: input.dna.colorStrategy,
    typographyStrategy: input.dna.typographyStrategy,
    graphicLanguage: input.dna.graphicLanguage,
    humanPresence: input.dna.humanPresence,
    environment: input.dna.environment,
    mood: input.dna.mood,
    hierarchy: input.dna.hierarchy,
    visualRhythm: input.dna.visualRhythm,
  }));

  parts.push("\n=== MARKETING STRATEGY ===");
  parts.push(`Objective: ${input.strategy.objective}`);
  parts.push(`Primary message: ${input.strategy.primaryMessage}`);
  parts.push(`Audience: ${input.strategy.audience}`);
  parts.push(`CTA: ${input.strategy.copy.cta || "(none)"}`);

  parts.push("\n=== PRODUCT ===");
  parts.push(`Name: ${input.product.name?.value || "(unknown)"}`);
  parts.push(
    `Factual claims: ${input.product.factualClaims.value.join("; ") || "(none)"}`
  );

  parts.push("\n=== BRAND ===");
  parts.push(`Name: ${input.brand.identity.name?.value || "(none)"}`);
  parts.push(
    `Colors: ${input.brand.identity.colors.palette.join(", ") || "(none)"}`
  );

  parts.push("\n=== REFERENCES ===");
  parts.push(
    `Product refs: ${input.references.productReferences.length}; Design refs: ${input.references.designReferences.length}`
  );
  parts.push(
    "Design refs are INSPIRATION ONLY — do not fail for not copying them. Fail if reference product replaced the user's product."
  );

  parts.push("\n=== EVALUATION RULES ===");
  parts.push(
    "Judge EXPECTED vs OBSERVED against the specification. Do NOT invent a better creative concept."
  );
  parts.push(
    "If the image faithfully executed a flawed specification, set failureType=specification."
  );
  parts.push(
    "If the specification was correct but the image diverged, set failureType=generation_execution."
  );
  parts.push("QC consumes no image credits and must not request regeneration.");

  return parts.join("\n");
}
