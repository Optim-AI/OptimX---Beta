/**
 * Resolve a publishable image for Meta Page Photos.
 *
 * - Public HTTPS → Meta `url` parameter (Meta fetches it).
 * - Local / private Supabase Storage → server-side bytes → multipart `source`.
 * - Never forward localhost/private URLs to Meta via `url`.
 * - Prefer owned user_generated_image + storage download over client URLs.
 */

import { lookup } from "dns/promises";
import {
  detectImageFormatFromBuffer,
  isMetaSupportedImageFormat,
} from "@/lib/media/image-format";

export const MAX_PUBLISH_IMAGE_BYTES = 10 * 1024 * 1024; // Meta limit
export const SAFE_FETCH_TIMEOUT_MS = 10_000;
export const SAFE_FETCH_MAX_REDIRECTS = 3;

export type ResolvedPublishImage =
  | {
      mode: "url";
      url: string;
      /** Canonical URL stored on social_posts */
      canonicalUrl: string;
      contentType?: string;
    }
  | {
      mode: "multipart";
      buffer: Buffer;
      contentType: string;
      filename: string;
      canonicalUrl: string;
    };

export type ResolvePublishImageResult =
  | { ok: true; image: ResolvedPublishImage }
  | { ok: false; error: string; code: string };

export type OwnedLibraryImage = {
  id: string;
  userId: string;
  imageUrl: string;
  imagePath: string | null;
  mediaType?: string | null;
};

export type ResolvePublishImageDeps = {
  getImageByIdForUser: (
    id: string,
    userId: string
  ) => Promise<OwnedLibraryImage | null>;
  findImageForUser: (opts: {
    userId: string;
    imagePath?: string | null;
    imageUrl?: string | null;
  }) => Promise<OwnedLibraryImage | null>;
  downloadStorageObject: (
    bucket: string,
    path: string
  ) => Promise<
    | { ok: true; buffer: Buffer }
    | { ok: false; error: string }
  >;
  /** Injectable for tests — defaults to safeFetchImageBytes */
  fetchBytes?: typeof safeFetchImageBytes;
  /** Injectable DNS lookup for SSRF tests */
  lookupFn?: typeof lookup;
};

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "::1" ||
    h === "0.0.0.0" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local")
  );
}

/** IPv4 / IPv6 private, loopback, link-local, and other non-public ranges. */
export function isPrivateOrReservedIp(ip: string): boolean {
  const v = ip.trim().toLowerCase();
  if (!v) return true;

  if (v === "::1" || v === "0:0:0:0:0:0:0:1") return true;
  if (v.startsWith("fe80:") || v.startsWith("fc") || v.startsWith("fd")) {
    return true;
  }
  // IPv4-mapped IPv6
  if (v.startsWith("::ffff:")) {
    return isPrivateOrReservedIp(v.slice("::ffff:".length));
  }

  const parts = v.split(".").map((p) => Number(p));
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  // Unrecognized → treat as unsafe
  if (v.includes(":")) return true;
  return true;
}

export function isSupabasePublicStoragePath(pathname: string): boolean {
  return pathname.includes("/storage/v1/object/public/");
}

/**
 * Extract `campaign-assets/...` object path from a Supabase public URL.
 */
