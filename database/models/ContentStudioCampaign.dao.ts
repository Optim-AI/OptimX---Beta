import { db } from '../client';
import { contentStudioCampaigns } from '@/database/schema';
import { eq, and } from 'drizzle-orm';

type ContentStudioCampaign = typeof contentStudioCampaigns.$inferSelect;

export class ContentStudioCampaignDAO {
  static async create(data: {
    userId: string;
    scanId: string;
    productName: string;
    campaignName?: string;
    ads?: any;
  }): Promise<ContentStudioCampaign> {
    const [result] = await db
      .insert(contentStudioCampaigns)
      .values({
        userId: data.userId,
        scanId: data.scanId,
        productName: data.productName,
        campaignName: data.campaignName || null,
        ads: data.ads || null,
      })
      .returning();
    return result;
  }

  static async listByScan(scanId: string): Promise<ContentStudioCampaign[]> {
    return db
      .select()
      .from(contentStudioCampaigns)
      .where(eq(contentStudioCampaigns.scanId, scanId));
  }

  static async delete(id: string, userId: string): Promise<boolean> {
    try {
      await db
        .delete(contentStudioCampaigns)
        .where(and(eq(contentStudioCampaigns.id, id), eq(contentStudioCampaigns.userId, userId)));
      return true;
    } catch {
      return false;
    }
  }
}
