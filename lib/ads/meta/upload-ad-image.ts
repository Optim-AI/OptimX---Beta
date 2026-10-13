/**
 * Trusted Meta Ads ad-image upload foundation (PR W2.4).
 *
 * Resolves an owned library asset → downloads storage bytes → validates →
 * multipart POST to `act_{id}/adimages` → returns a validated image hash.
 *
 * Trust boundaries:
 * - Authenticated user id is server-verified (caller responsibility).
 * - Asset id is authoritative; browser URLs / paths are never accepted
 *   as the source of bytes.
 * - User Ads token + selected ad account come from `loadMetaAdsWriteContext`.
 * - Never logs tokens, image bytes, or signed URLs.
 *
 * This module does **not** expose a public API route and must not be invoked
 * against live Meta until an explicitly enabled create workflow calls it.
 *
 * Documentation note (W2.4): Official Meta Marketing API HTML docs returned
 * HTTP 403 from this environment. Request/response shape is based on:
 * - Secondary OpenAPI mirror for `POST /act_{ad_account_id}/adimages`
 *   (multipart; response `images` map).
 * - Community Marketing API examples using multipart file field `filename`
 *   and response `images[<name>].hash`.
 * - Existing SkalX Page Photos upload (`source` field) as a multipart pattern,
 *   not as the Ad Images field name.
 * Label unverified: exact field name (`filename` vs `source`) and whether
 * Meta always keys `images` by the uploaded basename. Staging must confirm
 * before create-paused.
 */

import { createHash } from "crypto";
import {
  detectImageFormatFromBuffer,
  isMetaSupportedImageFormat,
} from "@/lib/media/image-format";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";
import { resolveMetaAdsCreativeAsset } from "@/lib/ads/meta/resolve-creative-asset";
import {
  MetaGraphError,
  ensureActPrefix,
  metaGraphUpload,
  redactMetaSecrets,
} from "@/lib/ads/providers/meta/client";
import {
  MetaAdsWriteAuthError,
  loadMetaAdsWriteContext,
  type LoadMetaAdsWriteContextDeps,
} from "@/lib/ads/providers/meta/load-write-context";
import type { ResolvedMetaAdsWriteContext } from "@/lib/ads/providers/meta/write-context";
import {
  MAX_PUBLISH_IMAGE_BYTES,
  extractPublicStorageObjectPath,
} from "@/lib/social/facebook-publish/resolve-media";

/**
 * Same 10 MiB cap as Facebook Page publish (`MAX_PUBLISH_IMAGE_BYTES`).
 * Meta Ad Images historically share the ~10MB image limit; not re-verified
 * against live Marketing API docs in W2.4 (docs inaccessible).
 */
export const META_ADS_ADIMAGE_MAX_BYTES = MAX_PUBLISH_IMAGE_BYTES;

/** Multipart file field for Ad Images — secondary sources / OpenAPI. */
export const META_ADIMAGES_FILE_FIELD = "filename" as const;

export type MetaAdsAdImageUploadErrorCode =
  | "unauthenticated"
  | "creative_id_required"
  | "invalid_creative_id"
  | "creative_not_found"
  | "creative_not_image"
  | "creative_url_unavailable"
  | "creative_url_mismatch"
  | "creative_url_unsafe"
  | "missing_storage"
  | "storage_not_found"
  | "storage_error"
  | "empty_image"
  | "image_too_large"
  | "invalid_image"
  | "missing_user_access_token"
  | "no_selected_account"
  | "write_context_unavailable"
  | "meta_permission"
  | "meta_rate_limited"
  | "meta_graph_error"
  | "malformed_upload_response"
  | "upload_outcome_uncertain"
  | "network_error";

export class MetaAdsAdImageUploadError extends Error {
  readonly code: MetaAdsAdImageUploadErrorCode;
  /**
   * True when Meta may have accepted the upload but the client cannot prove
   * success (timeout / connection loss). Callers must not auto-retry upload.
   */
  readonly outcomeUncertain: boolean;

  constructor(
    code: MetaAdsAdImageUploadErrorCode,
    message: string,
    opts?: { outcomeUncertain?: boolean }
  ) {
    super(redactMetaSecrets(message));
    this.name = "MetaAdsAdImageUploadError";
    this.code = code;
    this.outcomeUncertain = Boolean(opts?.outcomeUncertain);
  }
}

export type MetaAdsAdImageUploadSuccess = {
  imageHash: string;
  /** Basename sent as the multipart filename. */
  uploadFilename: string;
  sourceImageId: string;
  actId: string;
  accountExternalId: string;
  mimeType: string;
  byteLength: number;
  /**
   * SHA-256 of the uploaded bytes (hex). Safe to log; use for future
   * reconciliation / idempotent filenames — not a Meta id.
   */
  contentSha256: string;
  width?: number;
  height?: number;
};

