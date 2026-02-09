// lib/razorpay/subscription.service.ts
// Service for managing subscriptions via Razorpay

import { razorpay, RAZORPAY_KEY_ID } from './client';
import { PlansDAO } from '@/database/models/Plans.dao';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { CreditsDAO } from '@/database/models/Credits.dao';
import { PaymentsDAO } from '@/database/models/Payments.dao';

interface CreateSubscriptionParams {
  userId: string;
  email: string;
  planId: string;
  contact?: string;
}

interface CreateSubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  razorpaySubscriptionId?: string;
  shortUrl?: string;
  error?: string;
}

export class SubscriptionService {
  /**
   * Create a new subscription for a user
   */
  static async createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult> {
    const { userId, email, planId, contact } = params;

    try {
      // Get plan details
      const plan = await PlansDAO.getById(planId);
      if (!plan) {
        return { success: false, error: 'Plan not found' };
      }

      // Check if user already has active subscription
      const existingSubscription = await SubscriptionsDAO.getActiveByUserId(userId);
      if (existingSubscription) {
        return { success: false, error: 'User already has an active subscription' };
      }

      const now = new Date();
      let subscription;

      // Handle Free Trial separately (no Razorpay needed)
      if (plan.billingCycle === 'trial') {
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + 5); // 5 day trial

        subscription = await SubscriptionsDAO.create({
          userId,
          planId,
          status: 'trialing',
          currentPeriodStart: now.toISOString(),
          currentPeriodEnd: trialEnd.toISOString(),
          trialEndsAt: trialEnd.toISOString(),
          nextResetDate: trialEnd.toISOString(), // No reset for trial
        });

        // Initialize credits
        await CreditsDAO.initializeCredits(userId, plan.imageCredits, plan.videoCredits);

        return {
          success: true,
          subscriptionId: subscription.id,
        };
      }

      // For paid plans, check if Razorpay plan ID exists
      if (!plan.razorpayPlanId) {
        // Create Razorpay plan if not exists
        const razorpayPlan = await this.createRazorpayPlan(plan);
        if (!razorpayPlan.success) {
          return { success: false, error: razorpayPlan.error };
        }
        await PlansDAO.updateRazorpayPlanId(planId, razorpayPlan.planId!);
        plan.razorpayPlanId = razorpayPlan.planId!;
      }

      // Calculate period dates
      const periodEnd = new Date(now);
      if (plan.billingCycle === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else if (plan.billingCycle === 'quarterly') {
        periodEnd.setMonth(periodEnd.getMonth() + 3);
      }

      // Calculate next reset date (always 1 month from start)
      const nextReset = new Date(now);
      nextReset.setMonth(nextReset.getMonth() + 1);

      // Create local subscription record first (pending activation)
      subscription = await SubscriptionsDAO.create({
        userId,
        planId,
        status: 'active', // Will be confirmed via webhook
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        nextResetDate: nextReset.toISOString(),
      });

      // Create Razorpay subscription
      const razorpaySubscription = await razorpay.subscriptions.create({
        plan_id: plan.razorpayPlanId,
        total_count: plan.billingCycle === 'monthly' ? 12 : 4, // Max billing cycles
        customer_notify: 1,
        notes: {
          user_id: userId,
          subscription_id: subscription.id,
          plan_name: plan.name,
        },
      });

      // Update subscription with Razorpay ID
      await SubscriptionsDAO.updateRazorpayIds(
        subscription.id,
        razorpaySubscription.id,
        razorpaySubscription.customer_id
      );

      // Initialize credits immediately for paid plans
      await CreditsDAO.initializeCredits(userId, plan.imageCredits, plan.videoCredits);

      return {
        success: true,
        subscriptionId: subscription.id,
        razorpaySubscriptionId: razorpaySubscription.id,
        shortUrl: razorpaySubscription.short_url,
      };
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      return { success: false, error: error.message || 'Failed to create subscription' };
    }
  }

  /**
   * Create a Razorpay plan from our plan definition
   */
  private static async createRazorpayPlan(plan: any): Promise<{ success: boolean; planId?: string; error?: string }> {
    try {
      const interval = plan.billingCycle === 'monthly' ? 1 : 3;
      
      const razorpayPlan = await razorpay.plans.create({
        period: 'monthly',
        interval,
        item: {
          name: `${plan.name} - ${plan.billingCycle}`,
          amount: plan.priceInr * 100, // Razorpay uses paise
          currency: 'INR',
          description: plan.description || `${plan.name} subscription plan`,
        },
      });

      return { success: true, planId: razorpayPlan.id };
    } catch (error: any) {
      console.error('Error creating Razorpay plan:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel a subscription
   */
  static async cancelSubscription(subscriptionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const subscription = await SubscriptionsDAO.getById(subscriptionId);
      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      // Cancel on Razorpay if it's a paid subscription
      if (subscription.razorpaySubscriptionId) {
        await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId);
      }

      // Update local status
      await SubscriptionsDAO.updateStatus(subscriptionId, 'cancelled');

      return { success: true };
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get subscription details for checkout
   */
  static async getCheckoutData(subscriptionId: string): Promise<any> {
    const subscription = await SubscriptionsDAO.getById(subscriptionId);
    if (!subscription || !subscription.razorpaySubscriptionId) {
      return null;
    }

    return {
      key: RAZORPAY_KEY_ID,
      subscription_id: subscription.razorpaySubscriptionId,
      name: 'OptimX',
      description: 'Subscription Payment',
      prefill: {},
    };
  }
}
