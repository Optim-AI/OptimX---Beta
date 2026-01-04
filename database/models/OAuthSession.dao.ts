// lib/db/models/OAuthSession.dao.ts
import { db } from '../client';
import { oauthSessions } from '@/database/schema';
import { eq, lt, desc } from 'drizzle-orm';

// Type inference from Drizzle schema
type OAuthSession = typeof oauthSessions.$inferSelect;

/**
 * Data Access Object for OAuth Session operations
 */
export class OAuthSessionDAO {
  /**
   * Store OAuth session data
   */
  static async store(
    sessionId: string,
    userId: string,
    provider: string,
    data: any,
    expiresAt: Date | string
  ): Promise<OAuthSession> {
    const now = new Date().toISOString();
    const expiresAtStr = new Date(expiresAt).toISOString();

    const [result] = await db
      .insert(oauthSessions)
      .values({
        id: sessionId,
        userId,
        provider,
        data,
        expiresAt: expiresAtStr,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: oauthSessions.id,
        set: {
          data,
          expiresAt: expiresAtStr,
        },
      })
      .returning();

    return result;
  }

  /**
   * Get OAuth session by ID
   */
  static async get(sessionId: string): Promise<OAuthSession | null> {
    const result = await db
      .select()
      .from(oauthSessions)
      .where(eq(oauthSessions.id, sessionId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Delete OAuth session
   */
  static async delete(sessionId: string): Promise<boolean> {
    try {
      await db
        .delete(oauthSessions)
        .where(eq(oauthSessions.id, sessionId));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear all expired sessions
   */
  static async clearExpired(): Promise<number> {
    const now = new Date().toISOString();

    const result = await db
      .delete(oauthSessions)
      .where(lt(oauthSessions.expiresAt, now));

    // Drizzle doesn't return count directly, so we return 0 for now
    // You could do a select count before delete if needed
    return 0;
  }

  /**
   * Get all sessions for a user
   */
  static async listByUser(userId: string): Promise<OAuthSession[]> {
    return db
      .select()
      .from(oauthSessions)
      .where(eq(oauthSessions.userId, userId))
      .orderBy(desc(oauthSessions.createdAt));
  }
}
