// lib/db/models/Chat.dao.ts
import { db } from '../client';
import { userChats } from '@/database/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Type inference from Drizzle schema
type UserChat = typeof userChats.$inferSelect;

/**
 * Data Access Object for Chat operations
 */
export class ChatDAO {
  /**
   * Save chat message
   */
  static async saveMessage(
    userId: string,
    message: string,
    role: string,
    metadata?: any
  ): Promise<UserChat> {
    const now = new Date().toISOString();

    const [result] = await db
      .insert(userChats)
      .values({
        id: randomUUID(),
        userId,
        role,
        message,
        metadata: metadata || null,
        createdAt: now,
      })
      .returning();

    return result;
  }

  /**
   * Get chat history for user
   */
  static async getChatHistory(
    userId: string,
    limit: number = 50
  ): Promise<UserChat[]> {
    return db
      .select()
      .from(userChats)
      .where(eq(userChats.userId, userId))
      .orderBy(desc(userChats.createdAt))
      .limit(limit);
  }

  /**
   * Delete all chats for user
   */
  static async deleteUserChats(userId: string): Promise<number> {
    await db
      .delete(userChats)
      .where(eq(userChats.userId, userId));

    // Drizzle doesn't return count directly, return 0 for now
    return 0;
  }

  /**
   * Delete specific chat message
   */
  static async deleteMessage(id: string): Promise<boolean> {
    try {
      await db
        .delete(userChats)
        .where(eq(userChats.id, id));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get recent chats across all users (admin)
   */
  static async getRecentChats(limit: number = 100): Promise<UserChat[]> {
    return db
      .select()
      .from(userChats)
      .orderBy(desc(userChats.createdAt))
      .limit(limit);
  }
}
