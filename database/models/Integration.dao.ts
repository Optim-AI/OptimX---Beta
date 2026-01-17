// lib/db/models/Integration.dao.ts
import { db } from '../client';
import { integrations } from '@/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Type inference from Drizzle schema
type Integration = typeof integrations.$inferSelect;
type IntegrationInsert = typeof integrations.$inferInsert;

/**
 * Data Access Object for Integration operations
 * Handles all integration-related database operations
 */
export class IntegrationDAO {
  /**
   * Find integration by user ID and provider
   */
  static async findByUserAndProvider(
    userId: string,
    provider: string
  ): Promise<Integration | null> {
    const result = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find integration by ID
   */
  static async findById(id: string): Promise<Integration | null> {
    const result = await db
      .select()
      .from(integrations)
      .where(eq(integrations.id, id))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find integration by page ID (for Meta integrations)
   */
  static async findByPageId(
    userId: string,
    pageId: string,
    provider: string = 'meta'
  ): Promise<Integration | null> {
    const result = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.userId, userId),
          eq(integrations.pageId, pageId),
          eq(integrations.provider, provider)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Find integration by Instagram user ID
   */
  static async findByIgUserId(
    userId: string,
    igUserId: string,
    provider: string = 'meta'
  ): Promise<Integration | null> {
    const result = await db
      .select()
      .from(integrations)
      .where(
        and(
          eq(integrations.userId, userId),
          eq(integrations.igUserId, igUserId),
          eq(integrations.provider, provider)
        )
      )
      .limit(1);

    return result[0] || null;
  }

  /**
   * Create or update integration (upsert)
   * Matches by userId + provider, or by pageId/igUserId if provided
   */
  static async upsert(data: {
    userId: string;
    provider: string;
    providerUserId?: string | null;
    adAccountId?: string | null;
    pageId?: string | null;
    igUserId?: string | null;
    accessToken?: string | null;
    refreshToken?: string | null;
    tokenExpiresAt?: Date | string | null;
    scopes?: string | null;
    credentials?: any;
    pageName?: string | null;
    pageCategory?: string | null;
    allPages?: any;
    raw?: any;
    metadata?: any;
    healthStatus?: string | null;
    lastHealthCheck?: string | null;
    healthErrorMessage?: string | null;
  }): Promise<Integration> {
    const { userId, provider, pageId, igUserId } = data;
    const now = new Date().toISOString();

    // Try to find existing integration
    let existingId: string | null = null;

    // First, try to match by userId + provider
    const byUserProvider = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)))
      .limit(1);
    if (byUserProvider[0]) existingId = byUserProvider[0].id;

    // If not found and pageId provided, try matching by pageId
    if (!existingId && pageId) {
      const byPageId = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(
          and(
            eq(integrations.userId, userId),
            eq(integrations.pageId, pageId),
            eq(integrations.provider, provider)
          )
        )
        .limit(1);
      if (byPageId[0]) existingId = byPageId[0].id;
    }

    // If not found and igUserId provided, try matching by igUserId
    if (!existingId && igUserId) {
      const byIgUserId = await db
        .select({ id: integrations.id })
        .from(integrations)
        .where(
          and(
            eq(integrations.userId, userId),
            eq(integrations.igUserId, igUserId),
            eq(integrations.provider, provider)
          )
        )
        .limit(1);
      if (byIgUserId[0]) existingId = byIgUserId[0].id;
    }

    const integrationData = {
      userId,
      provider,
      providerUserId: data.providerUserId ?? null,
      adAccountId: data.adAccountId ?? null,
      pageId: data.pageId ?? null,
      igUserId: data.igUserId ?? null,
      accessToken: data.accessToken ?? null,
      refreshToken: data.refreshToken ?? null,
      tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt).toISOString() : null,
      scopes: data.scopes ? (Array.isArray(data.scopes) ? data.scopes : [data.scopes]) : null,
      credentials: data.credentials ?? null,
      pageName: data.pageName ?? null,
      pageCategory: data.pageCategory ?? null,
      allPages: data.allPages ?? null,
      raw: data.raw ?? null,
      metadata: data.metadata ?? null,
      healthStatus: data.healthStatus ?? 'healthy',
      healthErrorMessage: data.healthErrorMessage ?? null,
      lastHealthCheck: data.lastHealthCheck ?? now,
      updatedAt: now,
    };

    if (existingId) {
      // Update existing
      const [result] = await db
        .update(integrations)
        .set(integrationData)
        .where(eq(integrations.id, existingId))
        .returning();
      return result;
    } else {
      // Create new
      const [result] = await db
        .insert(integrations)
        .values({
          id: randomUUID(),
          ...integrationData,
          createdAt: now,
        })
        .returning();
      return result;
    }
  }

  /**
   * List all integrations for a user
   */
  static async listByUser(userId: string, provider?: string): Promise<Integration[]> {
    const conditions = provider
      ? and(eq(integrations.userId, userId), eq(integrations.provider, provider))
      : eq(integrations.userId, userId);

    return db
      .select()
      .from(integrations)
      .where(conditions)
      .orderBy(desc(integrations.createdAt));
  }

  /**
   * Delete integration by ID
   */
  static async delete(id: string): Promise<boolean> {
    try {
      await db
        .delete(integrations)
        .where(eq(integrations.id, id));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete integration by user and provider
   */
  static async deleteByUserAndProvider(
    userId: string,
    provider: string
  ): Promise<boolean> {
    try {
      await db
        .delete(integrations)
        .where(and(eq(integrations.userId, userId), eq(integrations.provider, provider)));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get latest integration for provider (admin/fallback use)
   */
  static async getLatestByProvider(provider: string): Promise<Integration | null> {
    const result = await db
      .select()
      .from(integrations)
      .where(eq(integrations.provider, provider))
      .orderBy(desc(integrations.updatedAt))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Update integration (partial update)
   */
  static async update(
    id: string,
    data: Partial<IntegrationInsert>
  ): Promise<Integration> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(integrations)
      .set({
        ...data,
        updatedAt: now,
      })
      .where(eq(integrations.id, id))
      .returning();

    return result;
  }

  /**
   * Update integration health status
   */
  static async updateHealth(
    id: string,
    healthStatus: string,
    healthErrorMessage: string | null = null
  ): Promise<Integration> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(integrations)
      .set({
        healthStatus,
        healthErrorMessage,
        lastHealthCheck: now,
        updatedAt: now,
      })
      .where(eq(integrations.id, id))
      .returning();

    return result;
  }

  /**
   * Update tokens and reset health to healthy
   */
  static async updateTokens(
    id: string,
    accessToken: string,
    tokenExpiresAt: string
  ): Promise<Integration> {
    const now = new Date().toISOString();

    const [result] = await db
      .update(integrations)
      .set({
        accessToken,
        tokenExpiresAt,
        healthStatus: 'healthy',
        healthErrorMessage: null,
        lastHealthCheck: now,
        updatedAt: now,
      })
      .where(eq(integrations.id, id))
      .returning();

    return result;
  }
}