export type MetaAdImagesUploadResponse = {
  images?: Record<
    string,
    {
      hash?: unknown;
      url?: unknown;
      width?: unknown;
      height?: unknown;
    }
  >;
};

export type UploadMetaAdsAdImageDeps = {
  resolveCreative: typeof resolveMetaAdsCreativeAsset;
  loadWriteContext: (
    userId: string,
    deps?: Partial<LoadMetaAdsWriteContextDeps>
  ) => Promise<ResolvedMetaAdsWriteContext>;
  downloadStorageObject: (
    bucket: string,
    path: string
  ) => Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }>;
  uploadToGraph: typeof metaGraphUpload;
};

const defaultDownloadStorageObject: UploadMetaAdsAdImageDeps["downloadStorageObject"] =
  async (bucket, path) => {
    const { supabaseAdmin } = await import("@/auth/supabase/admin");
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(bucket)
        .download(path);
      if (error || !data) {
        const msg = error?.message || "not_found";
        if (/not found|404|Object not found/i.test(msg)) {
          return { ok: false, error: "not_found" };
        }
        return { ok: false, error: msg };
      }
      const ab = await data.arrayBuffer();
      return { ok: true, buffer: Buffer.from(ab) };
    } catch (e: unknown) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "storage_download_failed";
      return { ok: false, error: msg };
    }
  };

const defaultDeps: UploadMetaAdsAdImageDeps = {
  resolveCreative: resolveMetaAdsCreativeAsset,
  loadWriteContext: (userId, deps) => loadMetaAdsWriteContext(userId, deps),
  downloadStorageObject: defaultDownloadStorageObject,
  uploadToGraph: metaGraphUpload,
};

/**
 * Parse Ad Images upload JSON and require a non-empty hash.
 *
 * Expected shape (secondary sources — not confirmed on developers.facebook.com
 * in this environment):
 * `{ "images": { "<filename>": { "hash": "...", "url": "...", "width": n, "height": n } } }`
 */
export function parseMetaAdImagesUploadResponse(
  json: unknown,
  preferredFilename?: string | null
): {
  imageHash: string;
  uploadFilename: string;
  width?: number;
  height?: number;
} {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new MetaAdsAdImageUploadError(
      "malformed_upload_response",
      "Meta adimages response was not a JSON object."
    );
  }
  const images = (json as MetaAdImagesUploadResponse).images;
  if (!images || typeof images !== "object" || Array.isArray(images)) {
    throw new MetaAdsAdImageUploadError(
      "malformed_upload_response",
      "Meta adimages response missing images map."
    );
  }

  const entries = Object.entries(images);
  if (entries.length === 0) {
    throw new MetaAdsAdImageUploadError(
      "malformed_upload_response",
      "Meta adimages response contained an empty images map."
    );
  }

  let chosen = entries[0]!;
  if (preferredFilename) {
    const match = entries.find(([k]) => k === preferredFilename);
    if (match) chosen = match;
  }

  const [uploadFilename, detail] = chosen;
  const hash =
    detail && typeof detail === "object" && typeof detail.hash === "string"
      ? detail.hash.trim()
      : "";
  if (!hash) {
    throw new MetaAdsAdImageUploadError(
      "malformed_upload_response",
      "Meta adimages response did not include a valid image hash."
    );
  }

  const width =
    detail && typeof detail.width === "number" && Number.isFinite(detail.width)
      ? detail.width
      : undefined;
  const height =
    detail &&
    typeof detail.height === "number" &&
    Number.isFinite(detail.height)
      ? detail.height
      : undefined;

  return { imageHash: hash, uploadFilename, width, height };
}

