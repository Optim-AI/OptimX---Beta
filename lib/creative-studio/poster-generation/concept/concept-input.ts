/**
 * Creative Director input assembly — Phase 5.
 * Consumes CreativeBrief + MarketingStrategy + Phase 3 contexts.
 */

import type { BrandContext } from "../context/brand-context";
import type { ProductContext } from "../context/product-context";
import type { ReferenceContext } from "../context/reference-context";
import type { CreativeBrief, MarketingStrategy, PosterVariantCount } from "../types";
import {
  formatBrandForStrategist,
  formatProductFactsForStrategist,
} from "../strategy/strategy-input";
import {
  formatThemeRecipeForDirector,
  resolveThemeRecipe,
} from "../theme-recipes";

export type CreativeDirectorInput = {
  brief: CreativeBrief;
  strategy: MarketingStrategy;
  product: ProductContext;
  brand: BrandContext;
  references: ReferenceContext;
  conceptCount: PosterVariantCount;
};

export function clampConceptCount(raw: unknown): PosterVariantCount {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (n === 1 || n === 2 || n === 3) return n;
  return 3;
}

export function formatStrategyForDirector(strategy: MarketingStrategy): string {
  return [
    `Objective: ${strategy.objective}`,
    `Audience: ${strategy.audience}`,
    `Primary message: ${strategy.primaryMessage}`,
    `Communication angle: ${strategy.communicationAngle}`,
    `Value proposition: ${strategy.valueProposition}`,
    `Emotional direction: ${strategy.emotionalDirection}`,
    `Rationale: ${strategy.rationale}`,
    `Supporting messages: ${strategy.supportingMessages.join("; ") || "(none)"}`,
    `Copy headline: ${strategy.copy.headline}`,
    `Copy supporting: ${strategy.copy.supporting || "(none)"}`,
    `Copy product line: ${strategy.copy.productLine || "(none)"}`,
    `CTA: ${strategy.copy.cta || "(none — omit if not useful)"}`,
    `Badges (facts only): ${strategy.copy.badges.join("; ") || "(none)"}`,
    `Information hierarchy: ${strategy.informationHierarchy.join(" → ")}`,
    `Allowed claims: ${strategy.allowedClaims.join("; ") || "(none)"}`,
    `Forbidden claims: ${strategy.forbiddenClaims.join("; ") || "(none)"}`,
    `Restricted claims: ${strategy.restrictedClaims.join("; ") || "(none)"}`,
  ].join("\n");
}

export function formatReferencesForDirector(references: ReferenceContext): string {
  const lines: string[] = [];
  lines.push(
    `Product refs: ${references.productReferences.length} (fidelity / appearance only)`
  );
  lines.push(
    `Design refs: ${references.designReferences.length} (inspiration — NEVER copy exact layout/text/decor)`
  );
  lines.push(
    `Supporting refs: ${references.supportingReferences.length}`
  );

  for (const ref of references.designReferences.slice(0, 3)) {
    const a = ref.designAnalysis;
    if (!a) continue;
    lines.push(
      `Design ref cues (high-level only): composition=${a.composition || "?"} typography=${a.typography || "?"} treatment=${a.visualTreatment || "?"} — extract characteristics, do not reproduce.`
    );
  }
  return lines.join("\n");
}

export function buildDirectorContextBlock(input: CreativeDirectorInput): string {
  const parts: string[] = [];
  const theme = resolveThemeRecipe(input.brief.visualDirection);

  parts.push("=== USER INTENT (CreativeBrief) ===");
  parts.push(input.brief.userInstruction || "(none)");
  parts.push(`Selected visual direction chip: ${theme.label}`);
  parts.push(`Aspect ratio (for DNA notes only): ${input.brief.aspectRatio}`);
  parts.push(`Requested concept count: ${input.conceptCount}`);
  if (input.brief.constraints.length) {
    parts.push(`Constraints: ${input.brief.constraints.join("; ")}`);
  }

  parts.push("\n" + formatThemeRecipeForDirector(theme));

  parts.push("\n=== MARKETING STRATEGY (do not rewrite facts/CTA/objective) ===");
  parts.push(formatStrategyForDirector(input.strategy));

  parts.push("\n=== PRODUCT FACTS ===");
  parts.push(formatProductFactsForStrategist(input.product));

  parts.push("\n=== BRAND CONTEXT ===");
  parts.push(formatBrandForStrategist(input.brand));

  parts.push("\n=== REFERENCES ===");
  parts.push(formatReferencesForDirector(input.references));

  return parts.join("\n");
}
