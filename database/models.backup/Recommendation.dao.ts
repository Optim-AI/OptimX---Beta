// lib/db/models/Recommendation.dao.ts
import { db } from '../client';
import { recommendations, campaigns } from '@/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Type inference from Drizzle schema
type Recommendation = typeof recommendations.$inferSelect;
type RecommendationInsert = typeof recommendations.$inferInsert;
type RecommendationWithCampaign = Recommendation & {
  campaign: (typeof campaigns.$inferSelect) | null;
};

/**
 * Data Access Object for Recommendation operations
 */
export class RecommendationDAO {
  /**
   * Create new recommendation
   */
  static async create(recommendationData: {
    userId: string;
    campaignId?: string | null;
    type?: string;
    title?: string;
    description?: string;
    data?: any;
    status?: string;
  }): Promise<Recommendation> {
    const now = new Date().toISOString();

    const [result] = await db
      .insert(recommendations)
      .values({
        id: randomUUID(),
        userId: recommendationData.userId,
        campaignId: recommendationData.campaignId || null,
        type: recommendationData.type ?? null,
        title: recommendationData.title ?? null,
        description: recommendationData.description ?? null,
        data: recommendationData.data || null,
        status: recommendationData.status || 'pending',
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return result;
  }

  /**
   * Find recommendation by ID
   */
  static async findById(id: string): Promise<RecommendationWithCampaign | null> {
    const result = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.id, id))
      .limit(1);

    if (!result[0]) return null;

    let campaign = null;
    if (result[0].campaignId) {
      const campaignResult = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.id, result[0].campaignId))
        .limit(1);
      campaign = campaignResult[0] || null;
    }

    return {
      ...result[0],
      campaign,
    };
  }

  /**
   * List recommendations by campaign
   */
  static async listByCampaign(campaignId: string): Promise<Recommendation[]> {
    return db
      .select()
      .from(recommendations)
      .where(eq(recommendations.campaignId, campaignId))
      .orderBy(desc(recommendations.createdAt));
  }

  /**
   * List recommendations by user
   */
  static async listByUser(userId: string, status?: string): Promise<RecommendationWithCampaign[]> {
    const conditions = status
      ? and(eq(recommendations.userId, userId), eq(recommendations.status, status))
      : eq(recommendations.userId, userId);

    const recs = await db
      .select()
      .from(recommendations)
      .where(conditions)
      .orderBy(desc(recommendations.createdAt));

    // Fetch campaign for each recommendation
    const result: RecommendationWithCampaign[] = [];
    for (const rec of recs) {
      let campaign = null;
      if (rec.campaignId) {
        const campaignResult = await db
          .select()
          .from(campaigns)
          .where(eq(campaigns.id, rec.campaignId))
          .limit(1);
        campaign = campaignResult[0] || null;
      }

      result.push({
        ...rec,
        campaign,
      });
    }

    return result;
  }

  /**
   * Update recommendation
   */
  static async update(
    id: string,
    data: Partial<RecommendationInsert>
  ): Promise<Recommendation> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(recommendations)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(recommendations.id, id))
      .returning();

    return result;
  }

  /**
   * Update recommendation status
   */
  static async updateStatus(id: string, status: string): Promise<Recommendation> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(recommendations)
      .set({
        status,
        updatedAt: now,
      })
      .where(eq(recommendations.id, id))
      .returning();

    return result;
  }

  /**
   * Delete recommendation
   */
  static async delete(id: string): Promise<boolean> {
    try {
      await db
        .delete(recommendations)
        .where(eq(recommendations.id, id));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Bulk create recommendations
   */
  static async bulkCreate(
    recommendationList: Array<{
      userId: string;
      campaignId?: string | null;
      type?: string;
      title?: string;
      description?: string;
      data?: any;
    }>
  ): Promise<number> {
    const now = new Date().toISOString();

    const result = await db
      .insert(recommendations)
      .values(
        recommendationList.map((rec) => ({
          id: randomUUID(),
          userId: rec.userId,
          campaignId: rec.campaignId || null,
          type: rec.type ?? null,
          title: rec.title ?? null,
          description: rec.description ?? null,
          data: rec.data || null,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        }))
      );

    return recommendationList.length;
  }
}
