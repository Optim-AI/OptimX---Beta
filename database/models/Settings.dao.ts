// lib/db/models/Settings.dao.ts
import { db } from '../client';
import { appSettings } from '@/database/schema';
import { eq, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Type inference from Drizzle schema
type AppSettings = typeof appSettings.$inferSelect;

/**
 * Data Access Object for App Settings operations
 * Handles both global settings and user-scoped settings
 */
export class SettingsDAO {
  /**
   * Get global setting by key
   */
  static async getSetting(key: string): Promise<any | null> {
    const result = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    return result[0]?.value || null;
  }

  /**
   * Set global setting
   */
  static async setSetting(key: string, value: any): Promise<AppSettings> {
    const now = new Date().toISOString();

    const [result] = await db
      .insert(appSettings)
      .values({
        key,
        value,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value,
          updatedAt: now,
        },
      })
      .returning();

    return result;
  }

  /**
   * Get user-scoped setting
   */
  static async getUserSetting(userId: string, settingKey: string): Promise<any | null> {
    const key = `${settingKey}_user:${userId}`;
    return this.getSetting(key);
  }

  /**
   * Set user-scoped setting
   */
  static async setUserSetting(
    userId: string,
    settingKey: string,
    value: any
  ): Promise<AppSettings> {
    const key = `${settingKey}_user:${userId}`;
    return this.setSetting(key, value);
  }

  /**
   * Get integration flags (global)
   */
  static async getIntegrationFlags(): Promise<Record<string, boolean>> {
    const key = 'integrations_flags';
    const flags = await this.getSetting(key);

    if (!flags) {
      // Initialize default flags
      const defaultFlags: Record<string, boolean> = {
        meta: false,
        'google-ads': false,
        whatsapp: false,
        linkedin: false,
        twitter: false,
      };
      await this.setSetting(key, defaultFlags);
      return defaultFlags;
    }

    return flags;
  }

  /**
   * Set integration flag (global)
   */
  static async setIntegrationFlag(
    platformId: string,
    connected: boolean
  ): Promise<void> {
    const current = await this.getIntegrationFlags();
    current[platformId] = connected;
    await this.setSetting('integrations_flags', current);
  }

  /**
   * Get user integration flags
   */
  static async getUserIntegrationFlags(
    userId: string
  ): Promise<Record<string, boolean>> {
    const flags = await this.getUserSetting(userId, 'integrations_flags');

    if (!flags) {
      // Initialize default flags for user
      const defaultFlags: Record<string, boolean> = {
        meta: false,
        'google-ads': false,
        whatsapp: false,
        linkedin: false,
        twitter: false,
      };
      await this.setUserSetting(userId, 'integrations_flags', defaultFlags);
      return defaultFlags;
    }

    return flags;
  }

  /**
   * Set user integration flag
   */
  static async setUserIntegrationFlag(
    userId: string,
    platformId: string,
    connected: boolean
  ): Promise<void> {
    const current = await this.getUserIntegrationFlags(userId);
    current[platformId] = connected;
    await this.setUserSetting(userId, 'integrations_flags', current);
  }

  /**
   * Delete setting
   */
  static async deleteSetting(key: string): Promise<boolean> {
    try {
      await db
        .delete(appSettings)
        .where(eq(appSettings.key, key));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all settings (admin use)
   */
  static async listAll(): Promise<AppSettings[]> {
    return db
      .select()
      .from(appSettings)
      .orderBy(asc(appSettings.key));
  }
}
