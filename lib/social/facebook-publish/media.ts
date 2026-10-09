/**
 * Media helpers for Facebook Page photo publish.
 * URL reachability for Meta is handled by resolve-media (url vs multipart).
 */

import {
  classifyMetaImageUrlStrategy,
  isLoopbackHostname,
} from "@/lib/social/facebook-publish/resolve-media";

export type MediaValidationResult =
  | { ok: true; url: string; contentType?: string }
  | { ok: false; error: string };

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function isLikelyPublicFetchableUrl(url: string): boolean {
  if (!isHttpUrl(url)) return false;
  if (url.startsWith("data:")) return false;
  if (url.includes("blob:")) return false;
  return true;
}

/**
 * Lightweight check for draft persistence / UI.
 * Does NOT approve localhost for Meta `url` publishing — resolvePublishImageSource handles that.
 */
export async function validatePublishableImageUrl(
  imageUrl: string
): Promise<MediaValidationResult> {
  if (!imageUrl || typeof imageUrl !== "string") {
    return { ok: false, error: "Image URL is required" };
  }
  if (imageUrl.startsWith("data:")) {
    return {
      ok: false,
      error: "Data URLs cannot be published. Upload the image to storage first.",
    };
  }
  if (!isLikelyPublicFetchableUrl(imageUrl)) {
    return { ok: false, error: "Image must be a public http(s) URL" };
  }

  const strategy = classifyMetaImageUrlStrategy(imageUrl);
  if (strategy === "reject") {
    return {
      ok: false,
      error:
        "Image URL cannot be used for Facebook publishing. Use a Generated Contents creative or a public HTTPS image URL.",
    };
  }

  // Localhost is OK for drafts / multipart resolution — not for Meta url=.
  if (strategy === "multipart_local") {
    return { ok: true, url: imageUrl };
  }

  try {
    const host = new URL(imageUrl).hostname;
    if (isLoopbackHostname(host)) {
      return {
        ok: false,
        error:
          "Image URL must be publicly reachable by Facebook, or stored in your Generated Contents library for server-side upload.",
      };
    }
  } catch {
    return { ok: false, error: "Invalid image URL" };
  }

  return { ok: true, url: imageUrl };
}

export function validateCaption(
  caption: unknown
): { ok: true; caption: string } | { ok: false; error: string } {
  if (caption == null) return { ok: true, caption: "" };
  if (typeof caption !== "string") {
    return { ok: false, error: "Caption must be a string" };
  }
  if (caption.length > 2200) {
    return { ok: false, error: "Caption exceeds 2200 characters" };
  }
  return { ok: true, caption };
}
