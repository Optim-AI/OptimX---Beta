/**
 * Normalize URL-import / scrape-product output → ProductContext.
 * Category from keyword heuristics is labeled inferred.
 */

import {
  computeProductCompleteness,
  emptyProductContext,
  type ProductContext,
} from "../product-context";
import { provenanced } from "../provenance";
import { imageRefsFromUrls } from "./helpers";

/** Shape returned by /api/creative-studio/scrape-product */
export type ScrapedProductSource = {
  product_name?: string;
  brand_name?: string;
  product_images?: string[];
  product_image_urls?: string[];
  category?: string;
  product_url?: string;
  description?: string;
  price?: string | null;
};

export function normalizeImportedProduct(
  scraped: ScrapedProductSource,
  options?: { productUrl?: string | null }
): ProductContext {
  const ctx = emptyProductContext("url_import");
  ctx.source = "url_import";
  ctx.sourceMetadata.sourcesUsed = ["url_import"];

  const name = String(scraped.product_name || "").trim();
  if (name && name.toLowerCase() !== "product") {
    ctx.name = provenanced(
      name,
      "url_import",
      "extracted",
      "page title / og:title"
    );
  } else if (name) {
    ctx.name = provenanced(
      name,
      "url_import",
      "inferred",
      "generic fallback title"
    );
    ctx.sourceMetadata.notes.push(
      "Product name looks like a generic fallback"
    );
  }

  if (scraped.brand_name?.trim()) {
    ctx.brandName = provenanced(
      scraped.brand_name.trim(),
      "url_import",
      "inferred",
      "derived from domain"
    );
  }

  if (scraped.category?.trim()) {
    const cat = scraped.category.trim();
    ctx.category = provenanced(
      cat,
      "url_import",
      cat === "general" ? "unknown" : "inferred",
      "keyword heuristic from page HTML"
    );
  }

  if (scraped.description?.trim()) {
    ctx.description = provenanced(
      scraped.description.trim(),
      "url_import",
      "extracted"
    );
  }

  if (scraped.price != null && String(scraped.price).trim()) {
    ctx.price = provenanced(
      String(scraped.price).trim(),
      "url_import",
      "extracted"
    );
  }

  const url = options?.productUrl || scraped.product_url;
  if (url?.trim()) {
    ctx.productUrl = provenanced(url.trim(), "url_import", "authoritative");
  }

  const images = [
    ...imageRefsFromUrls(scraped.product_images),
    ...imageRefsFromUrls(scraped.product_image_urls),
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
