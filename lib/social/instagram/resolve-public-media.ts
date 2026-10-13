/**
 * Resolve a user-owned Generated Contents creative to a Meta-fetchable
 * public HTTPS URL for Instagram Content Publishing.
 *
 * - Reuses an existing public HTTPS library URL when safe.
 * - Otherwise mirrors bytes to configured hosted Supabase public storage.
 * - Never pretends localhost is publishable.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  detectImageFormatFromBuffer,
  isMetaSupportedImageFormat,
} from "@/lib/media/image-format";
import {
  extractPublicStorageObjectPath,
} from "@/lib/social/facebook-publish/resolve-media";
import {
  classifyMediaKindFromUrl,
  validateInstagramPublicMediaUrl,
} from "@/lib/social/instagram/media";
import {
  INSTAGRAM_MAX_IMAGE_BYTES,
  INSTAGRAM_MAX_VIDEO_BYTES,
  buildInstagramMirrorObjectPath,
  buildPublicStorageObjectUrl,
  getInstagramMediaHostConfig,
  type InstagramMediaHostConfig,
} from "@/lib/social/instagram/public-media-config";

export type OwnedCreative = {
  id: string;
  userId: string;
  imageUrl: string;
  imagePath: string | null;
  mediaType?: string | null;
};

export type ResolveInstagramPublicMediaResult =
  | {
      ok: true;
      url: string;
      mediaKind: "image" | "video";
      reusedExisting: boolean;
      mirrored: boolean;
      canonicalLibraryUrl: string;
      sourceImageId: string;
      sourceImagePath: string | null;
    }
  | { ok: false; error: string; code: string };

export type ResolveInstagramPublicMediaDeps = {
  getImageByIdForUser: (
    id: string,
    userId: string
  ) => Promise<OwnedCreative | null>;
  findImageForUser: (opts: {
    userId: string;
    imagePath?: string | null;
    imageUrl?: string | null;
  }) => Promise<OwnedCreative | null>;
  downloadStorageObject: (
    bucket: string,
    path: string
  ) => Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }>;
  /** Download bytes from a loopback Supabase public URL (server-local only). */
  fetchLocalBytes?: (
    url: string
  ) => Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }>;
  getMediaHostConfig?: () => InstagramMediaHostConfig;
  validatePublicUrl?: typeof validateInstagramPublicMediaUrl;
  /** Injectable hosted storage client factory */
  createHostClient?: (url: string, key: string) => SupabaseClient;
  /** HEAD/GET check that a public URL already serves the object */
  probePublicUrl?: (
    url: string
  ) => Promise<{ ok: true } | { ok: false }>;
  uploadMirror?: (opts: {
    client: SupabaseClient;
    bucket: string;
    objectPath: string;
    buffer: Buffer;
    contentType: string;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
};

function isLikelyMp4(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  return buffer.toString("ascii", 4, 8) === "ftyp";
}

function detectPublishableMedia(
  buffer: Buffer,
  hint?: "image" | "video"
):
  | {
      ok: true;
      mediaKind: "image" | "video";
      contentType: string;
      extension: string;
    }
  | { ok: false; error: string; code: string } {
  if (hint === "video" || (!hint && isLikelyMp4(buffer))) {
    if (!isLikelyMp4(buffer)) {
      return {
        ok: false,
        error: "Instagram video publishing requires an MP4 file.",
        code: "invalid_format",
      };
    }
    if (buffer.length > INSTAGRAM_MAX_VIDEO_BYTES) {
      return {
        ok: false,
        error: `Video exceeds Instagram publish limit of ${INSTAGRAM_MAX_VIDEO_BYTES / (1024 * 1024)} MB.`,
        code: "file_too_large",
      };
    }
    return {
      ok: true,
      mediaKind: "video",
      contentType: "video/mp4",
      extension: "mp4",
    };
  }

  const format = detectImageFormatFromBuffer(buffer);
  if (!isMetaSupportedImageFormat(format)) {
    return {
      ok: false,
      error:
        "Instagram image publishing requires JPEG or PNG. Re-export the creative and try again.",
      code: "invalid_format",
    };
  }
  // Prefer JPEG/PNG; reject gif/webp for IG feed reliability
  if (
    format.mimeType !== "image/jpeg" &&
    format.mimeType !== "image/png"
  ) {
    return {
      ok: false,
      error:
        "Instagram feed publishing supports JPEG or PNG only (not GIF/WebP).",
      code: "invalid_format",
    };
  }
  if (buffer.length > INSTAGRAM_MAX_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Image exceeds Instagram publish limit of ${INSTAGRAM_MAX_IMAGE_BYTES / (1024 * 1024)} MB.`,
      code: "file_too_large",
    };
  }
  return {
    ok: true,
    mediaKind: "image",
    contentType: format.mimeType,
    extension: format.extension,
  };
}

async function defaultProbePublicUrl(
  url: string
): Promise<{ ok: true } | { ok: false }> {
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (head.ok) return { ok: true };
    const get = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
    });
    if (get.ok || get.status === 206) return { ok: true };
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

async function defaultUploadMirror(opts: {
  client: SupabaseClient;
  bucket: string;
  objectPath: string;
  buffer: Buffer;
  contentType: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await opts.client.storage
    .from(opts.bucket)
    .upload(opts.objectPath, opts.buffer, {
      contentType: opts.contentType,
      cacheControl: "3600",
      upsert: true,
    });
  if (error) {
    return { ok: false, error: error.message || "storage_upload_failed" };
  }
  return { ok: true };
}

async function defaultFetchLocalBytes(
  url: string
): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return { ok: false, error: `Failed to load local media (${resp.status})` };
    }
    const ab = await resp.arrayBuffer();
    return { ok: true, buffer: Buffer.from(ab) };
  } catch (e: any) {
    return { ok: false, error: e?.message || "local_fetch_failed" };
  }
}

export async function resolveInstagramPublishableMedia(opts: {
  userId: string;
  sourceImageId?: string | null;
  sourceImagePath?: string | null;
  /** Client hint only — never trusted without ownership */
  mediaUrl?: string | null;
  mediaTypeHint?: "image" | "video";
  deps: ResolveInstagramPublicMediaDeps;
}): Promise<ResolveInstagramPublicMediaResult> {
  const deps = opts.deps;
  const validateUrl = deps.validatePublicUrl ?? validateInstagramPublicMediaUrl;
  const getHost = deps.getMediaHostConfig ?? getInstagramMediaHostConfig;
  const probe = deps.probePublicUrl ?? defaultProbePublicUrl;
  const uploadMirror = deps.uploadMirror ?? defaultUploadMirror;
  const createHost =
    deps.createHostClient ??
    ((url: string, key: string) =>
      createClient(url, key, { auth: { persistSession: false } }));
  const fetchLocal = deps.fetchLocalBytes ?? defaultFetchLocalBytes;

  let owned: OwnedCreative | null = null;
  if (opts.sourceImageId) {
    owned = await deps.getImageByIdForUser(String(opts.sourceImageId), opts.userId);
    if (!owned) {
      return {
        ok: false,
        error: "Image not found or you do not own this creative",
        code: "not_owned",
      };
    }
  } else {
    owned = await deps.findImageForUser({
      userId: opts.userId,
      imagePath: opts.sourceImagePath || null,
      imageUrl: opts.mediaUrl || null,
    });
  }

  if (!owned) {
    return {
      ok: false,
      error:
        "Only Generated Contents library creatives can be published to Instagram. Open the creative from your library and try again.",
      code: "not_owned",
    };
  }

  const canonicalLibraryUrl = owned.imageUrl || opts.mediaUrl || "";
  const hint: "image" | "video" | undefined =
    opts.mediaTypeHint ||
    (owned.mediaType === "video"
      ? "video"
      : owned.mediaType === "image"
        ? "image"
        : classifyMediaKindFromUrl(canonicalLibraryUrl));

  // Fast path: library URL already Meta-fetchable
  if (canonicalLibraryUrl) {
    const existing = await validateUrl(canonicalLibraryUrl, {
      mediaTypeHint: hint,
    });
    if (existing.ok) {
      return {
        ok: true,
        url: existing.url,
        mediaKind: existing.mediaKind,
        reusedExisting: true,
        mirrored: false,
        canonicalLibraryUrl,
        sourceImageId: owned.id,
        sourceImagePath: owned.imagePath,
      };
    }
  }

  // Need bytes → mirror to public host
  const host = getHost();
  if (!host.ok) {
    return { ok: false, error: host.error, code: host.code };
  }

  let buffer: Buffer | null = null;
  const storagePath =
    owned.imagePath ||
    opts.sourceImagePath ||
    (canonicalLibraryUrl
      ? extractPublicStorageObjectPath(canonicalLibraryUrl)?.path
      : null);
  const storageBucket =
    (canonicalLibraryUrl
      ? extractPublicStorageObjectPath(canonicalLibraryUrl)?.bucket
      : null) || host.bucket;

  if (storagePath) {
    const downloaded = await deps.downloadStorageObject(
      storageBucket,
      storagePath
    );
    if (downloaded.ok) {
      buffer = downloaded.buffer;
    } else if (downloaded.error !== "not_found") {
      return {
        ok: false,
        error: downloaded.error || "Failed to load creative from storage",
        code: "storage_error",
      };
    }
  }

  if (!buffer && canonicalLibraryUrl) {
    // Server can fetch loopback Supabase; Meta cannot.
    try {
      const u = new URL(canonicalLibraryUrl);
      const isLocal =
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        u.hostname === "::1";
      if (isLocal || u.protocol === "http:") {
        const local = await fetchLocal(canonicalLibraryUrl);
        if (!local.ok) {
          return {
            ok: false,
            error: local.error,
            code: "storage_error",
          };
        }
        buffer = local.buffer;
      }
    } catch {
      // ignore
    }
  }

  if (!buffer) {
    return {
      ok: false,
      error:
        "Could not load the creative bytes for Instagram hosting. Re-generate or re-save the asset to storage.",
      code: "missing_bytes",
    };
  }

  const detected = detectPublishableMedia(buffer, hint);
  if (!detected.ok) {
    return { ok: false, error: detected.error, code: detected.code };
  }

  const objectPath = buildInstagramMirrorObjectPath({
    userId: opts.userId,
    creativeId: owned.id,
    extension: detected.extension,
  });
  const publicUrl = buildPublicStorageObjectUrl(
    host.supabaseUrl,
    host.bucket,
    objectPath
  );

  // Reuse mirror if already present (deterministic path)
  const already = await probe(publicUrl);
  if (already.ok) {
    const checked = await validateUrl(publicUrl, {
      mediaTypeHint: detected.mediaKind,
    });
    if (checked.ok) {
      return {
        ok: true,
        url: checked.url,
        mediaKind: checked.mediaKind,
        reusedExisting: true,
        mirrored: true,
        canonicalLibraryUrl,
        sourceImageId: owned.id,
        sourceImagePath: owned.imagePath,
      };
    }
  }

  const client = createHost(host.supabaseUrl, host.serviceRoleKey);
  const uploaded = await uploadMirror({
    client,
    bucket: host.bucket,
    objectPath,
    buffer,
    contentType: detected.contentType,
  });
  if (!uploaded.ok) {
    return {
      ok: false,
      error: `Failed to mirror media to public Instagram storage: ${uploaded.error}`,
      code: "mirror_upload_failed",
    };
  }

  const finalCheck = await validateUrl(publicUrl, {
    mediaTypeHint: detected.mediaKind,
  });
  if (!finalCheck.ok) {
    return {
      ok: false,
      error:
        finalCheck.error ||
        "Mirrored media URL is still not Meta-reachable. Check INSTAGRAM_MEDIA_HOST_SUPABASE_URL and public bucket access.",
      code: finalCheck.code || "mirror_not_public",
    };
  }

  return {
    ok: true,
    url: finalCheck.url,
    mediaKind: finalCheck.mediaKind,
    reusedExisting: false,
    mirrored: true,
    canonicalLibraryUrl,
    sourceImageId: owned.id,
    sourceImagePath: owned.imagePath,
  };
}

/** Default deps wired to GeneratedImageDAO + primary supabaseAdmin. */
export async function createDefaultInstagramMediaResolveDeps(): Promise<ResolveInstagramPublicMediaDeps> {
  const { GeneratedImageDAO } = await import(
    "@/database/models/GeneratedImage.dao"
  );
  const { supabaseAdmin } = await import("@/auth/supabase/admin");

  return {
    getImageByIdForUser: async (id, userId) => {
      const row = await GeneratedImageDAO.getByIdForUser(id, userId);
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        imageUrl: row.imageUrl,
        imagePath: row.imagePath,
        mediaType: row.mediaType,
      };
    },
    findImageForUser: async ({ userId, imagePath, imageUrl }) => {
      if (imagePath || imageUrl) {
        const row = await GeneratedImageDAO.findExisting({
          userId,
          imagePath: imagePath || null,
          imageUrl: imageUrl || "",
        });
        if (row) {
          return {
            id: row.id,
            userId: row.userId,
            imageUrl: row.imageUrl,
            imagePath: row.imagePath,
            mediaType: row.mediaType,
          };
        }
      }
      return null;
    },
    downloadStorageObject: async (bucket, path) => {
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
      } catch (e: any) {
        return { ok: false, error: e?.message || "storage_download_failed" };
      }
    },
  };
}
