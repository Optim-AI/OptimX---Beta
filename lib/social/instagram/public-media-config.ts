/**
 * Configuration for Instagram-publishable (Meta-fetchable) media hosting.
 *
 * Production: NEXT_PUBLIC_SUPABASE_URL is already public HTTPS → use primary storage.
 * Local: primary URL is localhost → require INSTAGRAM_MEDIA_HOST_SUPABASE_URL
 * (hosted Supabase project) so Meta can fetch the mirrored object.
 */

import { isLoopbackHostname } from "@/lib/social/facebook-publish/resolve-media";

export const INSTAGRAM_MEDIA_MIRROR_PREFIX = "instagram-publish";
export const DEFAULT_INSTAGRAM_MEDIA_BUCKET = "campaign-assets";

/** Soft limits for Instagram Content Publishing. */
export const INSTAGRAM_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const INSTAGRAM_MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export type InstagramMediaHostConfig =
  | {
      ok: true;
      /** Public HTTPS Supabase API origin (no trailing slash) */
      supabaseUrl: string;
      serviceRoleKey: string;
      bucket: string;
      /** Whether this is the app's primary Supabase or a dedicated host */
      source: "primary" | "dedicated_host";
    }
  | {
      ok: false;
      code: "media_host_not_configured" | "media_host_insecure";
      error: string;
    };

export function normalizeSupabaseOrigin(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * True when the value looks like a JWT pasted where a URL belongs
 * (common mix-up with the anon/service_role key).
 */
export function looksLikeJwtAsHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h.startsWith("eyj")) return true;
  // JWTs are long and contain multiple '.'-separated base64 segments as host labels
  if (hostname.length > 80 && hostname.split(".").length >= 3) return true;
  return false;
}

/**
 * Hosted Supabase API origins Meta (and our mirror client) can use.
 * Accepts *.supabase.co / *.supabase.in; rejects localhost and JWT-as-URL mistakes.
 */
export function isPublicHttpsSupabaseOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return false;
    if (isLoopbackHostname(u.hostname)) return false;
    if (looksLikeJwtAsHostname(u.hostname)) return false;
    const host = u.hostname.toLowerCase();
    if (host.endsWith(".supabase.co") || host.endsWith(".supabase.in")) {
      return true;
    }
    // Custom domains only if they look like a normal host (not a key)
    if (host.includes(".") && host.length <= 80 && !host.includes("_")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getPrimarySupabaseUrl(): string | null {
  return normalizeSupabaseOrigin(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || null
  );
}

/**
 * Resolve where Instagram publish media must be hosted.
 * Never treats localhost as publishable.
 */
export function getInstagramMediaHostConfig(
  env: Record<string, string | undefined> = process.env
): InstagramMediaHostConfig {
  const bucket =
    (env.INSTAGRAM_MEDIA_HOST_BUCKET || DEFAULT_INSTAGRAM_MEDIA_BUCKET).trim() ||
    DEFAULT_INSTAGRAM_MEDIA_BUCKET;

  const primary = normalizeSupabaseOrigin(
    env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || null
  );
  const primaryKey =
    env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE || "";

  if (primary && isPublicHttpsSupabaseOrigin(primary) && primaryKey) {
    return {
      ok: true,
      supabaseUrl: primary,
      serviceRoleKey: primaryKey,
      bucket,
      source: "primary",
    };
  }

  const dedicated = normalizeSupabaseOrigin(
    env.INSTAGRAM_MEDIA_HOST_SUPABASE_URL || null
  );
  const dedicatedKey =
    env.INSTAGRAM_MEDIA_HOST_SUPABASE_SERVICE_ROLE_KEY ||
    env.INSTAGRAM_MEDIA_HOST_SERVICE_ROLE_KEY ||
    "";

  const dedicatedRaw = (env.INSTAGRAM_MEDIA_HOST_SUPABASE_URL || "").trim();
  if (dedicatedRaw && !dedicated) {
    return {
      ok: false,
      code: "media_host_insecure",
      error:
        "INSTAGRAM_MEDIA_HOST_SUPABASE_URL is not a valid URL. Use your hosted Project URL " +
        "from Supabase Dashboard → Settings → API (https://YOUR_PROJECT_REF.supabase.co). " +
        "Do not paste the anon or service_role JWT into this variable.",
    };
  }

  if (dedicated) {
    if (looksLikeJwtAsHostname(new URL(dedicated).hostname)) {
      return {
        ok: false,
        code: "media_host_insecure",
        error:
          "INSTAGRAM_MEDIA_HOST_SUPABASE_URL looks like an API key (JWT), not a Project URL. " +
          "Set it to https://YOUR_PROJECT_REF.supabase.co from Supabase Dashboard → Settings → API. " +
          "Put the service_role secret only in INSTAGRAM_MEDIA_HOST_SUPABASE_SERVICE_ROLE_KEY.",
      };
    }
    if (!isPublicHttpsSupabaseOrigin(dedicated)) {
      return {
        ok: false,
        code: "media_host_insecure",
        error:
          "INSTAGRAM_MEDIA_HOST_SUPABASE_URL must be a public HTTPS Supabase origin " +
          "(e.g. https://YOUR_PROJECT_REF.supabase.co). Localhost cannot be fetched by Meta.",
      };
    }
    if (!dedicatedKey) {
      return {
        ok: false,
        code: "media_host_not_configured",
        error:
          "Set INSTAGRAM_MEDIA_HOST_SUPABASE_SERVICE_ROLE_KEY for the hosted Supabase " +
          "project used to mirror Instagram publish media.",
      };
    }
    return {
      ok: true,
      supabaseUrl: dedicated,
      serviceRoleKey: dedicatedKey,
      bucket,
      source: "dedicated_host",
    };
  }

  const primaryHint = primary
    ? `Primary storage is ${primary} (not Meta-reachable).`
    : "Primary Supabase URL is not set.";

  return {
    ok: false,
    code: "media_host_not_configured",
    error:
      `${primaryHint} For local Instagram publishing, set ` +
      `INSTAGRAM_MEDIA_HOST_SUPABASE_URL=https://YOUR_PROJECT.supabase.co and ` +
      `INSTAGRAM_MEDIA_HOST_SUPABASE_SERVICE_ROLE_KEY to that project's service role. ` +
      `The campaign-assets bucket must allow public read.`,
  };
}

export function buildInstagramMirrorObjectPath(opts: {
  userId: string;
  creativeId: string;
  extension: string;
}): string {
  const safeUser = opts.userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "user";
  const safeId = opts.creativeId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "asset";
  const ext = opts.extension.replace(/[^a-z0-9]/gi, "") || "bin";
  return `${INSTAGRAM_MEDIA_MIRROR_PREFIX}/${safeUser}/${safeId}.${ext}`;
}

export function buildPublicStorageObjectUrl(
  supabaseUrl: string,
  bucket: string,
  objectPath: string
): string {
  const origin = normalizeSupabaseOrigin(supabaseUrl) || supabaseUrl.replace(/\/+$/, "");
  const path = objectPath
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
  return `${origin}/storage/v1/object/public/${encodeURIComponent(bucket)}/${path}`;
}
