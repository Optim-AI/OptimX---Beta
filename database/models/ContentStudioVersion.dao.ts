import { db } from '../client';
import { contentStudioVersions } from '@/database/schema';
import { eq, and, desc } from 'drizzle-orm';

type ContentStudioVersion = typeof contentStudioVersions.$inferSelect;

const MAX_VERSIONS_PER_PRODUCT = 30;

export class ContentStudioVersionDAO {
  static async create(data: {
    userId: string;
    scanId?: string;
    productName: string;
    versionNumber: number;
    adAngles?: any;
    campaignPlan?: any;
    campaignStrategy?: any;
    generatedPosters?: any;
    campaign?: any;
    productData?: any;
  }): Promise<ContentStudioVersion> {
    const [result] = await db
      .insert(contentStudioVersions)
      .values({
        userId: data.userId,
        scanId: data.scanId || null,
        productName: data.productName,
        versionNumber: data.versionNumber,
        adAngles: data.adAngles || null,
        campaignPlan: data.campaignPlan || null,
        campaignStrategy: data.campaignStrategy || null,
        generatedPosters: data.generatedPosters || null,
        campaign: data.campaign || null,
        productData: data.productData || null,
      })
      .returning();
    return result;
  }

  static async listByUserAndProduct(
    userId: string,
    productName: string,
    limit = MAX_VERSIONS_PER_PRODUCT
  ): Promise<ContentStudioVersion[]> {
    return db
      .select()
      .from(contentStudioVersions)
      .where(
        and(
          eq(contentStudioVersions.userId, userId),
          eq(contentStudioVersions.productName, productName)
        )
      )
      .orderBy(desc(contentStudioVersions.createdAt))
      .limit(limit);
  }

  static async getById(id: string, userId: string): Promise<ContentStudioVersion | null> {
    const rows = await db
      .select()
      .from(contentStudioVersions)
      .where(
        and(
          eq(contentStudioVersions.id, id),
          eq(contentStudioVersions.userId, userId)
        )
      )
      .limit(1);
    return rows[0] || null;
  }

  static async countByUserAndProduct(userId: string, productName: string): Promise<number> {
    const rows = await db
      .select()
      .from(contentStudioVersions)
      .where(
        and(
          eq(contentStudioVersions.userId, userId),
          eq(contentStudioVersions.productName, productName)
        )
      );
    return rows.length;
  }

  static async deleteOldest(userId: string, productName: string): Promise<void> {
    const versions = await db
      .select({ id: contentStudioVersions.id })
      .from(contentStudioVersions)
      .where(
        and(
          eq(contentStudioVersions.userId, userId),
          eq(contentStudioVersions.productName, productName)
        )
      )
      .orderBy(desc(contentStudioVersions.createdAt));

    if (versions.length > MAX_VERSIONS_PER_PRODUCT) {
      const toDelete = versions.slice(MAX_VERSIONS_PER_PRODUCT);
      for (const v of toDelete) {
        await db
          .delete(contentStudioVersions)
          .where(eq(contentStudioVersions.id, v.id));
      }
    }
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    try {
      await db
        .delete(contentStudioVersions)
        .where(
          and(
            eq(contentStudioVersions.id, id),
            eq(contentStudioVersions.userId, userId)
          )
        );
      return true;
    } catch {
      return false;
    }
  }
}
