// database/models/Credits.dao.ts
import { db } from '../client';
import { userCredits, creditHistory } from '@/database/schema';
import { eq } from 'drizzle-orm';

// Type inference from Drizzle schema
type UserCredits = typeof userCredits.$inferSelect;
type CreditHistory = typeof creditHistory.$inferSelect;

export interface CreditBalance {
  imageCredits: {
    subscription: number;
    addon: number;
    total: number;
  };
  videoCredits: {
    subscription: number;
    addon: number;
    total: number;
  };
  lastResetAt: string | null;
}

/**
 * Data Access Object for Credits operations
 * Note: In production, user_credits.id IS the user_id (references auth.users.id)
 */
export class CreditsDAO {
  /**
   * Get full credit balance for a user
   */
  static async getFullBalance(userId: string): Promise<CreditBalance | null> {
    const result = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.id, userId))
      .limit(1);

    if (!result[0]) return null;

    const record = result[0];
    return {
      imageCredits: {
        subscription: record.imageCreditsSubscription,
        addon: record.imageCreditsAddon,
        total: record.imageCreditsSubscription + record.imageCreditsAddon,
      },
      videoCredits: {
        subscription: record.videoCreditsSubscription,
        addon: record.videoCreditsAddon,
        total: record.videoCreditsSubscription + record.videoCreditsAddon,
      },
      lastResetAt: record.lastResetAt,
    };
  }

  /**
   * Deduct image credits (subscription first, then addon)
   */
  static async deductImageCredits(
    userId: string,
    amount: number = 1
  ): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    try {
      const result = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.id, userId))
        .limit(1);

      if (!result[0]) {
        return { success: false, error: 'User credits not found' };
      }

      const record = result[0];
      const totalAvailable = record.imageCreditsSubscription + record.imageCreditsAddon;

      if (totalAvailable < amount) {
        return { success: false, error: 'Insufficient image credits' };
      }

      // Deduct from subscription first, then addon
      let newSubscription = record.imageCreditsSubscription;
      let newAddon = record.imageCreditsAddon;
      let remaining = amount;

      if (newSubscription >= remaining) {
        newSubscription -= remaining;
        remaining = 0;
      } else {
        remaining -= newSubscription;
        newSubscription = 0;
        newAddon -= remaining;
      }

      const now = new Date().toISOString();
      const [updated] = await db
        .update(userCredits)
        .set({
          imageCreditsSubscription: newSubscription,
          imageCreditsAddon: newAddon,
          updatedAt: now,
        })
        .where(eq(userCredits.id, userId))
        .returning();

      // Log to credit history
      await this.logCreditChange(userId, 'image', -amount, 'deduct', 'image_generation', newSubscription + newAddon);

      return {
        success: true,
        balance: {
          imageCredits: {
            subscription: updated.imageCreditsSubscription,
            addon: updated.imageCreditsAddon,
            total: updated.imageCreditsSubscription + updated.imageCreditsAddon,
          },
          videoCredits: {
            subscription: updated.videoCreditsSubscription,
            addon: updated.videoCreditsAddon,
            total: updated.videoCreditsSubscription + updated.videoCreditsAddon,
          },
          lastResetAt: updated.lastResetAt,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to deduct image credits' };
    }
  }

  /**
   * Deduct video credits (subscription first, then addon)
   */
  static async deductVideoCredits(
    userId: string,
    seconds: number
  ): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    try {
      const result = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.id, userId))
        .limit(1);

      if (!result[0]) {
        return { success: false, error: 'User credits not found' };
      }

      const record = result[0];
      const totalAvailable = record.videoCreditsSubscription + record.videoCreditsAddon;

      if (totalAvailable < seconds) {
        return { success: false, error: 'Insufficient video credits' };
      }

      // Deduct from subscription first, then addon
      let newSubscription = record.videoCreditsSubscription;
      let newAddon = record.videoCreditsAddon;
      let remaining = seconds;

      if (newSubscription >= remaining) {
        newSubscription -= remaining;
        remaining = 0;
      } else {
        remaining -= newSubscription;
        newSubscription = 0;
        newAddon -= remaining;
      }

      const now = new Date().toISOString();
      const [updated] = await db
        .update(userCredits)
        .set({
          videoCreditsSubscription: newSubscription,
          videoCreditsAddon: newAddon,
          updatedAt: now,
        })
        .where(eq(userCredits.id, userId))
        .returning();

      // Log to credit history
      await this.logCreditChange(userId, 'video', -seconds, 'deduct', 'video_generation', newSubscription + newAddon);

      return {
        success: true,
        balance: {
          imageCredits: {
            subscription: updated.imageCreditsSubscription,
            addon: updated.imageCreditsAddon,
            total: updated.imageCreditsSubscription + updated.imageCreditsAddon,
          },
          videoCredits: {
            subscription: updated.videoCreditsSubscription,
            addon: updated.videoCreditsAddon,
            total: updated.videoCreditsSubscription + updated.videoCreditsAddon,
          },
          lastResetAt: updated.lastResetAt,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to deduct video credits' };
    }
  }

  /**
   * Add addon image credits (from purchase)
   */
  static async addImageCreditsAddon(userId: string, amount: number): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    try {
      const result = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.id, userId))
        .limit(1);

      if (!result[0]) {
        return { success: false, error: 'User credits not found' };
      }

      const now = new Date().toISOString();
      const newAddon = result[0].imageCreditsAddon + amount;

      const [updated] = await db
        .update(userCredits)
        .set({
          imageCreditsAddon: newAddon,
          updatedAt: now,
        })
        .where(eq(userCredits.id, userId))
        .returning();

      // Log to credit history
      await this.logCreditChange(userId, 'image', amount, 'add', 'addon_purchase', updated.imageCreditsSubscription + newAddon);

      return {
        success: true,
        balance: {
          imageCredits: {
            subscription: updated.imageCreditsSubscription,
            addon: updated.imageCreditsAddon,
            total: updated.imageCreditsSubscription + updated.imageCreditsAddon,
          },
          videoCredits: {
            subscription: updated.videoCreditsSubscription,
            addon: updated.videoCreditsAddon,
            total: updated.videoCreditsSubscription + updated.videoCreditsAddon,
          },
          lastResetAt: updated.lastResetAt,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to add image credits' };
    }
  }

  /**
   * Add addon video credits (from purchase)
   */
  static async addVideoCreditsAddon(userId: string, seconds: number): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    try {
      const result = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.id, userId))
        .limit(1);

      if (!result[0]) {
        return { success: false, error: 'User credits not found' };
      }

      const now = new Date().toISOString();
      const newAddon = result[0].videoCreditsAddon + seconds;

      const [updated] = await db
        .update(userCredits)
        .set({
          videoCreditsAddon: newAddon,
          updatedAt: now,
        })
        .where(eq(userCredits.id, userId))
        .returning();

      // Log to credit history
      await this.logCreditChange(userId, 'video', seconds, 'add', 'addon_purchase', updated.videoCreditsSubscription + newAddon);

      return {
        success: true,
        balance: {
          imageCredits: {
            subscription: updated.imageCreditsSubscription,
            addon: updated.imageCreditsAddon,
            total: updated.imageCreditsSubscription + updated.imageCreditsAddon,
          },
          videoCredits: {
            subscription: updated.videoCreditsSubscription,
            addon: updated.videoCreditsAddon,
            total: updated.videoCreditsSubscription + updated.videoCreditsAddon,
          },
          lastResetAt: updated.lastResetAt,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to add video credits' };
    }
  }

  /**
   * Reset subscription credits (monthly reset)
   */
  static async resetSubscriptionCredits(
    userId: string,
    imageCredits: number,
    videoCredits: number
  ): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    try {
      const now = new Date().toISOString();

      const [updated] = await db
        .update(userCredits)
        .set({
          imageCreditsSubscription: imageCredits,
          videoCreditsSubscription: videoCredits,
          lastResetAt: now,
          updatedAt: now,
        })
        .where(eq(userCredits.id, userId))
        .returning();

      if (!updated) {
        return { success: false, error: 'User credits not found' };
      }

      // Log to credit history
      await this.logCreditChange(userId, 'image', imageCredits, 'reset', 'subscription_reset', imageCredits + updated.imageCreditsAddon);
      await this.logCreditChange(userId, 'video', videoCredits, 'reset', 'subscription_reset', videoCredits + updated.videoCreditsAddon);

      return {
        success: true,
        balance: {
          imageCredits: {
            subscription: updated.imageCreditsSubscription,
            addon: updated.imageCreditsAddon,
            total: updated.imageCreditsSubscription + updated.imageCreditsAddon,
          },
          videoCredits: {
            subscription: updated.videoCreditsSubscription,
            addon: updated.videoCreditsAddon,
            total: updated.videoCreditsSubscription + updated.videoCreditsAddon,
          },
          lastResetAt: updated.lastResetAt,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to reset credits' };
    }
  }

  /**
   * Initialize credits for new subscription
   */
  static async initializeCredits(
    userId: string,
    imageCredits: number,
    videoCredits: number
  ): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    try {
      const now = new Date().toISOString();

      // Try to update first (user_credits record created by trigger)
      const [updated] = await db
        .update(userCredits)
        .set({
          imageCreditsSubscription: imageCredits,
          videoCreditsSubscription: videoCredits,
          lastResetAt: now,
          updatedAt: now,
        })
        .where(eq(userCredits.id, userId))
        .returning();

      if (!updated) {
        // Create if doesn't exist
        const [created] = await db
          .insert(userCredits)
          .values({
            id: userId,
            credits: 0,
            imageCreditsSubscription: imageCredits,
            imageCreditsAddon: 0,
            videoCreditsSubscription: videoCredits,
            videoCreditsAddon: 0,
            lastResetAt: now,
            updatedAt: now,
          })
          .returning();

        return {
          success: true,
          balance: {
            imageCredits: { subscription: imageCredits, addon: 0, total: imageCredits },
            videoCredits: { subscription: videoCredits, addon: 0, total: videoCredits },
            lastResetAt: now,
          },
        };
      }

      // Log to credit history
      await this.logCreditChange(userId, 'image', imageCredits, 'add', 'subscription_init', imageCredits);
      await this.logCreditChange(userId, 'video', videoCredits, 'add', 'subscription_init', videoCredits);

      return {
        success: true,
        balance: {
          imageCredits: {
            subscription: updated.imageCreditsSubscription,
            addon: updated.imageCreditsAddon,
            total: updated.imageCreditsSubscription + updated.imageCreditsAddon,
          },
          videoCredits: {
            subscription: updated.videoCreditsSubscription,
            addon: updated.videoCreditsAddon,
            total: updated.videoCreditsSubscription + updated.videoCreditsAddon,
          },
          lastResetAt: updated.lastResetAt,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to initialize credits' };
    }
  }

  /**
   * Expire all credits (trial end)
   */
  static async expireAllCredits(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();

      await db
        .update(userCredits)
        .set({
          imageCreditsSubscription: 0,
          videoCreditsSubscription: 0,
          updatedAt: now,
        })
        .where(eq(userCredits.id, userId));

      // Log to credit history
      await this.logCreditChange(userId, 'image', 0, 'expire', 'trial_end', 0);
      await this.logCreditChange(userId, 'video', 0, 'expire', 'trial_end', 0);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to expire credits' };
    }
  }

  /**
   * Log credit change to history
   */
  private static async logCreditChange(
    userId: string,
    creditType: 'image' | 'video',
    amount: number,
    operation: 'add' | 'deduct' | 'reset' | 'expire',
    source: string,
    balanceAfter: number,
    metadata?: any
  ): Promise<void> {
    await db.insert(creditHistory).values({
      userId,
      creditType,
      amount,
      operation,
      source,
      balanceAfter,
      metadata,
    });
  }

  /**
   * Get credit history for a user
   */
  static async getHistory(userId: string, limit: number = 50): Promise<CreditHistory[]> {
    return db
      .select()
      .from(creditHistory)
      .where(eq(creditHistory.userId, userId))
      .orderBy(creditHistory.createdAt)
      .limit(limit);
  }

  // ============================================================
  // LEGACY METHODS (for backward compatibility)
  // ============================================================

  /**
   * @deprecated Use deductImageCredits or deductVideoCredits instead
   */
  static async deduct(
    userId: string,
    amount: number = 1
  ): Promise<{ success: boolean; newCredits?: number; error?: string }> {
    const result = await this.deductImageCredits(userId, amount);
    return {
      success: result.success,
      newCredits: result.balance?.imageCredits.total,
      error: result.error,
    };
  }

  /**
   * @deprecated Use addImageCreditsAddon or addVideoCreditsAddon instead
   */
  static async add(
    userId: string,
    amount: number
  ): Promise<{ success: boolean; newCredits?: number; error?: string }> {
    const result = await this.addImageCreditsAddon(userId, amount);
    return {
      success: result.success,
      newCredits: result.balance?.imageCredits.total,
      error: result.error,
    };
  }

  /**
   * @deprecated Use getFullBalance instead
   */
  static async getBalance(
    userId: string
  ): Promise<{ success: boolean; credits?: number; error?: string }> {
    const balance = await this.getFullBalance(userId);
    if (!balance) {
      return { success: false, error: 'User credits not found' };
    }
    return { success: true, credits: balance.imageCredits.total };
  }
}
