/**
 * Shared helpers for product image refs and conflict recording.
 */

import type { PosterImageRef } from "../../types";
import type { FieldConflict, DataConfidence, DataSourceKind } from "../provenance";

export function imageRefFromUrl(
  url: string,
  extras?: Partial<PosterImageRef>
): PosterImageRef | null {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;
  return {
    url: trimmed,
    mimeType: extras?.mimeType ?? null,
    storagePath: extras?.storagePath ?? null,
    width: extras?.width ?? null,
    height: extras?.height ?? null,
    contentHash: extras?.contentHash ?? null,
  };
}

export function imageRefsFromUrls(urls: unknown): PosterImageRef[] {
  if (!Array.isArray(urls)) return [];
  const out: PosterImageRef[] = [];
  for (const u of urls) {
    if (typeof u !== "string") continue;
    const ref = imageRefFromUrl(u);
    if (ref) out.push(ref);
  }
  return out;
}

export function recordConflict<T>(
  conflicts: FieldConflict[],
  field: string,
  a: { value: T; source: DataSourceKind; confidence: DataConfidence },
  b: { value: T; source: DataSourceKind; confidence: DataConfidence }
): void {
  if (String(a.value) === String(b.value)) return;
  const existing = conflicts.find((c) => c.field === field);
  if (existing) {
    const hasA = existing.values.some(
      (v) => v.source === a.source && String(v.value) === String(a.value)
    );
    const hasB = existing.values.some(
      (v) => v.source === b.source && String(v.value) === String(b.value)
    );
    if (!hasA) existing.values.push(a);
    if (!hasB) existing.values.push(b);
    return;
  }
  conflicts.push({ field, values: [a, b] });
}

/**
 * Precedence for choosing the displayed value when merging:
 * existing/session > catalog > url_import > upload > manual
 * Conflicts are still recorded; this only picks the primary value.
 */
export const SOURCE_PRECEDENCE: Record<string, number> = {
  existing: 100,
  catalog: 80,
  url_import: 60,
  upload: 40,
  manual: 20,
  brand_snapshot: 70,
  user_session: 90,
  image_analysis: 10,
  unknown: 0,
};

export function preferSource(
  a: DataSourceKind,
  b: DataSourceKind
): DataSourceKind {
  return (SOURCE_PRECEDENCE[a] || 0) >= (SOURCE_PRECEDENCE[b] || 0) ? a : b;
}
