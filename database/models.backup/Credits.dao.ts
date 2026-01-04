// lib/db/models/Credits.dao.ts
import { db } from '../client';
import { userCredits } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Type inference from Drizzle schema
type UserCredits = typeof userCredits.$inferSelect;

/**
 * Data Access Object for Credits operations
 */
export class CreditsDAO {
  /**
   * Deduct credits from user
   */
  static async deduct(
    userId: string,
    amount: number = 1
  ): Promise<{ success: boolean; newCredits?: number; error?: string }> {
    try {
      // Fetch current credits
      const result = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .limit(1);

      if (!result[0]) {
        return { success: false, error: 'User credits not found' };
      }

      const currentCredits = result[0].credits;

      if (currentCredits < amount) {
        return { success: false, error: 'Insufficient credits' };
      }

      const now = new Date().toISOString();

      // Deduct credits
      const [updated] = await db
        .update(userCredits)
        .set({
          credits: currentCredits - amount,
          updatedAt: now,
        })
        .where(eq(userCredits.userId, userId))
        .returning();

      return { success: true, newCredits: updated.credits };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to deduct credits' };
    }
  }

  /**
   * Add credits to user
   */
  static async add(
    userId: string,
    amount: number
  ): Promise<{ success: boolean; newCredits?: number; error?: string }> {
    try {
      if (amount <= 0) {
        return { success: false, error: 'Invalid credit amount' };
      }

      // Fetch current credits
      const result = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .limit(1);

      if (!result[0]) {
        return { success: false, error: 'User credits not found' };
      }

      const newBalance = result[0].credits + amount;
      const now = new Date().toISOString();

      // Add credits
      const [updated] = await db
        .update(userCredits)
        .set({
          credits: newBalance,
          updatedAt: now,
        })
        .where(eq(userCredits.userId, userId))
        .returning();

      return { success: true, newCredits: updated.credits };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to add credits' };
    }
  }

  /**
   * Get user credit balance
   */
  static async getBalance(
    userId: string
  ): Promise<{ success: boolean; credits?: number; error?: string }> {
    try {
      const result = await db
        .select()
        .from(userCredits)
        .where(eq(userCredits.userId, userId))
        .limit(1);

      if (!result[0]) {
        return { success: false, error: 'User credits not found' };
      }

      return { success: true, credits: result[0].credits };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Create or update user credits (upsert)
   */
  static async upsert(userId: string, credits: number): Promise<UserCredits> {
    const now = new Date().toISOString();

    const [result] = await db
      .insert(userCredits)
      .values({
        id: randomUUID(),
        userId,
        credits,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userCredits.userId,
        set: {
          credits,
          updatedAt: now,
        },
      })
      .returning();

    return result;
  }

  /**
   * Set credits to specific amount
   */
  static async set(userId: string, credits: number): Promise<UserCredits> {
    return this.upsert(userId, credits);
  }
}
