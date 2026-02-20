// database/models/GeneratedImage.dao.ts
import { db } from '../client';
import { userGeneratedImage } from '@/database/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Type inference from Drizzle schema
type GeneratedImage = typeof userGeneratedImage.$inferSelect;

/**
 * Data Access Object for GeneratedImage (AI-generated/campaign images)
 */
export class GeneratedImageDAO {
  /**
   * Insert a new generated image record
   */
  static async insert(
    userId: string,
    imageUrl: string,
    imagePath: string | null,
    metadata?: Record<string, any>
  ): Promise<GeneratedImage> {
    const now = new Date().toISOString();

    const [result] = await db
      .insert(userGeneratedImage)
      .values({
        id: randomUUID(),
        userId,
        imageUrl,
        imagePath,
        metadata: metadata || null,
        createdAt: now,
      })
      .returning();

    return result;
  }

  /**
   * Get generated images for a user
   */
  static async getByUser(
    userId: string,
    limit: number = 50
  ): Promise<GeneratedImage[]> {
    return db
      .select()
      .from(userGeneratedImage)
      .where(eq(userGeneratedImage.userId, userId))
      .orderBy(desc(userGeneratedImage.createdAt))
      .limit(limit);
  }

  /**
   * Get all saved image URLs for a user (for expiry protection).
   * Returns a Set containing both imageUrl and metadata.originalChatUrl values.
   */
  static async getSavedUrls(userId: string): Promise<Set<string>> {
    const rows = await db
      .select({
        imageUrl: userGeneratedImage.imageUrl,
        metadata: userGeneratedImage.metadata,
      })
      .from(userGeneratedImage)
      .where(eq(userGeneratedImage.userId, userId));

    const urls = new Set<string>();
    for (const row of rows) {
      if (row.imageUrl) urls.add(row.imageUrl);
      const meta = row.metadata as Record<string, any> | null;
      if (meta?.originalChatUrl && typeof meta.originalChatUrl === 'string') {
        urls.add(meta.originalChatUrl);
      }
    }
    return urls;
  }

  /**
   * Get a single generated image by ID
   */
  static async getById(id: string): Promise<GeneratedImage | null> {
    const result = await db
      .select()
      .from(userGeneratedImage)
      .where(eq(userGeneratedImage.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Delete a generated image
   */
  static async delete(id: string): Promise<boolean> {
    try {
      await db
        .delete(userGeneratedImage)
        .where(eq(userGeneratedImage.id, id));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete all generated images for a user
   */
  static async deleteByUser(userId: string): Promise<number> {
    await db
      .delete(userGeneratedImage)
      .where(eq(userGeneratedImage.userId, userId));

    // Drizzle doesn't return count directly, return 0 for now
    return 0;
  }
}
