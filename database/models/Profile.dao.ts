// database/models/Profile.dao.ts
import { db } from '../client';
import { profiles } from '@/database/schema';
import { eq } from 'drizzle-orm';

// Type inference from Drizzle schema
type Profile = typeof profiles.$inferSelect;
type ProfileInsert = typeof profiles.$inferInsert;

const PROFILE_UPSERT_KEYS = [
  'fullName', 'businessName', 'email', 'phone', 'phoneVerified',
  'businessMobile', 'businessMobileVerified', 'location', 'businessType',
  'businessSize', 'useCase', 'colorPrimary', 'colorSecondary', 'font',
  'logoPath', 'refImages', 'heardFrom', 'heardFromOther', 'invoiceEmail',
  'gstNumber', 'primaryGoal', 'tagline', 'organisationName'
] as const;

const SNAKE_TO_CAMEL: Record<string, string> = {
  full_name: 'fullName', business_name: 'businessName', phone_verified: 'phoneVerified',
  business_mobile: 'businessMobile', business_mobile_verified: 'businessMobileVerified',
  business_type: 'businessType', business_size: 'businessSize', use_case: 'useCase',
  color_primary: 'colorPrimary', color_secondary: 'colorSecondary', logo_path: 'logoPath',
  ref_images: 'refImages', heard_from: 'heardFrom', heard_from_other: 'heardFromOther',
  invoice_email: 'invoiceEmail', gst_number: 'gstNumber', primary_goal: 'primaryGoal',
  organisation_name: 'organisationName',
};

function sanitizeProfileData(data: Record<string, unknown>): Partial<ProfileInsert> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    const camel = SNAKE_TO_CAMEL[k] ?? k;
    if (PROFILE_UPSERT_KEYS.includes(camel as any)) {
      (out as any)[camel] = v;
    }
  }
  return out as Partial<ProfileInsert>;
}

/**
 * Data Access Object for Profile operations
 * Note: Profiles table uses explicit columns (not JSONB)
 * id references auth.users (Supabase Auth)
 */
export class ProfileDAO {
  /**
   * Upsert profile (create or update)
   * id must be a valid Supabase Auth user ID
   */
  static async upsert(id: string, profileData: Partial<ProfileInsert> | Record<string, unknown>): Promise<Profile> {
    const now = new Date().toISOString();
    const sanitized = sanitizeProfileData(profileData as Record<string, unknown>);

    // Use ON CONFLICT to handle both insert and update
    const [result] = await db
      .insert(profiles)
      .values({
        id,
        ...sanitized,
        insertedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          ...sanitized,
          updatedAt: now,
        },
      })
      .returning();

    return result;
  }

  /**
   * Get profile by user ID
   */
  static async get(id: string): Promise<Profile | null> {
    const result = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get profile by email
   */
  static async getByEmail(email: string): Promise<Profile | null> {
    const result = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update profile
   */
  static async update(
    id: string,
    data: Partial<ProfileInsert>
  ): Promise<Profile> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(profiles)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(profiles.id, id))
      .returning();

    return result;
  }

  /**
   * Delete profile
   */
  static async delete(id: string): Promise<boolean> {
    try {
      await db
        .delete(profiles)
        .where(eq(profiles.id, id));
      return true;
    } catch {
      return false;
    }
  }
}
