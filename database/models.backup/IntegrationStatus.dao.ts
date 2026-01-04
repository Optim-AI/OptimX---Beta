// lib/db/models/IntegrationStatus.dao.ts
import { db } from '../client';
import { integrationStatus } from '@/database/schema';
import { eq, asc } from 'drizzle-orm';

// Type inference from Drizzle schema
type IntegrationStatus = typeof integrationStatus.$inferSelect;

/**
 * Data Access Object for Integration Status operations
 * Manages global integration provider flags
 */
export class IntegrationStatusDAO {
  /**
   * Set integration status for a provider
   */
  static async setStatus(provider: string, isActive: boolean): Promise<IntegrationStatus> {
    const now = new Date().toISOString();

    const [result] = await db
      .insert(integrationStatus)
      .values({
        provider,
        isActive,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: integrationStatus.provider,
        set: {
          isActive,
          updatedAt: now,
        },
      })
      .returning();

    return result;
  }

  /**
   * Get integration status for a provider
   */
  static async getStatus(provider: string): Promise<boolean> {
    const result = await db
      .select()
      .from(integrationStatus)
      .where(eq(integrationStatus.provider, provider))
      .limit(1);

    return result[0]?.isActive || false;
  }

  /**
   * Get all integration statuses
   */
  static async getAllStatuses(): Promise<IntegrationStatus[]> {
    return db
      .select()
      .from(integrationStatus)
      .orderBy(asc(integrationStatus.provider));
  }

  /**
   * Initialize default statuses
   */
  static async initializeDefaults(): Promise<void> {
    const providers = ['meta', 'google', 'twitter', 'whatsapp', 'linkedin'];
    const now = new Date().toISOString();

    for (const provider of providers) {
      await db
        .insert(integrationStatus)
        .values({
          provider,
          isActive: false,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: integrationStatus.provider });
    }
  }

  /**
   * Delete integration status
   */
  static async delete(provider: string): Promise<boolean> {
    try {
      await db
        .delete(integrationStatus)
        .where(eq(integrationStatus.provider, provider));
      return true;
    } catch {
      return false;
    }
  }
}