export function validateMetaAdsAdImageBuffer(buffer: Buffer): {
  mimeType: string;
  extension: string;
  byteLength: number;
  contentSha256: string;
} {
  if (!buffer || buffer.length === 0) {
    throw new MetaAdsAdImageUploadError(
      "empty_image",
      "Image file is empty."
    );
  }
  if (buffer.length > META_ADS_ADIMAGE_MAX_BYTES) {
    throw new MetaAdsAdImageUploadError(
      "image_too_large",
      `Image exceeds Meta Ads ${META_ADS_ADIMAGE_MAX_BYTES} byte limit.`
    );
  }
  const format = detectImageFormatFromBuffer(buffer);
  if (!isMetaSupportedImageFormat(format)) {
    throw new MetaAdsAdImageUploadError(
      "invalid_image",
      "Invalid image data (expected JPEG, PNG, GIF, or WebP)."
    );
  }
  return {
    mimeType: format.mimeType,
    extension: format.extension,
    byteLength: buffer.length,
    contentSha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

function mapWriteAuthError(e: MetaAdsWriteAuthError): MetaAdsAdImageUploadError {
  if (
    e.code === "missing_user_access_token" ||
    e.code === "token_decrypt_failed"
  ) {
    return new MetaAdsAdImageUploadError(
      "missing_user_access_token",
      e.message
    );
  }
  if (
    e.code === "no_selected_account" ||
    e.code === "account_not_selected" ||
    e.code === "account_integration_mismatch" ||
    e.code === "account_provider_mismatch"
  ) {
    return new MetaAdsAdImageUploadError("no_selected_account", e.message);
  }
  if (e.code === "unauthenticated") {
    return new MetaAdsAdImageUploadError("unauthenticated", e.message);
  }
  return new MetaAdsAdImageUploadError("write_context_unavailable", e.message);
}

function mapDraftValidation(
  e: MetaAdsDraftValidationError
): MetaAdsAdImageUploadError {
  const code = e.code as MetaAdsAdImageUploadErrorCode;
  const known: MetaAdsAdImageUploadErrorCode[] = [
    "unauthenticated",
    "creative_id_required",
    "invalid_creative_id",
    "creative_not_found",
    "creative_not_image",
    "creative_url_unavailable",
    "creative_url_mismatch",
    "creative_url_unsafe",
  ];
  if (known.includes(code)) {
    return new MetaAdsAdImageUploadError(code, e.message);
  }
  return new MetaAdsAdImageUploadError("creative_not_found", e.message);
}

/** Meta rate-limit / throttle codes commonly seen on Graph (secondary knowledge). */
const META_RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80004]);

function mapMetaGraphError(e: MetaGraphError): MetaAdsAdImageUploadError {
  if (e.kind === "timeout") {
    return new MetaAdsAdImageUploadError(
      "upload_outcome_uncertain",
      `${e.message} Upload may have succeeded on Meta; do not automatically retry without reconciliation.`,
      { outcomeUncertain: true }
    );
  }
  if (e.kind === "network") {
    return new MetaAdsAdImageUploadError(
      "upload_outcome_uncertain",
      `${e.message} Upload outcome is uncertain; do not automatically retry without reconciliation.`,
      { outcomeUncertain: true }
    );
  }
  if (e.kind === "parse") {
    return new MetaAdsAdImageUploadError(
      "malformed_upload_response",
      e.message
    );
  }
  if (e.code != null && META_RATE_LIMIT_CODES.has(e.code)) {
    return new MetaAdsAdImageUploadError("meta_rate_limited", e.message);
  }
  // OAuth / permission style codes (secondary; staging must confirm).
  if (
    e.code === 190 ||
    e.code === 102 ||
    e.code === 10 ||
    e.code === 200 ||
    e.type === "OAuthException"
  ) {
    return new MetaAdsAdImageUploadError("meta_permission", e.message);
  }
  return new MetaAdsAdImageUploadError("meta_graph_error", e.message);
}

function resolveStorageLocation(opts: {
  storagePath: string | null;
  sourceImageUrl: string;
}): { bucket: string; path: string } {
  const fromUrl = extractPublicStorageObjectPath(opts.sourceImageUrl);
  const path =
    (opts.storagePath && opts.storagePath.trim()) ||
    (fromUrl?.path ?? "");
  if (!path) {
    throw new MetaAdsAdImageUploadError(
      "missing_storage",
      "Owned library image has no storage object path. Re-register the creative in Generated Contents."
    );
  }
  const bucket = (fromUrl?.bucket && fromUrl.bucket.trim()) || "campaign-assets";
  return { bucket, path };
}

/**
 * Upload a user-owned library image to the selected Meta ad account's image library.
 *
 * @param authenticatedUserId - Verified server auth subject (not from body).
 * @param sourceImageId - Owned `user_generated_image.id` (authoritative).
 *
 * Rejects any attempt to supply browser URLs, storage paths, tokens, or account
 * ids as authoritative inputs.
 *
 * Ambiguous timeout / network loss: throws upload_outcome_uncertain.
 * Future create-paused must reconcile (e.g. GET act_{id}/adimages by deterministic
 * filename / content hash metadata) before issuing another POST. This function
 * never auto-retries.
 */
