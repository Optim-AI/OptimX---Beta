/**
 * Idempotent profile ensure for post-auth and onboarding writes.
 * Inserts a minimal row when missing; never overwrites existing fields.
 */

import { supabaseAdmin } from '@/auth/supabase/admin';
import { ProfileDAO } from '@/database';

export type EnsureProfileBasics = {
  email?: string | null;
  fullName?: string | null;
};

function deriveFullNameFromMetadata(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  const candidates = [
    meta.full_name,
    meta.name,
    meta.preferred_username,
    typeof meta.given_name === 'string'
      ? meta.family_name
        ? `${meta.given_name} ${meta.family_name}`
        : meta.given_name
      : null,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

/**
 * Ensure a profiles row exists for auth.users.id.
 * Existing rows are returned unchanged (no field overwrite).
 */
export async function ensureProfile(
  userId: string,
  basics?: EnsureProfileBasics
) {
  if (!userId) {
    throw new Error('ensureProfile requires a user id');
  }

  const existing = await ProfileDAO.get(userId);
  if (existing) return existing;

  let email = basics?.email?.trim() || null;
  let fullName = basics?.fullName?.trim() || null;

  if (!email || !fullName) {
    try {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (!error && data?.user) {
        email = email || data.user.email || null;
        fullName =
          fullName ||
          deriveFullNameFromMetadata(
            (data.user.user_metadata as Record<string, unknown> | undefined) ?? undefined
          );
      }
    } catch (err) {
      console.warn('[ensureProfile] admin getUserById failed:', err);
    }
  }

  try {
    return await ProfileDAO.upsert(userId, {
      ...(email ? { email } : {}),
      ...(fullName ? { fullName } : {}),
    });
  } catch (err) {
    // Email unique collisions: insert the id without email so the row exists.
    const msg = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate|profiles_email/i.test(msg) && email) {
      try {
        return await ProfileDAO.upsert(userId, {
          ...(fullName ? { fullName } : {}),
        });
      } catch (retryErr) {
        const again = await ProfileDAO.get(userId);
        if (again) return again;
        throw retryErr;
      }
    }
    const again = await ProfileDAO.get(userId);
    if (again) return again;
    throw err;
  }
}
