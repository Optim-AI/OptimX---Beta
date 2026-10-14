// lib/razorpay/webhook.service.ts
// Service for processing Razorpay webhooks.
// Credits for PAYG top-ups are granted exactly once via captureIfCreated + grantCreditsForCapturedPayment.
// Subscription entitlements are granted exactly once via provisionSubscriptionCycleForCharge.

import { RAZORPAY_WEBHOOK_SECRET } from './client';
import { WebhookEventsDAO, PaymentsDAO } from '@/database/models/Payments.dao';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { PlansDAO } from '@/database/models/Plans.dao';
import { grantCreditsForCapturedPayment } from './credit-grant';
import { provisionSubscriptionCycleForCharge } from '@/lib/billing/subscription-entitlement';
import { tryProvisionInitialSubscriptionFromCapturedPayment } from '@/lib/billing/initial-subscription-payment';
import {
  classifyInitialProvisionReason,
  type PaymentOutcomeKind,
} from '@/lib/billing/subscription-payment-outcome';

interface WebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: any;
  created_at: number;
  id?: string;
}

export type WebhookProcessResult = {
  success: boolean;
  /** When false, Razorpay should retry (HTTP 5xx). Permanent failures return success:true with permanentFailure. */
  retryable?: boolean;
  permanentFailure?: boolean;
  error?: string;
};

type HandlerOutcome = {
  kind: PaymentOutcomeKind;
  error?: string;
};