export async function uploadMetaAdsAdImage(opts: {
  authenticatedUserId: string | null | undefined;
  sourceImageId: string;
  /**
   * Rejected if present — documents the trust boundary for callers/tests.
   * Never used as the byte source.
   */
  clientImageUrl?: string | null;
  clientStoragePath?: string | null;
  accessToken?: string | null;
  adAccountId?: string | null;
  deps?: Partial<UploadMetaAdsAdImageDeps>;
}): Promise<MetaAdsAdImageUploadSuccess> {
  if (opts.accessToken != null && String(opts.accessToken).trim() !== "") {
    throw new MetaAdsAdImageUploadError(
      "write_context_unavailable",
      "Client-supplied access tokens are rejected; the server write context is authoritative."
    );
  }
  if (opts.adAccountId != null && String(opts.adAccountId).trim() !== "") {
    throw new MetaAdsAdImageUploadError(
      "no_selected_account",
      "Client-supplied ad account ids are rejected; the selected account from write context is authoritative."
    );
  }
  if (
    opts.clientStoragePath != null &&
    String(opts.clientStoragePath).trim() !== ""
  ) {
    throw new MetaAdsAdImageUploadError(
      "missing_storage",
      "Client-supplied storage paths are rejected; only the owned library row path is used."
    );
  }

  const d: UploadMetaAdsAdImageDeps = { ...defaultDeps, ...opts.deps };
  const userId =
    typeof opts.authenticatedUserId === "string"
      ? opts.authenticatedUserId.trim()
      : "";
  if (!userId) {
    throw new MetaAdsAdImageUploadError(
      "unauthenticated",
      "Meta Ads image upload requires an authenticated user."
    );
  }

  let creative;
  try {
    creative = await d.resolveCreative({
      userId,
      sourceImageId: opts.sourceImageId,
      // Mismatch check only when a hint is passed; never used as byte source.
      sourceImageUrl: opts.clientImageUrl,
    });
  } catch (e) {
    if (e instanceof MetaAdsDraftValidationError) {
      throw mapDraftValidation(e);
    }
    throw e;
  }

  if (!creative) {
    throw new MetaAdsAdImageUploadError(
      "creative_id_required",
      "Select an image from Generated Contents before uploading to Meta Ads."
    );
  }

  const { bucket, path } = resolveStorageLocation({
    storagePath: creative.storagePath,
    sourceImageUrl: creative.sourceImageUrl,
  });

  const downloaded = await d.downloadStorageObject(bucket, path);
  if (!downloaded.ok) {
    if (downloaded.error === "not_found") {
      throw new MetaAdsAdImageUploadError(
        "storage_not_found",
        "Storage object for this creative was not found."
      );
    }
    throw new MetaAdsAdImageUploadError(
      "storage_error",
      "Failed to load image bytes from trusted storage."
    );
  }

  const validated = validateMetaAdsAdImageBuffer(downloaded.buffer);

  let writeCtx: ResolvedMetaAdsWriteContext;
  try {
    writeCtx = await d.loadWriteContext(userId);
  } catch (e) {
    if (e instanceof MetaAdsWriteAuthError) {
      throw mapWriteAuthError(e);
    }
    throw e;
  }

  const actId = ensureActPrefix(writeCtx.actId) || writeCtx.actId;
  // Deterministic basename aids future reconciliation without trusting Meta POST idempotency.
  const uploadFilename = `skalx-${creative.sourceImageId.slice(0, 8)}-${validated.contentSha256.slice(0, 12)}.${validated.extension}`;

  let raw: unknown;
  try {
    raw = await d.uploadToGraph(actId + "/adimages", writeCtx.userAccessToken, {
      file: {
        fieldName: META_ADIMAGES_FILE_FIELD,
        buffer: downloaded.buffer,
        filename: uploadFilename,
        contentType: validated.mimeType,
      },
    });
  } catch (e) {
    if (e instanceof MetaGraphError) {
      throw mapMetaGraphError(e);
    }
    throw e;
  }

  const parsed = parseMetaAdImagesUploadResponse(raw, uploadFilename);

  return {
    imageHash: parsed.imageHash,
    uploadFilename: parsed.uploadFilename,
    sourceImageId: creative.sourceImageId,
    actId,
    accountExternalId: writeCtx.accountExternalId,
    mimeType: validated.mimeType,
    byteLength: validated.byteLength,
    contentSha256: validated.contentSha256,
    width: parsed.width,
    height: parsed.height,
  };
}

/**
 * Evidence needed before a future workflow retries after `upload_outcome_uncertain`:
 *
 * 1. Prefer read-only Graph GET on `act_{id}/adimages` filtered by the deterministic
 *    `uploadFilename` / known hash if already stored on the draft.
 * 2. If an image with matching name (or matching content via Meta URL fetch of
 *    returned `url` — optional) exists, persist that hash and **do not** POST again.
 * 3. Only when reconciliation proves the image is absent is a new multipart POST safe.
 * 4. Never treat timeout as proof of failure; never auto-retry in this foundation.
 */
export const META_ADS_ADIMAGE_UPLOAD_RECONCILE_NOTES = [
  "Ambiguous timeout/network → outcomeUncertain; no automatic retry.",
  "Reconcile via GET act_{id}/adimages before another POST.",
  "Deterministic uploadFilename embeds sourceImageId prefix + content sha256 prefix.",
] as const;
