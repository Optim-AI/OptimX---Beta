// lib/db/models/Campaign.dao.ts
import { db } from '../client';
import { campaigns } from '@/database/schema';
import { eq, and, desc } from 'drizzle-orm';

// Type inference from Drizzle schema
type Campaign = typeof campaigns.$inferSelect;
type CampaignInsert = typeof campaigns.$inferInsert;

/**
 * Data Access Object for Campaign operations
 */
export class CampaignDAO {
  /**
   * Create new campaign
   */
  static async create(campaignData: {
    userId: string;
    name?: string;
    audience?: string;
    campaignType?: string;
    brandVoice?: string;
    contentTypes?: string[];
    vision?: string;
    output?: any;
    imageUrl?: string[];
    imagePath?: string[];
    isPublished?: boolean;
  }): Promise<Campaign> {
    const [result] = await db
      .insert(campaigns)
      .values({
        userId: campaignData.userId,
        name: campaignData.name || null,
        audience: campaignData.audience || null,
        campaignType: campaignData.campaignType || null,
        brandVoice: campaignData.brandVoice || null,
        contentTypes: campaignData.contentTypes || null,
        vision: campaignData.vision || null,
        output: campaignData.output || null,
        imageUrl: campaignData.imageUrl || null,
        imagePath: campaignData.imagePath || null,
        isPublished: campaignData.isPublished || false,
      })
      .returning();

    return result;
  }

  /**
   * Find campaign by ID
   */
  static async findById(id: string): Promise<Campaign | null> {
    const campaign = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);

    return campaign[0] || null;
  }

  /**
   * List campaigns by user
   */
  static async listByUser(userId: string): Promise<Campaign[]> {
    const campaignList = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt));

    return campaignList;
  }

  /**
   * Update campaign
   */
  static async update(
    id: string,
    data: Partial<CampaignInsert>
  ): Promise<Campaign> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(campaigns)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(campaigns.id, id))
      .returning();

    return result;
  }

  /**
   * Delete campaign
   */
  static async delete(id: string): Promise<boolean> {
    try {
      await db
        .delete(campaigns)
        .where(eq(campaigns.id, id));
      return true;
    } catch {
      return false;
    }
  }

}
