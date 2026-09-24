// lib/razorpay/subscription.service.ts
// Service for managing subscriptions via Razorpay

import { razorpay, RAZORPAY_KEY_ID } from './client';
import { PlansDAO } from '@/database/models/Plans.dao';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { isCanonicalSubscriptionPlanId } from '@/lib/billing/canonical-plans';
import { subscriptionTotalsInr } from '@/lib/billing/marketing-plans';

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
  key?: string;
  error?: string;
}

interface CancelSubscriptionResult {
  success: boolean;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string;
  error?: string;
}

export class SubscriptionService {
  /**
   * Create a new subscription for a user.
   * Credits are NEVER granted here — only after successful subscription.charged.
   */
  static async createSubscription(params: CreateSubscriptionParams): Promise<CreateSubscriptionResult> {
    const { userId, email, planId, contact } = params;

    try {
      const plan = await PlansDAO.getById(planId);
      if (!plan) {
        return { success: false, error: 'Plan not found' };
      }

      // No free trial product — reject trial billing cycle
      if (plan.billingCycle === 'trial') {
        return {
          success: false,
          error: 'Free trial is not available. Please choose Starter, Growth, or Pro.',
        };
      }

      // Only active canonical SkalX plans may be sold
      if (!plan.isActive) {
        return { success: false, error: 'This plan is no longer available' };
      }

      if (!isCanonicalSubscriptionPlanId(plan.id)) {
        return {
          success: false,
          error: 'Invalid plan. Only SkalX Starter, Growth, and Pro are available.',
        };
      }

      // Resume or replace incomplete checkout; block only paid/open entitlements
      const existingSubscription = await SubscriptionsDAO.getOpenByUserId(userId);
      if (existingSubscription) {
        if (existingSubscription.status !== 'pending') {
          return {
            success: false,
            error: 'User already has an active subscription',
          };
        }

        // Always abandon pending checkouts and recreate so first-invoice
        // (full plan amount via upfront addon) stays consistent.
        await SubscriptionsDAO.updateStatus(existingSubscription.id, 'cancelled');
        if (existingSubscription.razorpaySubscriptionId) {
          try {
            await razorpay.subscriptions.cancel(
              existingSubscription.razorpaySubscriptionId,
              false
            );
          } catch (cancelErr) {
            console.warn(
              '[subscription] could not cancel prior Razorpay pending sub',
              cancelErr
            );
          }
        }
      }

      // Paid plans must already have a Razorpay plan_id (created manually in dashboard).
      // Do NOT auto-create Razorpay plans from application code.
      if (!plan.razorpayPlanId) {
        return {
          success: false,
          error:
            'Plan is missing razorpay_plan_id. Map the Razorpay plan in the database before checkout.',
        };
      }

      const now = new Date();
      const periodEnd = new Date(now);
      if (plan.billingCycle === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else if (plan.billingCycle === 'quarterly') {
        periodEnd.setMonth(periodEnd.getMonth() + 3);
      } else {
        return { success: false, error: 'Unsupported billing cycle' };
      }

      const nextReset = new Date(now);
      nextReset.setMonth(nextReset.getMonth() + 1);

      // Create local subscription as pending — NO credits until payment succeeds
      const subscription = await SubscriptionsDAO.create({
        userId,
        planId,
        status: 'pending',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        nextResetDate: nextReset.toISOString(),
        cancelAtPeriodEnd: false,
      });

      // Charge the full first month (incl. GST) as an upfront addon at auth time,
      // then start recurring billing on the next cycle so we do not double-charge.
      // (UPI Autopay otherwise shows only a ₹1–₹5 mandate setup amount.)
      const { totalInr } = subscriptionTotalsInr(plan.priceInr);
      const firstInvoicePaise = totalInr * 100;
      const billingCycles = plan.billingCycle === 'monthly' ? 12 : 4;
      const remainingCycles = Math.max(1, billingCycles - 1);
      const recurringStartAt = Math.floor(periodEnd.getTime() / 1000);

      let razorpaySubscription;
      try {
        razorpaySubscription = await razorpay.subscriptions.create({
          plan_id: plan.razorpayPlanId,
          total_count: remainingCycles,
          customer_notify: 1,
          start_at: recurringStartAt,
          addons: [
            {
              item: {
                name: `${plan.name} — first month (incl. GST)`,
                amount: firstInvoicePaise,
                currency: 'INR',
              },
            },
          ],
          notes: {
            user_id: userId,
            subscription_id: subscription.id,
            plan_name: plan.name,
            first_invoice_inr: String(totalInr),
          },
        });
      } catch (rpError: any) {
        // Avoid orphaning a pending row with no Razorpay id
        await SubscriptionsDAO.updateStatus(subscription.id, 'cancelled');
        throw rpError;
      }

      await SubscriptionsDAO.updateRazorpayIds(
        subscription.id,
        razorpaySubscription.id,
        razorpaySubscription.customer_id || undefined
      );

      // Intentionally do NOT grant subscription credits here.
      // Usable monthly credits must only appear after successful payment / cycle provisioning.

      return {
        success: true,
        subscriptionId: subscription.id,
        razorpaySubscriptionId: razorpaySubscription.id,
        shortUrl: razorpaySubscription.short_url,
        key: RAZORPAY_KEY_ID,
      };
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      const razorpayDescription =
        error?.error?.description ||
        error?.description ||
        error?.message;
      const isInvalidPlanId =
        typeof razorpayDescription === 'string' &&
        /invalid or could not be found/i.test(razorpayDescription);
      return {
        success: false,
        error: isInvalidPlanId
          ? `Razorpay plan ID is invalid for this account/mode. Map a valid TEST plan_id on the SkalX plan row. (${razorpayDescription})`
          : razorpayDescription || 'Failed to create subscription',
      };
    }
  }

  /**
   * Schedule cancellation at period end (Razorpay cancel_at_cycle_end).
   *
   * Razorpay Node SDK (v2.9.6):
   *   cancel(subscriptionId, cancelAtCycleEnd?: boolean | number)
   *   - false / 0 / omitted → cancel immediately
   *   - true / 1 → cancel at end of current billing cycle (sends cancel_at_cycle_end: 1)
   *
   * Does NOT zero credits or revoke access until period end / subscription.cancelled webhook.
   */
  static async cancelSubscription(subscriptionId: string): Promise<CancelSubscriptionResult> {
    try {
      const subscription = await SubscriptionsDAO.getById(subscriptionId);
      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      if (subscription.status === 'cancelled' || subscription.status === 'expired') {
        return { success: false, error: 'Subscription is already cancelled' };
      }

      if (subscription.cancelAtPeriodEnd) {
        return {
          success: true,
          cancelAtPeriodEnd: true,
          currentPeriodEnd: subscription.currentPeriodEnd,
        };
      }

      // Pending checkout (no active billing cycle): Razorpay rejects cancel_at_cycle_end.
      // Cancel immediately — user never received paid entitlement.
      if (subscription.status === 'pending') {
        if (subscription.razorpaySubscriptionId) {
          await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId, false);
        }
        await SubscriptionsDAO.updateStatus(subscriptionId, 'cancelled');
        return {
          success: true,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: subscription.currentPeriodEnd,
        };
      }

      // Active / past_due / legacy trialing with an active period → schedule at cycle end
      if (subscription.razorpaySubscriptionId) {
        // SDK: second arg true → cancel_at_cycle_end: 1
        await razorpay.subscriptions.cancel(subscription.razorpaySubscriptionId, true);
      }

      const updated = await SubscriptionsDAO.scheduleCancelAtPeriodEnd(subscriptionId);
      if (!updated) {
        return { success: false, error: 'Failed to persist cancel_at_period_end' };
      }

      return {
        success: true,
        cancelAtPeriodEnd: true,
        currentPeriodEnd: updated.currentPeriodEnd,
      };
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
      name: 'SkalX AI',
      description: 'Subscription Payment',
      prefill: {},
    };
  }
}
