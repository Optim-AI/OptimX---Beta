/**
 * Normalize upload-only / session productData → ProductContext.
 * Never invents name, price, benefits, or claims.
 */

import {
  computeProductCompleteness,
  emptyProductContext,
  type ProductContext,
} from "../product-context";
import { provenanced } from "../provenance";
import { imageRefFromUrl, imageRefsFromUrls } from "./helpers";

export type UploadedProductSource = {
  /** Optional user-supplied label — not invented by the system */
  productName?: string | null;
  prompt?: string | null;
  imageDataUrls?: string[];
  imageUrls?: string[];
  brandName?: string | null;
};

export function normalizeUploadedProduct(
  uploaded: UploadedProductSource
): ProductContext {
  const ctx = emptyProductContext("upload");
  ctx.source = "upload";
  ctx.sourceMetadata.sourcesUsed = ["upload"];

  const name = String(uploaded.productName || "").trim();
  if (name) {
    ctx.name = provenanced(name, "upload", "authoritative", "user-supplied name");
  }
  // prompt is user intent / label — do NOT treat as product description fact
  if (!name && uploaded.prompt?.trim()) {
    ctx.sourceMetadata.notes.push(
      "Upload has a prompt label but no confirmed product name — left name empty"
    );
  }

  if (uploaded.brandName?.trim()) {
    ctx.brandName = provenanced(
      uploaded.brandName.trim(),
      "upload",
      "authoritative"
    );
  }

  const images = [
    ...imageRefsFromUrls(uploaded.imageDataUrls),
    ...imageRefsFromUrls(uploaded.imageUrls),
  ];
  const seen = new Set<string>();
  ctx.images = images.filter((img) => {
    if (seen.has(img.url)) return false;
    seen.add(img.url);
    return true;
  });
  ctx.primaryImage = ctx.images[0] || null;

  ctx.completeness = computeProductCompleteness(ctx);
  return ctx;
}

/**
 * Existing session / studio product association.
 * Highest precedence when merging.
 */
export type ExistingProductSource = {
  productId?: string | null;
  productName?: string | null;
  description?: string | null;
  shortBenefit?: string | null;
  benefits?: string[];
  price?: string | null;
  category?: string | null;
  brandName?: string | null;
  productUrl?: string | null;
  images?: string[];
  targetAudience?: string | null;
};

export function normalizeExistingProduct(
  existing: ExistingProductSource
): ProductContext {
  const ctx = emptyProductContext("existing");
  ctx.source = "existing";
  ctx.productId = existing.productId ?? null;
  ctx.sourceMetadata.sourcesUsed = ["existing"];

  if (existing.productName?.trim()) {
    ctx.name = provenanced(
      existing.productName.trim(),
      "existing",
      "authoritative"
    );
  }
  if (existing.brandName?.trim()) {
    ctx.brandName = provenanced(
      existing.brandName.trim(),
      "existing",
      "authoritative"
    );
  }
  if (existing.description?.trim()) {
    ctx.description = provenanced(
      existing.description.trim(),
      "existing",
      "authoritative"
    );
  }
  if (existing.shortBenefit?.trim()) {
    ctx.shortDescription = provenanced(
      existing.shortBenefit.trim(),
      "existing",
      "authoritative"
    );
  }
  if (existing.category?.trim()) {
    ctx.category = provenanced(
      existing.category.trim(),
      "existing",
      "authoritative"
    );
  }
  if (existing.price != null && String(existing.price).trim()) {
    ctx.price = provenanced(
      String(existing.price).trim(),
      "existing",
      "authoritative"
    );
  }
  if (existing.productUrl?.trim()) {
    ctx.productUrl = provenanced(
      existing.productUrl.trim(),
      "existing",
      "authoritative"
    );
  }
  if (existing.targetAudience?.trim()) {
    ctx.targetAudience = provenanced(
      existing.targetAudience.trim(),
      "existing",
      "authoritative"
    );
  }
  if (Array.isArray(existing.benefits) && existing.benefits.length) {
    ctx.benefits = provenanced(
      existing.benefits.map(String).filter(Boolean),
      "existing",
      "authoritative"
    );
  }

  ctx.images = imageRefsFromUrls(existing.images);
  ctx.primaryImage = ctx.images[0] || null;
  ctx.completeness = computeProductCompleteness(ctx);
  return ctx;
}

export function normalizeSingleUploadImage(
  imageUrl: string
): ProductContext {
  const ctx = emptyProductContext("upload");
  ctx.source = "upload";
  ctx.sourceMetadata.sourcesUsed = ["upload"];
  const ref = imageRefFromUrl(imageUrl);
  if (ref) {
    ctx.images = [ref];
    ctx.primaryImage = ref;
  }
  ctx.completeness = computeProductCompleteness(ctx);
  return ctx;
}
