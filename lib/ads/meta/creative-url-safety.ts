/**
 * Sync URL safety checks for Meta Ads creative URLs (PR W2.3C).
 * Reuses Facebook publish SSRF helpers — no DNS, no network fetch.
 */

import {
  classifyMetaImageUrlStrategy,
  isLoopbackHostname,
  isPrivateOrReservedIp,
  type MetaUrlStrategy,
} from "@/lib/social/facebook-publish/resolve-media";

export type MetaAdsCreativeUrlAssessment = {
  /** Canonical URL from storage (already owned-row stamped). */
  url: string;
  strategy: MetaUrlStrategy;
  /** True only when Meta can safely GET this URL over HTTPS (public host). */
  metaFetchableViaUrl: boolean;
  /** Soft warnings for create-paused later (draft save may still succeed). */
  warnings: string[];
};

function hostnameLooksLikeIp(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "");
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
  if (h.includes(":")) return true;
  return false;
}

function looksLikeExpiringSignedUrl(u: URL): boolean {
  const q = u.searchParams;
  if (q.has("token") || q.has("Signature") || q.has("X-Amz-Signature")) {
    return true;
  }
  if (q.has("X-Amz-Expires") || q.has("Expires") || q.has("exp")) {
    return true;
  }
  // Supabase signed object paths
  if (u.pathname.includes("/storage/v1/object/sign/")) {
    return true;
  }
  return false;
}

/**
 * Assess a **server-stamped** library URL for Meta URL-fetch readiness.
 * Does not fetch the resource. Does not trust browser-supplied URLs.
 */
export function assessMetaAdsCreativeUrl(
  imageUrl: string | null | undefined
): MetaAdsCreativeUrlAssessment {
  const url = typeof imageUrl === "string" ? imageUrl.trim() : "";
  const warnings: string[] = [];
  if (!url) {
    return {
      url: "",
      strategy: "reject",
      metaFetchableViaUrl: false,
      warnings: ["Canonical image URL is empty on the library record."],
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      url,
      strategy: "reject",
      metaFetchableViaUrl: false,
      warnings: ["Canonical image URL is malformed."],
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      url,
      strategy: "reject",
      metaFetchableViaUrl: false,
      warnings: ["Unsupported URL scheme for creative media."],
    };
  }

  let privateHost = false;
  if (hostnameLooksLikeIp(parsed.hostname)) {
    const host = parsed.hostname.replace(/^\[|\]$/g, "");
    if (isPrivateOrReservedIp(host) || isLoopbackHostname(parsed.hostname)) {
      privateHost = true;
      warnings.push(
        "Canonical URL points at a loopback or private address; Meta cannot fetch it via URL."
      );
    }
  }

  const signed = looksLikeExpiringSignedUrl(parsed);
  if (signed) {
    warnings.push(
      "Canonical URL appears signed or expiring; do not rely on Meta URL-fetch for create-paused."
    );
  }

  const strategy = classifyMetaImageUrlStrategy(url);
  const metaFetchableViaUrl =
    strategy === "meta_url" && !signed && !privateHost;

  if (strategy === "multipart_local") {
    warnings.push(
      "Image is on local or non-public storage; create-paused must upload bytes, not pass URL to Meta."
    );
  }
  if (strategy === "reject") {
    warnings.push("Canonical URL is not suitable for Meta retrieval.");
  }

  return { url, strategy, metaFetchableViaUrl, warnings };
}
