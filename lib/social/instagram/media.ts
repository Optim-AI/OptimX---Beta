/**
 * Instagram Content Publishing requires publicly reachable HTTPS media URLs.
 * Unlike Facebook Page photos, IG image containers do not accept multipart source.
 */

import {
  assertPublicHostname,
  isLoopbackHostname,
} from "@/lib/social/facebook-publish/resolve-media";

export type InstagramMediaUrlResult =
  | { ok: true; url: string; mediaKind: "image" | "video" }
  | { ok: false; error: string; code: string };

export function classifyMediaKindFromUrl(
  url: string,
  hint?: "image" | "video"
): "image" | "video" {
  if (hint) return hint;
  const lower = url.toLowerCase().split("?")[0];
  if (/\.(mp4|mov|m4v|webm)$/.test(lower)) return "video";
  return "image";
}

/**
 * Instagram Graph `image_url` / `video_url` must be HTTPS and Meta-fetchable.
 */
export async function validateInstagramPublicMediaUrl(
  mediaUrl: string,
  opts?: { mediaTypeHint?: "image" | "video"; lookupFn?: typeof import("dns/promises").lookup }
): Promise<InstagramMediaUrlResult> {
  if (!mediaUrl || typeof mediaUrl !== "string") {
    return { ok: false, error: "Media URL is required", code: "invalid_media" };
  }
  if (mediaUrl.startsWith("data:") || mediaUrl.startsWith("blob:")) {
    return {
      ok: false,
      error:
        "Instagram requires a public HTTPS media URL. Upload the creative to storage first.",
      code: "invalid_media",
    };
  }

  let u: URL;
  try {
    u = new URL(mediaUrl);
  } catch {
    return { ok: false, error: "Invalid media URL", code: "invalid_url" };
  }

  if (u.protocol !== "https:") {
    return {
      ok: false,
      error:
        "Instagram publishing requires a publicly reachable HTTPS media URL. " +
        "Localhost or http URLs cannot be fetched by Meta. Use hosted Supabase/CDN storage or a tunnel.",
      code: "localhost_or_insecure",
    };
  }

  if (isLoopbackHostname(u.hostname)) {
    return {
      ok: false,
      error:
        "Instagram cannot fetch localhost media. Host the creative on a public HTTPS URL.",
      code: "localhost_or_insecure",
    };
  }

  const hostCheck = await assertPublicHostname(u.hostname, opts?.lookupFn);
  if (!hostCheck.ok) {
    return {
      ok: false,
      error:
        "Media host is not publicly reachable by Instagram. Use a public HTTPS CDN or storage URL.",
      code: "ssrf_blocked",
    };
  }

  return {
    ok: true,
    url: mediaUrl,
    mediaKind: classifyMediaKindFromUrl(mediaUrl, opts?.mediaTypeHint),
  };
}

export function validateCaption(
  caption: unknown
): { ok: true; caption: string } | { ok: false; error: string } {
  if (caption == null) return { ok: true, caption: "" };
  if (typeof caption !== "string") {
    return { ok: false, error: "Caption must be a string" };
  }
  // Instagram caption practical limit ~2200
  if (caption.length > 2200) {
    return { ok: false, error: "Caption exceeds 2200 characters" };
  }
  return { ok: true, caption };
}
