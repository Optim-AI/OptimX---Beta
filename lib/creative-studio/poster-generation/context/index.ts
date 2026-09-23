/**
 * Phase 3 — Product / Brand / Reference context normalization.
 */

export type {
  DataConfidence,
  DataSourceKind,
  ProvenancedValue,
  FieldConflict,
  ContextCompleteness,
} from "./provenance";
export {
  DATA_CONFIDENCE_LEVELS,
  DATA_SOURCE_KINDS,
  CONTEXT_COMPLETENESS,
  provenanced,
} from "./provenance";

export type { ProductContext } from "./product-context";
export {
  emptyProductContext,
  classifyClaimStrings,
  computeProductCompleteness,
} from "./product-context";

export type {
  BrandContext,
  BrandIdentity,
  BrandCommunication,
  BrandVisual,
  BrandColorSet,
} from "./brand-context";
export { emptyBrandContext, computeBrandCompleteness } from "./brand-context";

export type { ReferenceContext, NormalizedReference } from "./reference-context";
export {
  emptyReferenceContext,
  computeReferenceCompleteness,
  toPosterReferenceAsset,
} from "./reference-context";

export { PosterContextError, isPosterContextError } from "./context-errors";
export type { PosterContextErrorCode } from "./context-errors";

export { normalizeCatalogProduct } from "./normalizers/catalog-product";
export {
  normalizeImportedProduct,
  type ScrapedProductSource,
} from "./normalizers/imported-product";
export {
  normalizeUploadedProduct,
  normalizeExistingProduct,
  normalizeSingleUploadImage,
  type UploadedProductSource,
  type ExistingProductSource,
} from "./normalizers/uploaded-product";
export { normalizeBrandSnapshot } from "./normalizers/brand";
export { mergeProductContexts } from "./normalizers/merge-product";

export {
  resolvePosterContext,
  toPosterProductContext,
  toPosterBrandContext,
  toPosterReferenceAssets,
  type ResolvePosterContextInput,
  type ResolvedPosterContext,
} from "./resolve";
