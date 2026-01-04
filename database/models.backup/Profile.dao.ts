// lib/db/models/Profile.dao.ts
import { db } from '../client';
import { profiles } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Type inference from Drizzle schema
type Profile = typeof profiles.$inferSelect;
type ProfileInsert = typeof profiles.$inferInsert;

/**
 * Data Access Object for Profile operations
 * Note: userId references auth.users (Supabase Auth), not public.users
 */
export class ProfileDAO {
  /**
   * Upsert profile (create or update)
   * userId must be a valid Supabase Auth user ID
   */
  static async upsert(userId: string, profileData: any): Promise<Profile> {
    const now = new Date();

    // Use ON CONFLICT to handle both insert and update
    const [result] = await db
      .insert(profiles)
      .values({
        id: randomUUID(),
        userId,
        data: profileData,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: {
          data: profileData,
          updatedAt: now.toISOString(),
        },
      })
      .returning();

    return result;
  }

  /**
   * Get profile by user ID
   */
  static async get(userId: string): Promise<Profile | null> {
    const result = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update profile
   */
  static async update(
    userId: string,
    data: Partial<ProfileInsert>
  ): Promise<Profile> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(profiles)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(profiles.userId, userId))
      .returning();

    return result;
  }

  /**
   * Delete profile
   */
  static async delete(userId: string): Promise<boolean> {
    try {
      await db
        .delete(profiles)
        .where(eq(profiles.userId, userId));
      return true;
    } catch {
      return false;
    }
  }
}
