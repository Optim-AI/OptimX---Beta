// lib/db/models/GoogleAds.dao.ts
import { db } from '../client';
import { googleAdsTokens } from '@/database/schema';
import { eq } from 'drizzle-orm';

// Type inference from Drizzle schema
type GoogleAdsToken = typeof googleAdsTokens.$inferSelect;

/**
 * Data Access Object for Google Ads Token operations
 */
export class GoogleAdsDAO {
  /**
   * Upsert Google Ads token
   */
  static async upsertToken(
    userId: string,
    refreshToken: string,
    accessToken: string | null,
    expiresAt: number | Date | null,
    scope: string | null
  ): Promise<GoogleAdsToken> {
    const now = new Date().toISOString();
    const expiresAtStr = expiresAt ? new Date(expiresAt).toISOString() : null;

    const [result] = await db
      .insert(googleAdsTokens)
      .values({
        userId,
        refreshToken,
        accessToken,
        tokenExpiresAt: expiresAtStr,
        scope,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: googleAdsTokens.userId,
        set: {
          refreshToken,
          accessToken,
          tokenExpiresAt: expiresAtStr,
          scope,
          updatedAt: now,
        },
      })
      .returning();

    return result;
  }

  /**
   * Get Google Ads token for user
   */
  static async getToken(userId: string): Promise<GoogleAdsToken | null> {
    const result = await db
      .select()
      .from(googleAdsTokens)
      .where(eq(googleAdsTokens.userId, userId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Delete Google Ads token
   */
  static async deleteToken(userId: string): Promise<boolean> {
    try {
      await db
        .delete(googleAdsTokens)
        .where(eq(googleAdsTokens.userId, userId));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Update access token only
   */
  static async updateAccessToken(
    userId: string,
    accessToken: string,
    expiresAt: number | Date
  ): Promise<GoogleAdsToken> {
    const now = new Date().toISOString();
    const expiresAtStr = new Date(expiresAt).toISOString();

    const [result] = await db
      .update(googleAdsTokens)
      .set({
        accessToken,
        tokenExpiresAt: expiresAtStr,
        updatedAt: now,
      })
      .where(eq(googleAdsTokens.userId, userId))
      .returning();

    return result;
  }
}
