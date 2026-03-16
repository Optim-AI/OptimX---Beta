import { db } from '../client';
import { contentStudioScans } from '@/database/schema';
import { eq, and, desc } from 'drizzle-orm';

type ContentStudioScan = typeof contentStudioScans.$inferSelect;

export class ContentStudioScanDAO {
  static async create(data: {
    userId: string;
    url: string;
    brandSummary?: any;
    products?: any;
  }): Promise<ContentStudioScan> {
    const [result] = await db
      .insert(contentStudioScans)
      .values({
        userId: data.userId,
        url: data.url,
        brandSummary: data.brandSummary || null,
        products: data.products || null,
      })
      .returning();
    return result;
  }

  static async getLatestByUser(userId: string): Promise<ContentStudioScan | null> {
    const rows = await db
      .select()
      .from(contentStudioScans)
      .where(eq(contentStudioScans.userId, userId))
      .orderBy(desc(contentStudioScans.createdAt))
      .limit(1);
    return rows[0] || null;
  }

  static async getByIdAndUser(id: string, userId: string): Promise<ContentStudioScan | null> {
    const rows = await db
      .select()
      .from(contentStudioScans)
      .where(and(eq(contentStudioScans.id, id), eq(contentStudioScans.userId, userId)))
      .limit(1);
    return rows[0] || null;
  }

  static async listByUser(userId: string, limit = 20): Promise<ContentStudioScan[]> {
    return db
      .select()
      .from(contentStudioScans)
      .where(eq(contentStudioScans.userId, userId))
      .orderBy(desc(contentStudioScans.createdAt))
      .limit(limit);
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    try {
      await db
        .delete(contentStudioScans)
        .where(and(eq(contentStudioScans.id, id), eq(contentStudioScans.userId, userId)));
      return true;
    } catch {
      return false;
    }
  }
}
