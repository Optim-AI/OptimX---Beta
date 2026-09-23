/**
 * GenerationSpecification validation — Phase 6.
 */

import { assertGenerationSpecificationShape } from "../guards";
import type { GenerationSpecification, MarketingStrategy } from "../types";
import { PosterGenerationError } from "./generation-errors";

export type SpecValidationResult = {
  ok: boolean;
  issues: string[];
};

export function validateGenerationSpecification(
  spec: GenerationSpecification,
  strategy: MarketingStrategy
): SpecValidationResult {
  const issues: string[] = [];

  if (!assertGenerationSpecificationShape(spec)) {
    issues.push("GenerationSpecification failed shape validation");
    return { ok: false, issues };
  }

  if (spec.strategyId !== strategy.id) {
    issues.push("specification strategyId does not match strategy");
  }
  if (!spec.renderCopy.headline.trim()) {
    issues.push("headline is required");
  }

  // User overrides must be preserved exactly
  if (
    strategy.userOverrides?.headline &&
    spec.renderCopy.headline !== strategy.userOverrides.headline
  ) {
    issues.push("user override headline was not preserved");
  }
  if (
    strategy.userOverrides?.cta &&
    spec.renderCopy.cta !== strategy.userOverrides.cta
  ) {
    issues.push("user override CTA was not preserved");
  }

  // Strategy primary message alignment
  if (
    spec.strategyAlignment.primaryMessage !== strategy.primaryMessage
  ) {
    issues.push("strategy primaryMessage was rewritten");
  }
  if (spec.strategyAlignment.objective !== strategy.objective) {
    issues.push("strategy objective was rewritten");
  }

  // Required copy slots must appear in hierarchy
  const primary = spec.copyHierarchy.find((c) => c.role === "primary");
  if (!primary || primary.text !== spec.renderCopy.headline) {
    issues.push("copyHierarchy primary must match renderCopy.headline");
  }

  if (!spec.scene.productFidelityRules.trim()) {
    issues.push("productFidelityRules required");
  }
  if (!spec.constraints.copyFidelity.trim()) {
    issues.push("copyFidelity constraint required");
  }

  const hasProductRefUrl = spec.references.some(
    (r) => r.kind === "product" && typeof r.url === "string" && !!r.url.trim()
  );
  if (
    /AUTHORITATIVE:\s*The attached PRODUCT/i.test(
      spec.constraints.productFidelity
    ) &&
    !hasProductRefUrl
  ) {
    issues.push(
      "product reference URL required when product fidelity is locked to an uploaded packshot"
    );
  }

  return { ok: issues.length === 0, issues };
}

export function assertValidGenerationSpecification(
  spec: GenerationSpecification,
  strategy: MarketingStrategy
): void {
  const result = validateGenerationSpecification(spec, strategy);
  if (!result.ok) {
    throw new PosterGenerationError({
      code: "MALFORMED_SPEC",
      message: `Invalid GenerationSpecification: ${result.issues.join("; ")}`,
      stage: "validateSpecification",
      retryable: false,
    });
  }
}
