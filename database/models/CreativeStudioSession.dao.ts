// database/models/CreativeStudioSession.dao.ts
import { db } from '../client';
import { creativeStudioSessions } from '@/database/schema';
import { eq, and, desc, ilike } from 'drizzle-orm';

// Type inference from Drizzle schema
export type CreativeStudioSession = typeof creativeStudioSessions.$inferSelect;
export type NewCreativeStudioSession = typeof creativeStudioSessions.$inferInsert;

/**
 * Data Access Object for Brand Studio Sessions operations
 */
export class CreativeStudioSessionDAO {
  /**
   * Create a new session
   */
  static async create(data: NewCreativeStudioSession): Promise<CreativeStudioSession> {
    const now = new Date().toISOString();
    const [result] = await db
      .insert(creativeStudioSessions)
      .values({
        ...data,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return result;
  }

  /**
   * Get session by ID
   */
  static async getById(id: string): Promise<CreativeStudioSession | null> {
    const result = await db
      .select()
      .from(creativeStudioSessions)
      .where(eq(creativeStudioSessions.id, id))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Get session by ID and user ID (ensures user owns the session)
   */
  static async getByIdAndUserId(id: string, userId: string): Promise<CreativeStudioSession | null> {
    const result = await db
      .select()
      .from(creativeStudioSessions)
      .where(
        and(
          eq(creativeStudioSessions.id, id),
          eq(creativeStudioSessions.userId, userId)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  /**
   * List all sessions for a user
   */
  static async listByUser(
    userId: string,
    options?: {
      sessionType?: 'poster' | 'video';
      limit?: number;
    }
  ): Promise<CreativeStudioSession[]> {
    const { sessionType, limit = 50 } = options || {};

    let query = db
      .select()
      .from(creativeStudioSessions)
      .where(eq(creativeStudioSessions.userId, userId))
      .orderBy(desc(creativeStudioSessions.updatedAt))
      .limit(Math.min(limit, 100));

    // Filter by session type if provided
    if (sessionType) {
      query = db
        .select()
        .from(creativeStudioSessions)
        .where(
          and(
            eq(creativeStudioSessions.userId, userId),
            eq(creativeStudioSessions.sessionType, sessionType)
          )
        )
        .orderBy(desc(creativeStudioSessions.updatedAt))
        .limit(Math.min(limit, 100));
    }

    return query;
  }

  /**
   * Check if session name exists for user and session type
   */
  static async existsByNameAndType(
    userId: string,
    name: string,
    sessionType: 'poster' | 'video'
  ): Promise<boolean> {
    const result = await db
      .select({ id: creativeStudioSessions.id })
      .from(creativeStudioSessions)
      .where(
        and(
          eq(creativeStudioSessions.userId, userId),
          eq(creativeStudioSessions.sessionType, sessionType),
          ilike(creativeStudioSessions.name, name)
        )
      )
      .limit(1);
    return result.length > 0;
  }

  /**
   * Update session
   */
  static async update(
    id: string,
    data: Partial<NewCreativeStudioSession>
  ): Promise<CreativeStudioSession | null> {
    const now = new Date().toISOString();
    const [result] = await db
      .update(creativeStudioSessions)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(creativeStudioSessions.id, id))
      .returning();
    return result || null;
  }

  /**
   * Update session ensuring user owns it
   */
  static async updateByIdAndUserId(
    id: string,
    userId: string,
    data: Partial<NewCreativeStudioSession>
  ): Promise<CreativeStudioSession | null> {
    const now = new Date().toISOString();
    const [result] = await db
      .update(creativeStudioSessions)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(
        and(
          eq(creativeStudioSessions.id, id),
          eq(creativeStudioSessions.userId, userId)
        )
      )
      .returning();
    return result || null;
  }

  /**
   * Delete session
   */
  static async delete(id: string): Promise<boolean> {
    try {
      await db
        .delete(creativeStudioSessions)
        .where(eq(creativeStudioSessions.id, id));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete session ensuring user owns it
   */
  static async deleteByIdAndUserId(id: string, userId: string): Promise<boolean> {
    try {
      await db
        .delete(creativeStudioSessions)
        .where(
          and(
            eq(creativeStudioSessions.id, id),
            eq(creativeStudioSessions.userId, userId)
          )
        );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get sessions by type for a user (poster or video)
   */
  static async getByTypeAndUserId(
    userId: string,
    sessionType: 'poster' | 'video',
    limit: number = 50
  ): Promise<CreativeStudioSession[]> {
    return db
      .select()
      .from(creativeStudioSessions)
      .where(
        and(
          eq(creativeStudioSessions.userId, userId),
          eq(creativeStudioSessions.sessionType, sessionType)
        )
      )
      .orderBy(desc(creativeStudioSessions.updatedAt))
      .limit(Math.min(limit, 100));
  }
}
