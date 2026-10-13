/**
 * Ownership helpers for /api/generated-contents/ensure.
 * Client-safe (no Node dns / supabase admin) so studio UIs can reuse path parsing.
 */

/** Parse Supabase public object path from a public storage URL (no Node imports). */
export function storagePathFromPublicUrl(mediaUrl: string): string | null {
  try {
    const u = new URL(mediaUrl);
    const marker = "/storage/v1/object/public/";
    const idx = u.pathname.indexOf(marker);
    if (idx < 0) return null;
    const rest = u.pathname.slice(idx + marker.length);
    const slash = rest.indexOf("/");
    if (slash <= 0) return null;
    return decodeURIComponent(rest.slice(slash + 1)) || null;
  } catch {
    return null;
  }
}

/**
 * Known user-scoped storage layouts. Reject ensuring a path that embeds a
 * different user's id (even if no library row exists yet).
 *
 * Unscoped layouts (e.g. generated/videos/{uuid}_…) are allowed — first
 * authenticated ensure claims them; cross-user claim is blocked via DAO.
 */
const USER_SCOPED_PREFIXES = [
  /^poster-generation\/([^/]+)\//,
  /^campaigns\/([^/]+)\//,
] as const;

export type EnsurePathOwnershipResult =
  | { ok: true }
  | { ok: false; code: "foreign_path"; error: string };

export function assertEnsureableStoragePath(opts: {
  userId: string;
  storagePath: string;
}): EnsurePathOwnershipResult {
  const path = opts.storagePath.replace(/^\/+/, "");
  for (const re of USER_SCOPED_PREFIXES) {
    const m = path.match(re);
    if (m && m[1] && m[1] !== opts.userId) {
      return {
        ok: false,
        code: "foreign_path",
        error:
          "This creative belongs to another account and cannot be registered for publishing.",
      };
    }
  }
  return { ok: true };
}
