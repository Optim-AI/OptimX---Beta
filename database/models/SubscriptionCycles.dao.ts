// database/models/SubscriptionCycles.dao.ts
import { db } from '../client';
import { subscriptionCycles } from '@/database/schema';
import { eq } from 'drizzle-orm';

export type SubscriptionCycle = typeof subscriptionCycles.$inferSelect;
export type NewSubscriptionCycle = typeof subscriptionCycles.$inferInsert;

export class SubscriptionCyclesDAO {
  static async getByIdempotencyKey(key: string): Promise<SubscriptionCycle | null> {
    const rows = await db
      .select()
      .from(subscriptionCycles)
      .where(eq(subscriptionCycles.idempotencyKey, key))
      .limit(1);
    return rows[0] || null;
  }

  static async getByRazorpayPaymentId(
    razorpayPaymentId: string
  ): Promise<SubscriptionCycle | null> {
    const rows = await db
      .select()
      .from(subscriptionCycles)
      .where(eq(subscriptionCycles.razorpayPaymentId, razorpayPaymentId))
      .limit(1);
    return rows[0] || null;
  }
}
