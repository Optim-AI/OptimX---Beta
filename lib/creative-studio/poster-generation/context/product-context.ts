/**
 * Canonical ProductContext — Phase 3.
 * Collects and classifies existing product information only.
 */

import type { Product } from "@/app/web/src/components/creative-studio/types";
import type { PosterImageRef, ProductSourceKind } from "../types";
import type {
  ContextCompleteness,
  FieldConflict,
  ProvenancedValue,
} from "./provenance";

export type ProductContext = {
  source: ProductSourceKind;
  productId?: string | null;
  name: ProvenancedValue<string> | null;
  brandName: ProvenancedValue<string> | null;
  category: ProvenancedValue<string> | null;
  description: ProvenancedValue<string> | null;
  shortDescription: ProvenancedValue<string> | null;
  features: ProvenancedValue<string[]>;
  benefits: ProvenancedValue<string[]>;
  /** Known measurable facts only (e.g. "26g protein") — never invented */
  factualClaims: ProvenancedValue<string[]>;
  /** Soft marketing phrases already present in source data — NOT invented here */
  marketingClaims: ProvenancedValue<string[]>;
  price: ProvenancedValue<string> | null;
  productUrl: ProvenancedValue<string> | null;
  targetAudience: ProvenancedValue<string> | null;
  emotionalAngles: ProvenancedValue<string[]>;
  useCases: ProvenancedValue<string[]>;
  images: PosterImageRef[];
  primaryImage: PosterImageRef | null;
  /** Conflicting values across sources — not auto-resolved */
  conflicts: FieldConflict[];
  completeness: ContextCompleteness;
  /** Raw catalog product when source is catalog — traceability only */
  catalogProduct?: Product | null;
  sourceMetadata: {
    sourcesUsed: ProductSourceKind[];
    notes: string[];
  };
};

export function emptyProductContext(
  source: ProductSourceKind = "manual"
): ProductContext {
  return {
    source,
    productId: null,
    name: null,
    brandName: null,
    category: null,
    description: null,
    shortDescription: null,
    features: { value: [], source: "unknown", confidence: "unknown" },
    benefits: { value: [], source: "unknown", confidence: "unknown" },
    factualClaims: { value: [], source: "unknown", confidence: "unknown" },
    marketingClaims: { value: [], source: "unknown", confidence: "unknown" },
    price: null,
    productUrl: null,
    targetAudience: null,
    emotionalAngles: { value: [], source: "unknown", confidence: "unknown" },
    useCases: { value: [], source: "unknown", confidence: "unknown" },
    images: [],
    primaryImage: null,
    conflicts: [],
    completeness: "none",
    catalogProduct: null,
    sourceMetadata: { sourcesUsed: [], notes: [] },
  };
}

/** Heuristic: treat spec-like strings as factual; soft slogans as marketing */
export function classifyClaimStrings(claims: string[]): {
  factual: string[];
  marketing: string[];
} {
  const factual: string[] = [];
  const marketing: string[] = [];
  for (const raw of claims) {
    const c = String(raw || "").trim();
    if (!c) continue;
    const looksSpec =
      /\d/.test(c) ||
      /\b(g|kg|ml|mg|%|kcal|protein|spf|oz|lb|vegan|sugar-free|gluten-free)\b/i.test(
        c
      );
    const looksMarketing =
      /clinically|guaranteed|#1|number one|\bbest\b|miracle|transform|helps you|start strong|experience the|elevate your|made for you/i.test(
        c
      );
    if (looksMarketing && !looksSpec) {
      marketing.push(c);
    } else if (looksSpec && !looksMarketing) {
      factual.push(c);
    } else if (looksSpec && looksMarketing) {
      // e.g. "26g protein — best in class" → keep as marketing-ish but prefer factual if leading with spec
      if (/^\d/.test(c)) factual.push(c);
      else marketing.push(c);
    } else if (c.length <= 28) {
      factual.push(c); // short label like "No added sugar"
    } else {
      marketing.push(c);
    }
  }
  return { factual, marketing };
}

export function computeProductCompleteness(
  ctx: Pick<
    ProductContext,
    "name" | "images" | "description" | "benefits" | "price" | "category"
  >
): ContextCompleteness {
  const hasName = !!ctx.name?.value?.trim();
  const hasImage = ctx.images.length > 0;
  const hasDesc = !!ctx.description?.value?.trim();
  const hasBenefits = (ctx.benefits.value?.length || 0) > 0;
  const hasPrice = !!ctx.price?.value?.trim();
  const hasCategory = !!ctx.category?.value?.trim();

  if (!hasName && !hasImage) return "none";
  if (hasName && hasImage && (hasDesc || hasBenefits) && (hasPrice || hasCategory)) {
    return "complete";
  }
  if (hasName && hasImage) return "partial";
  if (hasName || hasImage) return "minimal";
  return "none";
}
