/**
 * Provenance + conflict types for Phase 3 context normalization.
 * Factual vs inferred — no creative decisions, no invented claims.
 */

export const DATA_CONFIDENCE_LEVELS = [
  "authoritative",
  "extracted",
  "inferred",
  "unknown",
] as const;
export type DataConfidence = (typeof DATA_CONFIDENCE_LEVELS)[number];

export const DATA_SOURCE_KINDS = [
  "catalog",
  "url_import",
  "upload",
  "existing",
  "manual",
  "brand_snapshot",
  "brand_guidelines",
  "image_analysis",
  "user_session",
  "unknown",
] as const;
export type DataSourceKind = (typeof DATA_SOURCE_KINDS)[number];

/** Reusable provenance wrapper for any important field */
export type ProvenancedValue<T> = {
  value: T;
  source: DataSourceKind;
  confidence: DataConfidence;
  /** Optional human-readable note (e.g. "og:title from product page") */
  note?: string | null;
};

export type FieldConflict<T = unknown> = {
  field: string;
  values: Array<{
    value: T;
    source: DataSourceKind;
    confidence: DataConfidence;
  }>;
};

export const CONTEXT_COMPLETENESS = [
  "complete",
  "partial",
  "minimal",
  "none",
] as const;
export type ContextCompleteness = (typeof CONTEXT_COMPLETENESS)[number];

export function provenanced<T>(
  value: T,
  source: DataSourceKind,
  confidence: DataConfidence,
  note?: string | null
): ProvenancedValue<T> {
  return { value, source, confidence, note: note ?? null };
}
