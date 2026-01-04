// database/models/Profile.dao.ts
import { db } from '../client';
import { profiles } from '@/database/schema';
import { eq } from 'drizzle-orm';

// Type inference from Drizzle schema
type Profile = typeof profiles.$inferSelect;
type ProfileInsert = typeof profiles.$inferInsert;

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
  static async upsert(id: string, profileData: Partial<ProfileInsert>): Promise<Profile> {
    const now = new Date().toISOString();

    // Use ON CONFLICT to handle both insert and update
    const [result] = await db
      .insert(profiles)
      .values({
        id,
        ...profileData,
        insertedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          ...profileData,
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
