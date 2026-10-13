/**
 * Resolve a Meta Ads draft creative from a trusted library asset id (PR W2.3C).
 *
 * Authoritative source: `user_generated_image` via `GeneratedImageDAO.getByIdForUser`.
 * Never trusts browser `sourceImageUrl` for ownership or accessibility.
 * Does not call Meta Graph.
 */

import { GeneratedImageDAO } from "@/database/models/GeneratedImage.dao";
import type { GeneratedImage } from "@/database/models/GeneratedImage.dao";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";
import { assessMetaAdsCreativeUrl } from "@/lib/ads/meta/creative-url-safety";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MetaAdsResolvedCreative = {
  sourceImageId: string;
  /** Server-stamped from library row — never from the browser. */
  sourceImageUrl: string;
  storagePath: string | null;
  mediaType: "image";
  metaFetchableViaUrl: boolean;
  metaUrlStrategy: string;
  warnings: string[];
  /** Merge into draft.metadata under `creative`. */
  metadataCreative: Record<string, unknown>;
};

export type ResolveMetaAdsCreativeDeps = {
  getByIdForUser: (
    id: string,
    userId: string
  ) => Promise<GeneratedImage | null>;
};

const defaultDeps: ResolveMetaAdsCreativeDeps = {
  getByIdForUser: (id, userId) => GeneratedImageDAO.getByIdForUser(id, userId),
};

function normalizeUrl(u: string | null | undefined): string {
  return typeof u === "string" ? u.trim() : "";
}

/**
 * Resolve creative fields for draft create/update.
 *
 * - `sourceImageId` null/empty and no client URL → clear creative (incomplete draft OK).
 * - Client URL without id → rejected.
 * - Id required when any creative reference is present.
 */
export async function resolveMetaAdsCreativeAsset(opts: {
  userId: string;
  sourceImageId?: string | null;
  /** Browser hint only — must match canonical URL if provided. */
  sourceImageUrl?: string | null;
  deps?: Partial<ResolveMetaAdsCreativeDeps>;
}): Promise<MetaAdsResolvedCreative | null> {
  const d = { ...defaultDeps, ...opts.deps };
  const userId = String(opts.userId || "").trim();
  if (!userId) {
    throw new MetaAdsDraftValidationError(
      "unauthenticated",
      "Authenticated user is required to resolve creative assets."
    );
  }

  const rawId =
    opts.sourceImageId != null && String(opts.sourceImageId).trim() !== ""
      ? String(opts.sourceImageId).trim()
      : null;
  const clientUrl = normalizeUrl(opts.sourceImageUrl);

  if (!rawId && !clientUrl) {
    return null;
  }

  if (!rawId) {
    throw new MetaAdsDraftValidationError(
      "creative_id_required",
      "Select an image from Generated Contents. Browser-supplied URLs alone are not accepted."
    );
  }

  if (!UUID_RE.test(rawId)) {
    throw new MetaAdsDraftValidationError(
      "invalid_creative_id",
      "Creative asset id is malformed."
    );
  }

  const row = await d.getByIdForUser(rawId, userId);
  if (!row) {
    throw new MetaAdsDraftValidationError(
      "creative_not_found",
      "Creative asset was not found or is not owned by the authenticated user."
    );
  }

  const mediaType = String(row.mediaType || "image").toLowerCase();
  if (mediaType !== "image") {
    throw new MetaAdsDraftValidationError(
      "creative_not_image",
      "Meta Ads drafts require an image asset from Generated Contents."
    );
  }

  const canonicalUrl = normalizeUrl(row.imageUrl);
  if (!canonicalUrl) {
    throw new MetaAdsDraftValidationError(
      "creative_url_unavailable",
      "This library image has no canonical URL. Re-generate or re-register the asset."
    );
  }

  if (clientUrl && clientUrl !== canonicalUrl) {
    throw new MetaAdsDraftValidationError(
      "creative_url_mismatch",
      "Browser-supplied image URL does not match the owned library asset. Reselect the creative."
    );
  }

  const assessment = assessMetaAdsCreativeUrl(canonicalUrl);
  if (assessment.strategy === "reject" && !row.imagePath) {
    throw new MetaAdsDraftValidationError(
      "creative_url_unsafe",
      "Canonical image URL is not usable for Meta Ads. Reselect a library image."
    );
  }

  const storagePath =
    row.imagePath != null && String(row.imagePath).trim()
      ? String(row.imagePath).trim()
      : null;

  return {
    sourceImageId: row.id,
    sourceImageUrl: canonicalUrl,
    storagePath,
    mediaType: "image",
    metaFetchableViaUrl: assessment.metaFetchableViaUrl,
    metaUrlStrategy: assessment.strategy,
    warnings: assessment.warnings,
    metadataCreative: {
      storagePath,
      mediaType: "image",
      metaUrlStrategy: assessment.strategy,
      metaFetchableViaUrl: assessment.metaFetchableViaUrl,
      warnings: assessment.warnings,
    },
  };
}

export function mergeCreativeMetadata(
  existing: Record<string, unknown> | null | undefined,
  creative: MetaAdsResolvedCreative | null
): Record<string, unknown> {
  const base =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...existing }
      : {};
  if (!creative) {
    delete base.creative;
    return base;
  }
  return {
    ...base,
    creative: creative.metadataCreative,
  };
}
