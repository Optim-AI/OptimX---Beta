// database/models/Plans.dao.ts
import { db } from '../client';
import { plans, planFeatureFlags, featureKeys } from '@/database/schema';
import { eq, and, asc } from 'drizzle-orm';

// Type inference from Drizzle schema
export type Plan = typeof plans.$inferSelect;
export type FeatureKey = typeof featureKeys.$inferSelect;
export type PlanFeatureFlag = typeof planFeatureFlags.$inferSelect;

export interface PlanWithFeatures extends Plan {
  features: {
    [key: string]: {
      enabled: boolean;
      comingSoon: boolean;
    };
  };
}

/**
 * Data Access Object for Plans operations
 */
export class PlansDAO {
  /**
   * Get all active plans
   */
  static async getAll(): Promise<Plan[]> {
    return db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(asc(plans.displayOrder));
  }

  /**
   * Get plan by ID
   */
  static async getById(planId: string): Promise<Plan | null> {
    const result = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Get plan by slug
   */
  static async getBySlug(slug: string): Promise<Plan | null> {
    const result = await db
      .select()
      .from(plans)
      .where(eq(plans.slug, slug))
      .limit(1);
    return result[0] || null;
  }

  /**
   * Get plan with all feature flags
   */
  static async getWithFeatures(planId: string): Promise<PlanWithFeatures | null> {
    const plan = await this.getById(planId);
    if (!plan) return null;

    const flags = await db
      .select()
      .from(planFeatureFlags)
      .where(eq(planFeatureFlags.planId, planId));

    const features: PlanWithFeatures['features'] = {};
    for (const flag of flags) {
      features[flag.featureKey] = {
        enabled: flag.isEnabled,
        comingSoon: flag.isComingSoon,
      };
    }

    return { ...plan, features };
  }

  /**
   * Get all feature keys
   */
  static async getAllFeatureKeys(): Promise<FeatureKey[]> {
    return db.select().from(featureKeys);
  }

  /**
   * Check if a feature is enabled for a plan
   */
  static async isFeatureEnabled(planId: string, featureKeyId: string): Promise<{ enabled: boolean; comingSoon: boolean }> {
    const result = await db
      .select()
      .from(planFeatureFlags)
      .where(
        and(
          eq(planFeatureFlags.planId, planId),
          eq(planFeatureFlags.featureKey, featureKeyId)
        )
      )
      .limit(1);

    if (!result[0]) {
      return { enabled: false, comingSoon: false };
    }

    return {
      enabled: result[0].isEnabled,
      comingSoon: result[0].isComingSoon,
    };
  }

  /**
   * Get all feature flags for a plan
   */
  static async getFeatureFlags(planId: string): Promise<Record<string, { enabled: boolean; comingSoon: boolean }>> {
    const flags = await db
      .select()
      .from(planFeatureFlags)
      .where(eq(planFeatureFlags.planId, planId));

    const result: Record<string, { enabled: boolean; comingSoon: boolean }> = {};
    for (const flag of flags) {
      result[flag.featureKey] = {
        enabled: flag.isEnabled,
        comingSoon: flag.isComingSoon,
      };
    }
    return result;
  }

  /**
   * Get grouped plans (for pricing page display)
   * Groups monthly and quarterly variants together
   */
  static async getGroupedPlans(): Promise<{
    name: string;
    monthly: Plan | null;
    quarterly: Plan | null;
  }[]> {
    const allPlans = await this.getAll();
    
    const groups: Map<string, { monthly: Plan | null; quarterly: Plan | null }> = new Map();
    
    for (const plan of allPlans) {
      if (plan.billingCycle === 'trial') continue; // Skip trial in grouped view
      
      const baseName = plan.name;
      if (!groups.has(baseName)) {
        groups.set(baseName, { monthly: null, quarterly: null });
      }
      
      const group = groups.get(baseName)!;
      if (plan.billingCycle === 'monthly') {
        group.monthly = plan;
      } else if (plan.billingCycle === 'quarterly') {
        group.quarterly = plan;
      }
    }

    return Array.from(groups.entries()).map(([name, plans]) => ({
      name,
      ...plans,
    }));
  }

  /**
   * Update Razorpay plan ID
   */
  static async updateRazorpayPlanId(planId: string, razorpayPlanId: string): Promise<Plan | null> {
    const [updated] = await db
      .update(plans)
      .set({ razorpayPlanId, updatedAt: new Date().toISOString() })
      .where(eq(plans.id, planId))
      .returning();
    return updated || null;
  }

  /**
   * Check if any active plans exist
   * Used to determine if plan selection should be shown
   */
  static async hasActivePlans(): Promise<boolean> {
    const activePlans = await db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .limit(1);
    return activePlans.length > 0;
  }

  /**
   * Toggle all plans on/off
   * Admin utility for enabling/disabling the entire plan system
   */
  static async toggleAllPlans(isActive: boolean): Promise<number> {
    const result = await db
      .update(plans)
      .set({ isActive, updatedAt: new Date().toISOString() })
      .returning();
    return result.length;
  }

  /**
   * Toggle a specific plan on/off
   */
  static async togglePlan(planId: string, isActive: boolean): Promise<Plan | null> {
    const [updated] = await db
      .update(plans)
      .set({ isActive, updatedAt: new Date().toISOString() })
      .where(eq(plans.id, planId))
      .returning();
    return updated || null;
  }

  /**
   * Update plan details
   */
  static async updatePlan(planId: string, data: {
    name?: string;
    description?: string;
    priceInr?: number;
    imageCredits?: number;
    videoCredits?: number;
    displayOrder?: number;
  }): Promise<Plan | null> {
    const [updated] = await db
      .update(plans)
      .set({
        ...data,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(plans.id, planId))
      .returning();
    return updated || null;
  }
}
