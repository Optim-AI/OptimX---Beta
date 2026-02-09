// lib/razorpay/webhook.service.ts
// Service for processing Razorpay webhooks

import { RAZORPAY_WEBHOOK_SECRET } from './client';
import { WebhookEventsDAO, PaymentsDAO } from '@/database/models/Payments.dao';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { CreditsDAO } from '@/database/models/Credits.dao';
import { PlansDAO } from '@/database/models/Plans.dao';

interface WebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: any;
  created_at: number;
}

export class WebhookService {
  /**
   * Verify webhook signature
   */
  static verifySignature(body: string, signature: string): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
      return expectedSignature === signature;
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Process webhook event
   */
  static async processWebhook(payload: WebhookPayload, eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check idempotency
      const exists = await WebhookEventsDAO.exists(eventId);
      if (exists) {
        console.log(`Webhook event ${eventId} already processed, skipping`);
        return { success: true };
      }

      // Create webhook event record
      const webhookEvent = await WebhookEventsDAO.create(eventId, payload.event, payload);

      try {
        // Process based on event type
        switch (payload.event) {
          case 'payment.captured':
            await this.handlePaymentCaptured(payload.payload);
            break;
          case 'subscription.activated':
            await this.handleSubscriptionActivated(payload.payload);
            break;
          case 'subscription.charged':
            await this.handleSubscriptionCharged(payload.payload);
            break;
          case 'subscription.cancelled':
            await this.handleSubscriptionCancelled(payload.payload);
            break;
          case 'subscription.completed':
            await this.handleSubscriptionCompleted(payload.payload);
            break;
          case 'payment.failed':
            await this.handlePaymentFailed(payload.payload);
            break;
          default:
            console.log(`Unhandled webhook event: ${payload.event}`);
        }

        // Mark as processed
        await WebhookEventsDAO.markProcessed(webhookEvent.id);
        return { success: true };
      } catch (processingError: any) {
        await WebhookEventsDAO.markFailed(webhookEvent.id, processingError.message);
        throw processingError;
      }
    } catch (error: any) {
      console.error('Error processing webhook:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle payment.captured event
   */
  private static async handlePaymentCaptured(payload: any): Promise<void> {
    const paymentEntity = payload.payment?.entity;
    if (!paymentEntity) return;

    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    // Find payment by order ID
    const payment = await PaymentsDAO.getByOrderId(orderId);
    if (!payment) {
      console.log(`Payment not found for order ${orderId}`);
      return;
    }

    // Skip if already captured
    if (payment.status === 'captured') return;

    // Update payment status
    await PaymentsDAO.updateStatus(payment.id, 'captured', paymentId);

    // Add credits for credit top-ups
    if (payment.paymentType === 'image_topup' || payment.paymentType === 'video_topup') {
      const metadata = payment.metadata as any;
      if (metadata?.creditType === 'image') {
        await CreditsDAO.addImageCreditsAddon(payment.userId, metadata.credits);
      } else if (metadata?.creditType === 'video') {
        await CreditsDAO.addVideoCreditsAddon(payment.userId, metadata.credits);
      }
    }
  }

  /**
   * Handle subscription.activated event
   */
  private static async handleSubscriptionActivated(payload: any): Promise<void> {
    const subscriptionEntity = payload.subscription?.entity;
    if (!subscriptionEntity) return;

    const razorpaySubscriptionId = subscriptionEntity.id;

    // Find subscription
    const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
    if (!subscription) {
      console.log(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
      return;
    }

    // Activate subscription
    await SubscriptionsDAO.activate(subscription.id);
  }

  /**
   * Handle subscription.charged event (renewal)
   */
  private static async handleSubscriptionCharged(payload: any): Promise<void> {
    const subscriptionEntity = payload.subscription?.entity;
    const paymentEntity = payload.payment?.entity;
    if (!subscriptionEntity) return;

    const razorpaySubscriptionId = subscriptionEntity.id;

    // Find subscription
    const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
    if (!subscription) {
      console.log(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
      return;
    }

    // Record payment
    if (paymentEntity) {
      await PaymentsDAO.create({
        userId: subscription.userId,
        subscriptionId: subscription.id,
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: paymentEntity.order_id,
        amount: paymentEntity.amount / 100,
        currency: paymentEntity.currency,
        status: 'captured',
        paymentType: 'subscription',
      });
    }

    // Update period dates
    const plan = await PlansDAO.getById(subscription.planId);
    if (plan) {
      const now = new Date();
      const periodEnd = new Date(now);
      if (plan.billingCycle === 'monthly') {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      } else if (plan.billingCycle === 'quarterly') {
        periodEnd.setMonth(periodEnd.getMonth() + 3);
      }
      await SubscriptionsDAO.updatePeriod(subscription.id, now, periodEnd);
    }
  }

  /**
   * Handle subscription.cancelled event
   */
  private static async handleSubscriptionCancelled(payload: any): Promise<void> {
    const subscriptionEntity = payload.subscription?.entity;
    if (!subscriptionEntity) return;

    const razorpaySubscriptionId = subscriptionEntity.id;

    // Find subscription
    const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
    if (!subscription) {
      console.log(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
      return;
    }

    // Update status
    await SubscriptionsDAO.updateStatus(subscription.id, 'cancelled');
  }

  /**
   * Handle subscription.completed event
   */
  private static async handleSubscriptionCompleted(payload: any): Promise<void> {
    const subscriptionEntity = payload.subscription?.entity;
    if (!subscriptionEntity) return;

    const razorpaySubscriptionId = subscriptionEntity.id;

    // Find subscription
    const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
    if (!subscription) {
      console.log(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
      return;
    }

    // Update status
    await SubscriptionsDAO.updateStatus(subscription.id, 'expired');
  }

  /**
   * Handle payment.failed event
   */
  private static async handlePaymentFailed(payload: any): Promise<void> {
    const paymentEntity = payload.payment?.entity;
    if (!paymentEntity) return;

    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    // Find payment by order ID
    const payment = await PaymentsDAO.getByOrderId(orderId);
    if (!payment) {
      console.log(`Payment not found for order ${orderId}`);
      return;
    }

    // Update payment status
    await PaymentsDAO.updateStatus(payment.id, 'failed', paymentId);
  }
}