export function extractPublicStorageObjectPath(
  imageUrl: string
): { bucket: string; path: string } | null {
  try {
    const u = new URL(imageUrl);
    const marker = "/storage/v1/object/public/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    const rest = u.pathname.slice(idx + marker.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return null;
    const bucket = decodeURIComponent(rest.slice(0, slash));
    const path = decodeURIComponent(rest.slice(slash + 1));
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export type MetaUrlStrategy = "meta_url" | "multipart_local" | "reject";

/**
 * Decide whether Meta may fetch the URL itself, or we must upload bytes.
 * Does not perform DNS — call assertPublicHostname separately for meta_url.
 */
export function classifyMetaImageUrlStrategy(imageUrl: string): MetaUrlStrategy {
  if (!imageUrl || typeof imageUrl !== "string") return "reject";
  if (imageUrl.startsWith("data:") || imageUrl.startsWith("blob:")) {
    return "reject";
  }

  let u: URL;
  try {
    u = new URL(imageUrl);
  } catch {
    return "reject";
  }

  if (u.protocol !== "http:" && u.protocol !== "https:") return "reject";

  if (isLoopbackHostname(u.hostname)) {
    // Local Supabase (or other local storage) → multipart only
    return isSupabasePublicStoragePath(u.pathname)
      ? "multipart_local"
      : "reject";
  }

  // Meta must fetch publicly — require HTTPS for url mode
  if (u.protocol !== "https:") {
    // Non-local http is not safe to hand to Meta
    return isSupabasePublicStoragePath(u.pathname)
      ? "multipart_local"
      : "reject";
  }

  return "meta_url";
}

export async function assertPublicHostname(
  hostname: string,
  lookupFn: typeof lookup = lookup
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isLoopbackHostname(hostname)) {
    return { ok: false, error: "Hostname is not publicly reachable" };
  }
  try {
    const results = await lookupFn(hostname, { all: true });
    const list = Array.isArray(results) ? results : [results];
    if (list.length === 0) {
      return { ok: false, error: "Hostname could not be resolved" };
    }
    for (const entry of list) {
      const address = typeof entry === "string" ? entry : entry.address;
      if (isPrivateOrReservedIp(address)) {
        return {
          ok: false,
          error: "Hostname resolves to a private or reserved address",
        };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Hostname could not be resolved" };
  }
}

function multipartFromBuffer(
  buffer: Buffer,
  canonicalUrl: string
): ResolvePublishImageResult {
  if (buffer.length === 0) {
    return { ok: false, error: "Image file is empty", code: "invalid_image" };
  }
  if (buffer.length > MAX_PUBLISH_IMAGE_BYTES) {
    return {
      ok: false,
      error: `Image exceeds Meta's ${MAX_PUBLISH_IMAGE_BYTES} byte limit`,
      code: "image_too_large",
    };
  }
  const format = detectImageFormatFromBuffer(buffer);
  if (!isMetaSupportedImageFormat(format)) {
    return {
      ok: false,
      error: "Invalid image data (expected JPEG, PNG, GIF, or WebP)",
      code: "invalid_image",
    };
  }
  return {
    ok: true,
    image: {
      mode: "multipart",
      buffer,
      contentType: format.mimeType,
      filename: `photo.${format.extension}`,
      canonicalUrl,
    },
  };
}

/**
 * SSRF-safe fetch of image bytes. Validates each redirect hop.
 * Allows loopback only when `allowLoopback` is true (owned local storage).
 */
export async function safeFetchImageBytes(
  imageUrl: string,
  opts?: {
    allowLoopback?: boolean;
    timeoutMs?: number;
    maxRedirects?: number;
    maxBytes?: number;
    lookupFn?: typeof lookup;
    fetchFn?: typeof fetch;
  }
): Promise<
  | { ok: true; buffer: Buffer; finalUrl: string; contentType?: string }
  | { ok: false; error: string; code: string }
> {
  const timeoutMs = opts?.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS;
  const maxRedirects = opts?.maxRedirects ?? SAFE_FETCH_MAX_REDIRECTS;
  const maxBytes = opts?.maxBytes ?? MAX_PUBLISH_IMAGE_BYTES;
  const fetchFn = opts?.fetchFn ?? fetch;
  const lookupFn = opts?.lookupFn ?? lookup;

  let current = imageUrl;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let u: URL;
    try {
      u = new URL(current);
    } catch {
      return { ok: false, error: "Invalid image URL", code: "invalid_url" };
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: "Unsupported URL protocol", code: "invalid_url" };
    }

    const loopback = isLoopbackHostname(u.hostname);
    if (loopback && !opts?.allowLoopback) {
      return {
        ok: false,
        error: "Refusing to fetch loopback URL",
        code: "ssrf_blocked",
      };
    }
    if (!loopback) {
      const hostCheck = await assertPublicHostname(u.hostname, lookupFn);
      if (!hostCheck.ok) {
        return { ok: false, error: hostCheck.error, code: "ssrf_blocked" };
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let resp: Response;
    try {
      resp = await fetchFn(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "image/*,*/*" },
      });
    } catch (e: any) {
      clearTimeout(timer);
      if (e?.name === "AbortError") {
        return { ok: false, error: "Image fetch timed out", code: "fetch_timeout" };
      }
      return { ok: false, error: "Could not fetch image", code: "fetch_failed" };
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(resp.status)) {
      const loc = resp.headers.get("location");
      if (!loc) {
        return {
          ok: false,
          error: "Redirect missing Location header",
          code: "fetch_failed",
        };
      }
      current = new URL(loc, current).toString();
      continue;
    }

    if (!resp.ok) {
      return {
        ok: false,
        error: `Image URL returned HTTP ${resp.status}`,
        code: "fetch_failed",
      };
    }

    const contentType = resp.headers.get("content-type") || undefined;
    const lenHeader = resp.headers.get("content-length");
    if (lenHeader && Number(lenHeader) > maxBytes) {
      return {
        ok: false,
        error: "Image exceeds size limit",
        code: "image_too_large",
      };
    }

    const ab = await resp.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      return {
        ok: false,
        error: "Image exceeds size limit",
        code: "image_too_large",
      };
    }

    return {
      ok: true,
      buffer: Buffer.from(ab),
      finalUrl: current,
      contentType,
    };
  }

  return {
    ok: false,
    error: "Too many redirects while fetching image",
    code: "fetch_failed",
  };
}

