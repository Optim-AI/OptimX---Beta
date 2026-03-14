import { db } from '../client';
import { contentStudioPosters } from '@/database/schema';
import { eq, and } from 'drizzle-orm';

type ContentStudioPoster = typeof contentStudioPosters.$inferSelect;

export class ContentStudioPosterDAO {
  static async create(data: {
    userId: string;
    scanId: string;
    productName: string;
    angle?: any;
    imageUrls: any;
  }): Promise<ContentStudioPoster> {
    const [result] = await db
      .insert(contentStudioPosters)
      .values({
        userId: data.userId,
        scanId: data.scanId,
        productName: data.productName,
        angle: data.angle || null,
        imageUrls: data.imageUrls,
      })
      .returning();
    return result;
  }

  static async listByScan(scanId: string): Promise<ContentStudioPoster[]> {
    return db
      .select()
      .from(contentStudioPosters)
      .where(eq(contentStudioPosters.scanId, scanId));
  }

  static async updateImageUrls(id: string, imageUrls: any): Promise<ContentStudioPoster | null> {
    const rows = await db
      .update(contentStudioPosters)
      .set({ imageUrls })
      .where(eq(contentStudioPosters.id, id))
      .returning();
    return rows[0] || null;
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    try {
      await db
        .delete(contentStudioPosters)
        .where(and(eq(contentStudioPosters.id, id), eq(contentStudioPosters.userId, userId)));
      return true;
    } catch {
      return false;
    }
  }
}
