/**
 * Merge multiple ProductContext layers with deterministic precedence.
 * Records conflicts — does not invent or AI-resolve facts.
 */

import type { ProductContext } from "../product-context";
import { computeProductCompleteness, emptyProductContext } from "../product-context";
import type { ProvenancedValue } from "../provenance";
import { preferSource, recordConflict } from "./helpers";
import type { ProductSourceKind } from "../../types";

function mergeField<T>(
  conflicts: ProductContext["conflicts"],
  field: string,
  primary: ProvenancedValue<T> | null | undefined,
  secondary: ProvenancedValue<T> | null | undefined
): ProvenancedValue<T> | null {
  if (!primary && !secondary) return null;
  if (!primary) return secondary!;
  if (!secondary) return primary;
  if (String(primary.value) !== String(secondary.value)) {
    recordConflict(conflicts, field, primary, secondary);
  }
  const winnerSource = preferSource(primary.source, secondary.source);
  return winnerSource === primary.source ? primary : secondary;
}

function mergeStringList(
  conflicts: ProductContext["conflicts"],
  field: string,
  a: ProvenancedValue<string[]>,
  b: ProvenancedValue<string[]>
): ProvenancedValue<string[]> {
  const aEmpty = !a.value?.length;
  const bEmpty = !b.value?.length;
  if (aEmpty && bEmpty) return a;
  if (aEmpty) return b;
  if (bEmpty) return a;
  const aKey = [...a.value].sort().join("|");
  const bKey = [...b.value].sort().join("|");
  if (aKey !== bKey) {
    recordConflict(conflicts, field, a, b);
  }
  const winnerSource = preferSource(a.source, b.source);
  return winnerSource === a.source ? a : b;
}

/**
 * Merge contexts in priority order (first arg = lowest priority).
 * Final call: mergeProductContexts(upload, url, catalog, existing)
 */
export function mergeProductContexts(
  ...layers: Array<ProductContext | null | undefined>
): ProductContext {
  const valid = layers.filter(Boolean) as ProductContext[];
  if (valid.length === 0) return emptyProductContext("manual");

  let result = { ...valid[0], conflicts: [...valid[0].conflicts] };

  for (let i = 1; i < valid.length; i++) {
    const next = valid[i];
    const conflicts = [...result.conflicts, ...next.conflicts];

    result = {
      source: preferSource(result.source, next.source) as ProductSourceKind,
      productId: next.productId ?? result.productId,
      name: mergeField(conflicts, "name", result.name, next.name),
      brandName: mergeField(
        conflicts,
        "brandName",
        result.brandName,
        next.brandName
      ),
      category: mergeField(
        conflicts,
        "category",
        result.category,
        next.category
      ),
      description: mergeField(
        conflicts,
        "description",
        result.description,
        next.description
      ),
      shortDescription: mergeField(
        conflicts,
        "shortDescription",
        result.shortDescription,
        next.shortDescription
      ),
      features: mergeStringList(
        conflicts,
        "features",
        result.features,
        next.features
      ),
      benefits: mergeStringList(
        conflicts,
        "benefits",
        result.benefits,
        next.benefits
      ),
      factualClaims: mergeStringList(
        conflicts,
        "factualClaims",
        result.factualClaims,
        next.factualClaims
      ),
      marketingClaims: mergeStringList(
        conflicts,
        "marketingClaims",
        result.marketingClaims,
        next.marketingClaims
      ),
      price: mergeField(conflicts, "price", result.price, next.price),
      productUrl: mergeField(
        conflicts,
        "productUrl",
        result.productUrl,
        next.productUrl
      ),
      targetAudience: mergeField(
        conflicts,
        "targetAudience",
        result.targetAudience,
        next.targetAudience
      ),
      emotionalAngles: mergeStringList(
        conflicts,
        "emotionalAngles",
        result.emotionalAngles,
        next.emotionalAngles
      ),
      useCases: mergeStringList(
        conflicts,
        "useCases",
        result.useCases,
        next.useCases
      ),
      images:
        next.images.length > 0
          ? next.images
          : result.images.length > 0
            ? result.images
            : [],
      primaryImage: null,
      conflicts,
      completeness: "none",
      catalogProduct: next.catalogProduct ?? result.catalogProduct,
      sourceMetadata: {
        sourcesUsed: Array.from(
          new Set([
            ...result.sourceMetadata.sourcesUsed,
            ...next.sourceMetadata.sourcesUsed,
          ])
        ),
        notes: [
          ...result.sourceMetadata.notes,
          ...next.sourceMetadata.notes,
        ],
      },
    };
    result.primaryImage = result.images[0] || null;
  }

  // Highest-precedence layer determines primary source tag
  result.source = valid[valid.length - 1].source;
  result.completeness = computeProductCompleteness(result);
  return result;
}
