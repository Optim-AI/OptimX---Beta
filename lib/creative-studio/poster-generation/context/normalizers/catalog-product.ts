/**
 * Normalize catalog Product → ProductContext.
 */

import type { Product } from "@/app/web/src/components/creative-studio/types";
import {
  classifyClaimStrings,
  computeProductCompleteness,
  emptyProductContext,
  type ProductContext,
} from "../product-context";
import { provenanced } from "../provenance";
import { imageRefsFromUrls } from "./helpers";

export function normalizeCatalogProduct(
  product: Product,
  options?: { productId?: string | null; brandName?: string | null }
): ProductContext {
  const ctx = emptyProductContext("catalog");
  ctx.source = "catalog";
  ctx.productId = options?.productId ?? null;
  ctx.catalogProduct = product;
  ctx.sourceMetadata.sourcesUsed = ["catalog"];

  const name = String(product.product_name || "").trim();
  if (name) {
    ctx.name = provenanced(name, "catalog", "authoritative");
  }

  if (options?.brandName?.trim()) {
    ctx.brandName = provenanced(
      options.brandName.trim(),
      "catalog",
      "authoritative"
    );
  }

  if (product.category?.trim()) {
    ctx.category = provenanced(
      product.category.trim(),
      "catalog",
      "authoritative"
    );
  }

  if (product.description?.trim()) {
    ctx.description = provenanced(
      product.description.trim(),
      "catalog",
      "authoritative"
    );
  }

  if (product.short_benefit?.trim()) {
    ctx.shortDescription = provenanced(
      product.short_benefit.trim(),
      "catalog",
      "authoritative"
    );
  }

  const benefits = Array.isArray(product.key_benefits)
    ? product.key_benefits.map(String).filter((s) => s.trim())
    : [];
  const classified = classifyClaimStrings(benefits);
  ctx.benefits = provenanced(benefits, "catalog", "authoritative");
  ctx.factualClaims = provenanced(
    classified.factual,
    "catalog",
    "authoritative"
  );
  ctx.marketingClaims = provenanced(
    classified.marketing,
    "catalog",
    "extracted"
  );

  if (product.price != null && String(product.price).trim()) {
    ctx.price = provenanced(String(product.price).trim(), "catalog", "authoritative");
  }

  if (product.target_audience?.trim()) {
    ctx.targetAudience = provenanced(
      product.target_audience.trim(),
      "catalog",
      "authoritative"
    );
  }

  ctx.emotionalAngles = provenanced(
    Array.isArray(product.emotional_angles)
      ? product.emotional_angles.map(String).filter(Boolean)
      : [],
    "catalog",
    "authoritative"
  );
  ctx.useCases = provenanced(
    Array.isArray(product.use_cases)
      ? product.use_cases.map(String).filter(Boolean)
      : [],
    "catalog",
    "authoritative"
  );

  ctx.images = imageRefsFromUrls(product.product_images);
  ctx.primaryImage = ctx.images[0] || null;
  ctx.completeness = computeProductCompleteness(ctx);
  return ctx;
}
