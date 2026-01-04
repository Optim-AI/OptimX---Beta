// database/models/Chat.dao.ts
import { db } from '../client';
import { userChats } from '@/database/schema';
import { eq, desc } from 'drizzle-orm';

// Type inference from Drizzle schema
type UserChat = typeof userChats.$inferSelect;
type UserChatInsert = typeof userChats.$inferInsert;

/**
 * Data Access Object for Chat operations
 * Production schema: user_chats is a session-based table with:
 * - id (uuid, session ID)
 * - user_id (uuid)
 * - title (text)
 * - messages (jsonb array of message objects)
 * - consent_for_training, sanitized, client_version
 * - created_at, updated_at
 */
export class ChatDAO {
  /**
   * Create new chat session
   */
  static async create(
    userId: string,
    role: string,
    message: string,
    metadata?: any
  ): Promise<UserChat> {
    const now = new Date().toISOString();
    const chatId = crypto.randomUUID();

    // Parse messages if it's a JSON string, otherwise create array
    let messagesArray: any[];
    try {
      messagesArray = typeof message === 'string' && message.startsWith('[')
        ? JSON.parse(message)
        : [{ role, content: message }];
    } catch {
      messagesArray = [{ role, content: message }];
    }

    const [result] = await db
      .insert(userChats)
      .values({
        id: chatId,
        userId,
        title: metadata?.title || 'New Chat',
        messages: messagesArray,
        consentForTraining: metadata?.consent_for_training || false,
        sanitized: false,
        clientVersion: metadata?.client_version || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result;
  }

  /**
   * Upsert (create or update) chat session
   */
  static async upsert(
    chatId: string,
    userId: string,
    role: string,
    message: string,
    metadata?: any
  ): Promise<UserChat> {
    const now = new Date().toISOString();

    // Parse messages if it's a JSON string
    let messagesArray: any[];
    try {
      messagesArray = typeof message === 'string' && message.startsWith('[')
        ? JSON.parse(message)
        : [{ role, content: message }];
    } catch {
      messagesArray = [{ role, content: message }];
    }

    // Check if chat exists
    const existing = await db
      .select()
      .from(userChats)
      .where(eq(userChats.id, chatId))
      .limit(1);

    if (existing[0]) {
      // Update existing chat
      const updateData: any = {
        updatedAt: now,
      };

      // Only update messages if provided
      if (message && message !== '[]') {
        updateData.messages = messagesArray;
      }

      // Update title if provided in metadata
      if (metadata?.title) {
        updateData.title = metadata.title;
      }

      const [result] = await db
        .update(userChats)
        .set(updateData)
        .where(eq(userChats.id, chatId))
        .returning();

      return result;
    } else {
      // Create new chat
      const [result] = await db
        .insert(userChats)
        .values({
          id: chatId,
          userId,
          title: metadata?.title || 'New Chat',
          messages: messagesArray,
          consentForTraining: metadata?.consent_for_training || false,
          sanitized: false,
          clientVersion: metadata?.client_version || null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return result;
    }
  }

  /**
   * Find all chats for a user
   */
  static async findByUserId(userId: string): Promise<UserChat[]> {
    return db
      .select()
      .from(userChats)
      .where(eq(userChats.userId, userId))
      .orderBy(desc(userChats.updatedAt));
  }

  /**
   * Find chat by ID
   */
  static async findById(chatId: string): Promise<UserChat | null> {
    const result = await db
      .select()
      .from(userChats)
      .where(eq(userChats.id, chatId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update chat messages
   */
  static async updateMessages(
    chatId: string,
    messages: any[]
  ): Promise<UserChat> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(userChats)
      .set({
        messages,
        updatedAt: now,
      })
      .where(eq(userChats.id, chatId))
      .returning();

    return result;
  }

  /**
   * Update chat title
   */
  static async updateTitle(
    chatId: string,
    title: string
  ): Promise<UserChat> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(userChats)
      .set({
        title,
        updatedAt: now,
      })
      .where(eq(userChats.id, chatId))
      .returning();

    return result;
  }

  /**
   * Delete chat
   */
  static async delete(chatId: string): Promise<boolean> {
    try {
      await db
        .delete(userChats)
        .where(eq(userChats.id, chatId));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete all chats for user
   */
  static async deleteUserChats(userId: string): Promise<number> {
    await db
      .delete(userChats)
      .where(eq(userChats.userId, userId));

    return 0;
  }

  /**
   * Get recent chats across all users (admin)
   */
  static async getRecentChats(limit: number = 100): Promise<UserChat[]> {
    return db
      .select()
      .from(userChats)
      .orderBy(desc(userChats.updatedAt))
      .limit(limit);
  }
}