export class WebhookService {
  static verifySignature(body: string, signature: string): boolean {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
      if (expectedSignature.length !== signature.length) return false;
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(signature, 'hex')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Resolve a stable Razorpay event id for idempotency.
   * Prefer the official event id / header — never Date.now().
   */
  static resolveEventId(
    payload: WebhookPayload,
    headerEventId?: string | string[] | null
  ): string | null {
    const header =
      typeof headerEventId === 'string'
        ? headerEventId.trim()
        : Array.isArray(headerEventId)
          ? headerEventId[0]?.trim()
          : '';
    if (header) return header;
    if (payload.id && typeof payload.id === 'string' && payload.id.trim()) {
      return payload.id.trim();
    }
    const paymentId = payload.payload?.payment?.entity?.id;
    const subscriptionId = payload.payload?.subscription?.entity?.id;
    const entityId = paymentId || subscriptionId || payload.payload?.order?.entity?.id;
    if (payload.event && entityId) {
      return `${payload.event}:${entityId}`;
    }
    if (payload.event && payload.created_at) {
      return `${payload.event}:${payload.created_at}`;
    }
    return null;
  }

  static async processWebhook(
    payload: WebhookPayload,
    eventId: string
  ): Promise<WebhookProcessResult> {
    try {
      const existing = await WebhookEventsDAO.getByRazorpayId(eventId);
      if (existing?.status === 'processed') {
        console.log(`Webhook event ${eventId} already processed, skipping`);
        return { success: true };
      }
      // In-flight pending: another worker owns this delivery. Acknowledge to avoid
      // duplicate concurrent work; if that worker fails it will mark failed for retry.
      if (existing?.status === 'pending') {
        console.log(`Webhook event ${eventId} already pending, skipping`);
        return { success: true };
      }

      let webhookEvent;
      if (existing?.status === 'failed') {
        webhookEvent = await WebhookEventsDAO.reclaimFailed(
          existing.id,
          payload.event,
          payload
        );
        if (!webhookEvent) {
          return { success: true };
        }
      } else {
        try {
          webhookEvent = await WebhookEventsDAO.create(eventId, payload.event, payload);
        } catch (insertError: any) {
          if (
            insertError?.code === '23505' ||
            /unique|duplicate/i.test(String(insertError?.message || ''))
          ) {
            console.log(`Webhook event ${eventId} insert race, skipping`);
            return { success: true };
          }
          throw insertError;
        }
      }

      try {
        let outcome: HandlerOutcome = { kind: 'success' };

        switch (payload.event) {
          case 'payment.captured':
            outcome = await this.handlePaymentCaptured(payload.payload);
            break;
          case 'subscription.activated':
            await this.handleSubscriptionActivated(payload.payload);
            break;
          case 'subscription.charged':
            outcome = await this.handleSubscriptionCharged(payload.payload);
            break;
          case 'subscription.cancelled':
            await this.handleSubscriptionCancelled(payload.payload);
            break;
          case 'subscription.completed':
            await this.handleSubscriptionCompleted(payload.payload);
            break;
          case 'subscription.pending':
          case 'subscription.halted':
            await this.handleSubscriptionPastDue(payload.payload, payload.event);
            break;
          case 'payment.failed':
            await this.handlePaymentFailed(payload.payload);
            break;
          default:
            // Harmless / unsupported for entitlement (e.g. downtime, invoice.paid).
            console.log(`Unhandled webhook event (ignored): ${payload.event}`);
            outcome = { kind: 'ignored' };
        }

        if (outcome.kind === 'success' || outcome.kind === 'ignored') {
          await WebhookEventsDAO.markProcessed(webhookEvent.id);
          return { success: true };
        }

        const error =
          outcome.error ||
          `webhook_${payload.event}_${outcome.kind}`;
        await WebhookEventsDAO.markFailed(webhookEvent.id, error);

        if (outcome.kind === 'permanent') {
          // Acknowledge so Razorpay does not retry forever; row stays failed for ops.
          return {
            success: true,
            permanentFailure: true,
            error,
          };
        }

        // pending / retryable — ask Razorpay to retry
        return {
          success: false,
          retryable: true,
          error,
        };
      } catch (processingError: any) {
        await WebhookEventsDAO.markFailed(
          webhookEvent.id,
          processingError.message || 'processing_error'
        );
        throw processingError;
      }
    } catch (error: any) {
      console.error('Error processing webhook:', error);
      return { success: false, retryable: true, error: error.message };
    }
  }

  private static async handlePaymentCaptured(payload: any): Promise<HandlerOutcome> {
    const paymentEntity = payload.payment?.entity;
    if (!paymentEntity) {
      return { kind: 'ignored', error: 'missing_payment_entity' };
    }

    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    // 1) Existing PAYG path — local payments row created at order time
    const payment = orderId ? await PaymentsDAO.getByOrderId(orderId) : null;
    if (payment) {
      if (
        payment.paymentType !== 'image_topup' &&
        payment.paymentType !== 'video_topup'
      ) {
        console.log(
          `[webhook] payment.captured for order ${orderId} is paymentType=${payment.paymentType}; skipping PAYG grant`
        );
        // Subscription rows recorded under this order are handled via initial-sub path below
        // only when no PAYG row exists. A non-topup local row is an intentional no-op.
        return { kind: 'ignored', error: `payg_skip_${payment.paymentType}` };
      }

      const captured = await PaymentsDAO.captureIfCreated(payment.id, paymentId);
      if (!captured) {
        console.log(`Payment ${payment.id} already captured, skipping credit grant`);
        return { kind: 'success' };
      }

      await grantCreditsForCapturedPayment(captured);
      return { kind: 'success' };
    }

    // 2) Initial subscription first-month addon (payment.subscription_id is often null)
    const initial = await tryProvisionInitialSubscriptionFromCapturedPayment(paymentEntity);
    if (initial.handled) {
      console.log(
        `[webhook] payment.captured initial-sub provisioned=${initial.provisioned} created=${initial.created} ` +
          `cycle=${initial.cycleId} payment=${initial.razorpayPaymentId} sub=${initial.subscriptionId}`
      );
      return { kind: 'success' };
    }

    const kind = classifyInitialProvisionReason(initial.reason);
    console.log(
      `[webhook] payment.captured unclassified (no PAYG order, not initial-sub addon): ` +
        `order=${orderId || 'none'} payment=${paymentId || 'none'} reason=${initial.reason} kind=${kind}`
    );

    // No SkalX signal (no local order, no invoice, no subscription on payment) → ignore.
    if (!paymentEntity.invoice_id && !paymentEntity.subscription_id && !orderId) {
      return { kind: 'ignored', error: initial.reason };
    }

    // Captured subscription-like payments that failed classification must NOT be
    // marked processed — permanent stays failed for ops; retryable asks Razorpay again.
    if (kind === 'pending' || kind === 'retryable') {
      return { kind: 'retryable', error: initial.reason };
    }

    return { kind: 'permanent', error: initial.reason };
  }

  /**
   * subscription.activated — status only. NEVER grants credits.
   */
  private static async handleSubscriptionActivated(payload: any): Promise<void> {
    const subscriptionEntity = payload.subscription?.entity;
    if (!subscriptionEntity) return;

    const razorpaySubscriptionId = subscriptionEntity.id;
    const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
    if (!subscription) {
      console.log(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
      return;
    }

    await SubscriptionsDAO.activate(subscription.id);
  }

  private static async handleSubscriptionCharged(payload: any): Promise<HandlerOutcome> {
    const subscriptionEntity = payload.subscription?.entity;
    const paymentEntity = payload.payment?.entity;
    if (!subscriptionEntity) {
      return { kind: 'ignored', error: 'missing_subscription_entity' };
    }

    const razorpaySubscriptionId = subscriptionEntity.id;
    const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
    if (!subscription) {
      console.log(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
      // Local row may not exist yet — retry briefly rather than consuming the event.
      return { kind: 'retryable', error: 'local_subscription_not_found' };
    }

    // Do not provision if already fully cancelled/expired
    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      console.log(
        `[webhook] subscription.charged ignored for ${subscription.id} status=${subscription.status}`
      );
      return {
        kind: 'permanent',
        error: `subscription_status_${subscription.status}`,
      };
    }

    // If cancel_at_period_end is set, Razorpay should not renew — but if a charge
    // still arrives for the current cycle (first/current invoice), allow exactly once.
    // Future renewals should not occur after schedule.

    const razorpayPaymentId =
      typeof paymentEntity?.id === 'string' ? paymentEntity.id.trim() : '';

    if (!razorpayPaymentId) {
      console.error(
        `[webhook] subscription.charged for ${razorpaySubscriptionId} missing payment.id — skipping entitlement grant`
      );
      return { kind: 'retryable', error: 'missing_payment_id' };
    }

    await PaymentsDAO.createIfAbsentByRazorpayPaymentId({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      razorpayPaymentId,
      razorpayOrderId: paymentEntity?.order_id ?? null,
      amount: paymentEntity?.amount ? paymentEntity.amount / 100 : 0,
      currency: paymentEntity?.currency || 'INR',
      status: 'captured',
      paymentType: 'subscription',
    });

    const plan = await PlansDAO.getById(subscription.planId);
    if (!plan) {
      console.error(`[webhook] Plan ${subscription.planId} not found for subscription charge`);
      return { kind: 'permanent', error: 'plan_not_found' };
    }

    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (plan.billingCycle === 'quarterly') {
      periodEnd.setMonth(periodEnd.getMonth() + 3);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const result = await provisionSubscriptionCycleForCharge({
      subscriptionId: subscription.id,
      userId: subscription.userId,
      planId: subscription.planId,
      razorpayPaymentId,
      periodStart,
      periodEnd,
      metadata: {
        razorpaySubscriptionId,
        event: 'subscription.charged',
      },
    });

    console.log(
      `[webhook] subscription.charged provisioned=${result.creditsGranted} created=${result.created} cycle=${result.cycle.id} payment=${razorpayPaymentId}`
    );
    return { kind: 'success' };
  }

  /**
   * subscription.cancelled — cancellation is now effective.
   *
   * Distinguishes:
   * - Scheduled cancel request: we already set cancel_at_period_end locally; Razorpay
   *   keeps status active until cycle end, then fires this event with status=cancelled.
   * - Immediate cancel: status becomes cancelled immediately (pending checkout path).
   *
   * Never destroys addon credits.
   */
  private static async handleSubscriptionCancelled(payload: any): Promise<void> {
    const subscriptionEntity = payload.subscription?.entity;
    if (!subscriptionEntity) return;

    const razorpaySubscriptionId = subscriptionEntity.id;
    const razorpayStatus = subscriptionEntity.status;
    const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
    if (!subscription) {
      console.log(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
      return;
    }

    // If Razorpay still reports active, this is not an effective cancel (defensive).
    // Scheduled cancel_at_cycle_end does not fire cancelled until the end.
    if (razorpayStatus === 'active' || razorpayStatus === 'authenticated') {
      console.log(
        `[webhook] subscription.cancelled received but razorpay status=${razorpayStatus}; ` +
          `ensuring cancel_at_period_end without revoking access`
      );
      if (!subscription.cancelAtPeriodEnd) {
        await SubscriptionsDAO.scheduleCancelAtPeriodEnd(subscription.id);
      }
      return;
    }

    await SubscriptionsDAO.updateStatus(subscription.id, 'cancelled');
    console.log(
      `[webhook] subscription ${subscription.id} cancelled (was cancel_at_period_end=${subscription.cancelAtPeriodEnd})`
    );
  }

  private static async handleSubscriptionCompleted(payload: any): Promise<void> {
    const subscriptionEntity = payload.subscription?.entity;
    if (!subscriptionEntity) return;

    const razorpaySubscriptionId = subscriptionEntity.id;
    const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
    if (!subscription) {
      console.log(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
      return;
    }

    await SubscriptionsDAO.updateStatus(subscription.id, 'expired');
  }

  /**
   * subscription.pending / subscription.halted → past_due.
   * No cycle provisioning. Successful later charged restores active + one cycle.
   */
  private static async handleSubscriptionPastDue(
    payload: any,
    eventName: string
  ): Promise<void> {
    const subscriptionEntity = payload.subscription?.entity;
    if (!subscriptionEntity) return;

    const razorpaySubscriptionId = subscriptionEntity.id;
    const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
    if (!subscription) {
      console.log(`Subscription not found for Razorpay ID ${razorpaySubscriptionId}`);
      return;
    }

    if (subscription.status === 'cancelled' || subscription.status === 'expired') {
      return;
    }

    await SubscriptionsDAO.markPastDue(subscription.id);
    console.log(
      `[webhook] ${eventName} → past_due for subscription ${subscription.id} (no cycle grant)`
    );
  }

  private static async handlePaymentFailed(payload: any): Promise<void> {
    const paymentEntity = payload.payment?.entity;
    if (!paymentEntity) return;

    const orderId = paymentEntity.order_id;
    const paymentId = paymentEntity.id;

    // PAYG order path
    if (orderId) {
      const payment = await PaymentsDAO.getByOrderId(orderId);
      if (payment) {
        await PaymentsDAO.updateStatus(payment.id, 'failed', paymentId);
      }
    }

    // Subscription payment failures are primarily driven by subscription.pending/halted.
    // If payload includes subscription_id, mark past_due without inventing a grace period.
    const razorpaySubscriptionId =
      typeof paymentEntity.subscription_id === 'string'
        ? paymentEntity.subscription_id
        : null;
    if (razorpaySubscriptionId) {
      const subscription = await SubscriptionsDAO.getByRazorpayId(razorpaySubscriptionId);
      if (
        subscription &&
        subscription.status !== 'cancelled' &&
        subscription.status !== 'expired'
      ) {
        await SubscriptionsDAO.markPastDue(subscription.id);
        console.log(
          `[webhook] payment.failed → past_due for subscription ${subscription.id}`
        );
      }
    }
  }
}
