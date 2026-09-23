/**
 * resolvePosterContext — Phase 3 top-level boundary.
 * Answers: "What information do we have?" — never creative decisions.
 */

import type { BrandSnapshot, Product } from "@/app/web/src/components/creative-studio/types";
import type {
  PosterDesignReferenceAnalysis,
  PosterBrandContext,
  PosterProductContext,
  PosterReferenceAsset,
} from "../types";
import {
  emptyBrandContext,
  type BrandContext,
} from "./brand-context";
import { PosterContextError } from "./context-errors";
import type { ProductContext } from "./product-context";
import {
  computeReferenceCompleteness,
  emptyReferenceContext,
  toPosterReferenceAsset,
  type NormalizedReference,
  type ReferenceContext,
} from "./reference-context";
import { normalizeBrandSnapshot } from "./normalizers/brand";
import { normalizeCatalogProduct } from "./normalizers/catalog-product";
import {
  normalizeImportedProduct,
  type ScrapedProductSource,
} from "./normalizers/imported-product";
import { mergeProductContexts } from "./normalizers/merge-product";
import {
  normalizeExistingProduct,
  normalizeUploadedProduct,
  type ExistingProductSource,
  type UploadedProductSource,
} from "./normalizers/uploaded-product";
import { imageRefFromUrl } from "./normalizers/helpers";
import type { DataSourceKind } from "./provenance";

export type ResolvePosterContextInput = {
  /** Catalog / content-studio Product */
  catalogProduct?: Product | null;
  catalogProductId?: string | null;
  /** Output of scrape-product API */
  importedProduct?: ScrapedProductSource | null;
  importedProductUrl?: string | null;
  /** Upload / session productData */
  uploadedProduct?: UploadedProductSource | null;
  /** Already-associated studio product */
  existingProduct?: ExistingProductSource | null;
  /** Brand guidelines snapshot */
  brandSnapshot?: BrandSnapshot | null;
  brandId?: string | null;
  brandGuidelinesApplied?: boolean;
  /** Design inspiration poster(s) */
  designReferences?: Array<{
    id?: string;
    url: string;
    storagePath?: string | null;
    analysis?: PosterDesignReferenceAnalysis | null;
    influence?: "subtle" | "balanced" | "strong";
    source?: DataSourceKind;
  }>;
  /** Supporting stills (reference stills rail) */
  supportingReferences?: Array<{
    id?: string;
    url: string;
    storagePath?: string | null;
    source?: DataSourceKind;
  }>;
  /** Extra product packshots beyond those on the product */
  productReferences?: Array<{
    id?: string;
    url: string;
    storagePath?: string | null;
    role?: "product_packshot" | "product_lifestyle" | "brand_logo";
    source?: DataSourceKind;
  }>;
};

