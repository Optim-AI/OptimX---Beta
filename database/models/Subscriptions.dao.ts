// database/models/Subscriptions.dao.ts
import { db } from '../client';
import { subscriptions, plans } from '@/database/schema';
import { eq, and, or, lte, inArray, getTableColumns } from 'drizzle-orm';

// Type inference from Drizzle schema
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export interface SubscriptionWithPlan extends Subscription {
  plan: typeof plans.$inferSelect;
}

/**
 * Data Access Object for Subscriptions operations
 */
export class SubscriptionsDAO {
  /**
   * Create a new subscription
   */
  static async create(data: NewSubscription): Promise<Subscription> {
    const [result] = await db
      .insert(subscriptions)
      .values(data)
      .returning();
    return result;
  }

  /**
   * Get subscription by ID
   */
  static async getById(id: string): Promise<Subscription | null> {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Get active subscription for a user
   */
  static async getActiveByUserId(userId: string): Promise<SubscriptionWithPlan | null> {
    const result = await db
      .select({
        ...getTableColumns(subscriptions),
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.userId, userId),
          or(
            eq(subscriptions.status, 'active'),
            eq(subscriptions.status, 'trialing')
          )
        )
      )
      .limit(1);

    if (!result[0]) return null;

    const { plan, ...subscriptionData } = result[0];
    return {
      ...subscriptionData,
      plan,
    };
  }

  /**
   * Open subscription for a user: active, trialing, pending checkout, or past_due.
   * Used to prevent duplicate subscription creates before payment completes.
   */
  static async getOpenByUserId(userId: string): Promise<SubscriptionWithPlan | null> {
    const result = await db
      .select({
        ...getTableColumns(subscriptions),
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.userId, userId),
          inArray(subscriptions.status, ['active', 'trialing', 'pending', 'past_due'])
        )
      )
      .limit(1);

    if (!result[0]) return null;

    const { plan, ...subscriptionData } = result[0];
    return {
      ...subscriptionData,
      plan,
    };
  }

  /**
   * Get subscription by Razorpay subscription ID
   */
  static async getByRazorpayId(razorpaySubscriptionId: string): Promise<Subscription | null> {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.razorpaySubscriptionId, razorpaySubscriptionId))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Update subscription status
   */
  static async updateStatus(id: string, status: string): Promise<Subscription | null> {
    const now = new Date().toISOString();
    const [updated] = await db
      .update(subscriptions)
      .set({ 
        status, 
        updatedAt: now,
        ...(status === 'cancelled' || status === 'expired'
          ? { cancelledAt: now, cancelAtPeriodEnd: false }
          : {}),
      })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Schedule cancellation at period end. Keeps status active/past_due/trialing.
   * Does NOT zero credits.
   */
  static async scheduleCancelAtPeriodEnd(id: string): Promise<Subscription | null> {
    const now = new Date().toISOString();
    const [updated] = await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        cancelledAt: now, // request timestamp; access remains until current_period_end
        updatedAt: now,
      })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Mark subscription past_due (payment failure / halted). No cycle grant.
   */
  static async markPastDue(id: string): Promise<Subscription | null> {
    const [updated] = await db
      .update(subscriptions)
      .set({
        status: 'past_due',
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(subscriptions.id, id),
          inArray(subscriptions.status, ['active', 'pending', 'past_due', 'trialing'])
        )
      )
      .returning();
    return updated || null;
  }

  /**
   * Subscriptions scheduled to cancel whose period has ended (webhook safety net).
   */
  static async getDueForPeriodEndCancel(asOf: Date = new Date()): Promise<Subscription[]> {
    return db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.cancelAtPeriodEnd, true),
          inArray(subscriptions.status, ['active', 'past_due', 'trialing']),
          lte(subscriptions.currentPeriodEnd, asOf.toISOString())
        )
      );
  }

  /**
   * Update Razorpay subscription ID
   */
  static async updateRazorpayIds(
    id: string, 
    razorpaySubscriptionId: string, 
    razorpayCustomerId?: string
  ): Promise<Subscription | null> {
    const [updated] = await db
      .update(subscriptions)
      .set({ 
        razorpaySubscriptionId,
        ...(razorpayCustomerId ? { razorpayCustomerId } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Activate subscription (pending/trialing → active). Idempotent if already active.
   */
  static async activate(id: string): Promise<Subscription | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    if (existing.status === 'active') return existing;

    const [updated] = await db
      .update(subscriptions)
      .set({ 
        status: 'active',
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(subscriptions.id, id),
          inArray(subscriptions.status, ['pending', 'trialing', 'past_due'])
        )
      )
      .returning();
    return updated || existing;
  }

  /**
   * Get subscriptions due for credit reset
   */
  static async getDueForReset(asOf: Date = new Date()): Promise<SubscriptionWithPlan[]> {
    const result = await db
      .select({
        ...getTableColumns(subscriptions),
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          or(
            eq(subscriptions.status, 'active'),
            eq(subscriptions.status, 'trialing')
          ),
          lte(subscriptions.nextResetDate, asOf.toISOString())
        )
      );

    return result.map(r => {
      const { plan, ...subscriptionData } = r;
      return {
        ...subscriptionData,
        plan,
      };
    });
  }

  /**
   * Update next reset date after credit reset
   */
  static async updateNextResetDate(id: string, nextResetDate: Date): Promise<Subscription | null> {
    const [updated] = await db
      .update(subscriptions)
      .set({ 
        nextResetDate: nextResetDate.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Get expired trials
   */
  static async getExpiredTrials(asOf: Date = new Date()): Promise<Subscription[]> {
    return db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'trialing'),
          lte(subscriptions.trialEndsAt, asOf.toISOString())
        )
      );
  }

  /**
   * Expire a trial subscription
   */
  static async expireTrial(id: string): Promise<Subscription | null> {
    const [updated] = await db
      .update(subscriptions)
      .set({ 
        status: 'expired',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Get all subscriptions for a user (history)
   */
  static async getAllByUserId(userId: string): Promise<SubscriptionWithPlan[]> {
    const result = await db
      .select({
        ...getTableColumns(subscriptions),
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.userId, userId))
      .orderBy(subscriptions.createdAt);

    return result.map(r => {
      const { plan, ...subscriptionData } = r;
      return {
        ...subscriptionData,
        plan,
      };
    });
  }

  /**
   * Update period dates (for renewal)
   */
  static async updatePeriod(
    id: string, 
    currentPeriodStart: Date, 
    currentPeriodEnd: Date
  ): Promise<Subscription | null> {
    const [updated] = await db
      .update(subscriptions)
      .set({ 
        currentPeriodStart: currentPeriodStart.toISOString(),
        currentPeriodEnd: currentPeriodEnd.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(subscriptions.id, id))
      .returning();
    return updated || null;
  }

  /**
   * Update plan (for upgrades/downgrades)
   */
  static async updatePlan(
    id: string,
    newPlanId: string,
    razorpaySubscriptionId: string | null,
    currentPeriodStart: Date,
    currentPeriodEnd: Date
  ): Promise<Subscription | null> {
    const updateData: any = {
      planId: newPlanId,
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (razorpaySubscriptionId) {
      updateData.razorpaySubscriptionId = razorpaySubscriptionId;
    }

    const [updated] = await db
      .update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, id))
      .returning();
    return updated || null;
  }
}