export async function resolvePublishImageSource(opts: {
  userId: string;
  imageUrl?: string | null;
  sourceImageId?: string | null;
  sourceImagePath?: string | null;
  deps: ResolvePublishImageDeps;
}): Promise<ResolvePublishImageResult> {
  const { userId, deps } = opts;
  const fetchBytes = deps.fetchBytes ?? safeFetchImageBytes;

  let owned: OwnedLibraryImage | null = null;

  if (opts.sourceImageId) {
    owned = await deps.getImageByIdForUser(opts.sourceImageId, userId);
    if (!owned) {
      return {
        ok: false,
        error: "Image not found or you do not own this creative",
        code: "not_owned",
      };
    }
  } else {
    owned = await deps.findImageForUser({
      userId,
      imagePath: opts.sourceImagePath,
      imageUrl: opts.imageUrl,
    });
  }

  if (owned?.mediaType === "video") {
    return {
      ok: false,
      error: "Video publishing is not supported on this endpoint",
      code: "unsupported_media",
    };
  }

  const canonicalUrl = owned?.imageUrl || opts.imageUrl || "";
  if (!canonicalUrl && !owned?.imagePath) {
    return {
      ok: false,
      error: "Image URL is required",
      code: "invalid_media",
    };
  }

  // Prefer owned storage object (no client URL trust).
  const storagePath =
    owned?.imagePath ||
    opts.sourceImagePath ||
    (canonicalUrl ? extractPublicStorageObjectPath(canonicalUrl)?.path : null);
  const storageBucket =
    (canonicalUrl
      ? extractPublicStorageObjectPath(canonicalUrl)?.bucket
      : null) || "campaign-assets";

  if (owned && storagePath) {
    const downloaded = await deps.downloadStorageObject(
      storageBucket,
      storagePath
    );
    if (!downloaded.ok) {
      // Fall through to URL strategies when storage miss
      if (downloaded.error === "not_found") {
        // continue
      } else {
        return {
          ok: false,
          error: downloaded.error || "Failed to load image from storage",
          code: "storage_error",
        };
      }
    } else {
      return multipartFromBuffer(downloaded.buffer, owned.imageUrl || canonicalUrl);
    }
  }

  if (!canonicalUrl) {
    return {
      ok: false,
      error: "Missing storage object for this creative",
      code: "missing_storage",
    };
  }

  if (canonicalUrl.startsWith("data:")) {
    return {
      ok: false,
      error: "Data URLs cannot be published. Upload the image to storage first.",
      code: "invalid_media",
    };
  }

  const strategy = classifyMetaImageUrlStrategy(canonicalUrl);

  if (strategy === "reject") {
    return {
      ok: false,
      error:
        "Image URL cannot be used for Facebook publishing. Use a Generated Contents creative or a public HTTPS image URL.",
      code: "invalid_media",
    };
  }

  if (strategy === "multipart_local") {
    if (!owned) {
      return {
        ok: false,
        error:
          "Local storage images must belong to your Generated Contents library before publishing.",
        code: "not_owned",
      };
    }

    // Retry storage via path parsed from URL
    const parsed = extractPublicStorageObjectPath(canonicalUrl);
    if (parsed) {
      const downloaded = await deps.downloadStorageObject(
        parsed.bucket,
        parsed.path
      );
      if (downloaded.ok) {
        return multipartFromBuffer(downloaded.buffer, owned.imageUrl);
      }
      if (downloaded.error !== "not_found") {
        return {
          ok: false,
          error: downloaded.error || "Failed to load image from storage",
          code: "storage_error",
        };
      }
    }

    const fetched = await fetchBytes(canonicalUrl, { allowLoopback: true });
    if (!fetched.ok) {
      return {
        ok: false,
        error: fetched.error,
        code: fetched.code,
      };
    }
    return multipartFromBuffer(fetched.buffer, owned.imageUrl);
  }

  // meta_url — public HTTPS only; DNS must not resolve privately
  let u: URL;
  try {
    u = new URL(canonicalUrl);
  } catch {
    return { ok: false, error: "Invalid image URL", code: "invalid_url" };
  }

  const hostCheck = await assertPublicHostname(u.hostname, deps.lookupFn);
  if (!hostCheck.ok) {
    return {
      ok: false,
      error:
        "Image host is not publicly reachable by Facebook. Use multipart-capable storage or a public HTTPS CDN URL.",
      code: "ssrf_blocked",
    };
  }

  // Optional: if we own a storage path on a public host, still prefer multipart
  // for correctness (MIME) — but URL mode is fine for production Supabase.
  return {
    ok: true,
    image: {
      mode: "url",
      url: canonicalUrl,
      canonicalUrl,
    },
  };
}

/** Default deps wired to GeneratedImageDAO + supabaseAdmin (lazy). */
export async function createDefaultResolveDeps(): Promise<ResolvePublishImageDeps> {
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