export type ResolvedPosterContext = {
  productContext: ProductContext;
  brandContext: BrandContext;
  referenceContext: ReferenceContext;
};

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function resolvePosterContext(
  input: ResolvePosterContextInput
): ResolvedPosterContext {
  if (!input || typeof input !== "object") {
    throw new PosterContextError({
      code: "EMPTY_INPUT",
      message: "resolvePosterContext requires an input object",
      stage: "resolve",
    });
  }

  const uploadLayer = input.uploadedProduct
    ? normalizeUploadedProduct(input.uploadedProduct)
    : null;
  const importLayer = input.importedProduct
    ? normalizeImportedProduct(input.importedProduct, {
        productUrl: input.importedProductUrl,
      })
    : null;
  const catalogLayer = input.catalogProduct
    ? normalizeCatalogProduct(input.catalogProduct, {
        productId: input.catalogProductId,
        brandName: input.brandSnapshot?.name,
      })
    : null;
  const existingLayer = input.existingProduct
    ? normalizeExistingProduct(input.existingProduct)
    : null;

  const productContext = mergeProductContexts(
    uploadLayer,
    importLayer,
    catalogLayer,
    existingLayer
  );

  const brandContext = input.brandSnapshot
    ? normalizeBrandSnapshot(input.brandSnapshot, {
        brandId: input.brandId,
        guidelinesApplied: input.brandGuidelinesApplied ?? true,
      })
    : emptyBrandContext();

  const referenceContext = emptyReferenceContext();

  for (const img of productContext.images) {
    referenceContext.productReferences.push({
      id: newId("pref"),
      role: "product_packshot",
      image: img,
      source: productContext.source as DataSourceKind,
    });
  }

  if (brandContext.identity.logo) {
    referenceContext.productReferences.push({
      id: newId("logo"),
      role: "brand_logo",
      image: brandContext.identity.logo,
      source: "brand_snapshot",
    });
  }

  for (const pref of input.productReferences || []) {
    const img = imageRefFromUrl(pref.url, {
      storagePath: pref.storagePath,
    });
    if (!img) continue;
    referenceContext.productReferences.push({
      id: pref.id || newId("pref"),
      role: pref.role || "product_packshot",
      image: img,
      source: pref.source || "user_session",
    });
  }

  for (const dref of input.designReferences || []) {
    const img = imageRefFromUrl(dref.url, {
      storagePath: dref.storagePath,
    });
    if (!img) continue;
    referenceContext.designReferences.push({
      id: dref.id || newId("dref"),
      role: "design_inspiration",
      image: img,
      source: dref.source || "user_session",
      designAnalysis: dref.analysis ?? null,
      influence: dref.influence || "balanced",
    });
  }

  for (const sref of input.supportingReferences || []) {
    const img = imageRefFromUrl(sref.url, {
      storagePath: sref.storagePath,
    });
    if (!img) continue;
    referenceContext.supportingReferences.push({
      id: sref.id || newId("sref"),
      role: "supporting_still",
      image: img,
      source: sref.source || "user_session",
    });
  }

  referenceContext.completeness =
    computeReferenceCompleteness(referenceContext);

  return { productContext, brandContext, referenceContext };
}

/** Adapt Phase 3 ProductContext → Phase 1 PosterProductContext for CreativeBrief */
export function toPosterProductContext(
  ctx: ProductContext
): PosterProductContext | null {
  if (ctx.completeness === "none" && !ctx.name && ctx.images.length === 0) {
    return null;
  }
  return {
    source: ctx.source,
    name: ctx.name?.value || "Untitled product",
    description: ctx.description?.value ?? null,
    shortBenefit: ctx.shortDescription?.value ?? null,
    category: ctx.category?.value ?? null,
    benefits: ctx.benefits.value || [],
    factualClaims: ctx.factualClaims.value || [],
    features: ctx.features.value || [],
    price: ctx.price?.value ?? null,
    productUrl: ctx.productUrl?.value ?? null,
    brandName: ctx.brandName?.value ?? null,
    targetAudience: ctx.targetAudience?.value ?? null,
    emotionalAngles: ctx.emotionalAngles.value || [],
    useCases: ctx.useCases.value || [],
    images: ctx.images,
    catalogProduct: ctx.catalogProduct ?? null,
  };
}

/** Adapt Phase 3 BrandContext → Phase 1 PosterBrandContext */
export function toPosterBrandContext(ctx: BrandContext): PosterBrandContext {
  return {
    snapshot: ctx.snapshot,
    name: ctx.identity.name?.value ?? null,
    logo: ctx.identity.logo,
    primaryColors: ctx.identity.colors.palette,
    fonts: ctx.identity.fonts?.value ?? null,
    tone: ctx.communication.tone?.value ?? null,
    voice: ctx.communication.voice?.value ?? null,
    industry: ctx.communication.industry?.value ?? null,
    audience: ctx.communication.audience?.value ?? null,
    tagline: ctx.communication.tagline?.value ?? null,
    coreValueProp: ctx.communication.coreValueProp?.value ?? null,
    aestheticTags: ctx.visual.aestheticTags,
    values: ctx.communication.values,
    guidelinesApplied: ctx.guidelinesApplied,
  };
}

export function toPosterReferenceAssets(ctx: ReferenceContext): {
  productReferences: PosterReferenceAsset[];
  designReferences: PosterReferenceAsset[];
  supportingReferences: PosterReferenceAsset[];
} {
  return {
    productReferences: ctx.productReferences.map(toPosterReferenceAsset),
    designReferences: ctx.designReferences.map(toPosterReferenceAsset),
    supportingReferences: ctx.supportingReferences.map(toPosterReferenceAsset),
  };
}

export type { NormalizedReference };
