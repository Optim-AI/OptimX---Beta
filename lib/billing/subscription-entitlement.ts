/**
 * Charge-driven subscription entitlement provisioning.
 * Source of truth: successful Razorpay subscription payment id.
 *
 * Idempotency key: sub_charge:{razorpay_payment_id}
 * All wallet + cycle + history mutations run in one DB transaction.
 */

import { db } from '@/database/client';
import {
  subscriptionCycles,
  userCredits,
  creditHistory,
  subscriptions,
  plans,
} from '@/database/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { SubscriptionCycle } from '@/database/models/SubscriptionCycles.dao';

export function subscriptionChargeIdempotencyKey(razorpayPaymentId: string): string {
  if (!razorpayPaymentId || typeof razorpayPaymentId !== 'string') {
    throw new Error('razorpayPaymentId is required for entitlement idempotency');
  }
  return `sub_charge:${razorpayPaymentId.trim()}`;
}

export class SubscriptionEntitlementError extends Error {
  code:
    | 'MISSING_PAYMENT_ID'
    | 'PLAN_NOT_FOUND'
    | 'PLAN_INACTIVE'
    | 'SUBSCRIPTION_NOT_FOUND'
    | 'PROVISION_FAILED';

  constructor(code: SubscriptionEntitlementError['code'], message: string) {
    super(message);
    this.name = 'SubscriptionEntitlementError';
    this.code = code;
  }
}

export interface ProvisionSubscriptionCycleParams {
  subscriptionId: string;
  userId: string;
  planId: string;
  razorpayPaymentId: string;
  /** Optional override; default = now → +1 month for monthly plans */
  periodStart?: Date;
  periodEnd?: Date;
  metadata?: Record<string, unknown>;
}

export interface ProvisionSubscriptionCycleResult {
  cycle: SubscriptionCycle;
  created: boolean;
  creditsGranted: boolean;
}

/**
 * Provision exactly one monthly subscription entitlement for a Razorpay charge.
 * Safe under concurrent / duplicate delivery.
 */
export async function provisionSubscriptionCycleForCharge(
  params: ProvisionSubscriptionCycleParams
): Promise<ProvisionSubscriptionCycleResult> {
  const razorpayPaymentId = params.razorpayPaymentId?.trim();
  if (!razorpayPaymentId) {
    throw new SubscriptionEntitlementError(
      'MISSING_PAYMENT_ID',
      'Cannot provision subscription credits without razorpay_payment_id'
    );
  }

  const idempotencyKey = subscriptionChargeIdempotencyKey(razorpayPaymentId);

  return await db.transaction(async (tx) => {
    // Load plan inside the transaction — never trust client amounts
    const planRows = await tx
      .select()
      .from(plans)
      .where(eq(plans.id, params.planId))
      .limit(1);
    const plan = planRows[0];
    if (!plan) {
      throw new SubscriptionEntitlementError('PLAN_NOT_FOUND', `Plan ${params.planId} not found`);
    }
    if (!plan.isActive) {
      throw new SubscriptionEntitlementError(
        'PLAN_INACTIVE',
        `Plan ${params.planId} is not active`
      );
    }

    const imageCredits = Number(plan.imageCredits);
    const videoCredits = Number(plan.videoCredits);
    if (!Number.isInteger(imageCredits) || imageCredits < 0) {
      throw new SubscriptionEntitlementError('PROVISION_FAILED', 'Invalid plan image_credits');
    }
    if (!Number.isInteger(videoCredits) || videoCredits < 0) {
      throw new SubscriptionEntitlementError('PROVISION_FAILED', 'Invalid plan video_credits');
    }

    const now = params.periodStart ?? new Date();
    let periodEnd = params.periodEnd;
    if (!periodEnd) {
      periodEnd = new Date(now);
      if (plan.billingCycle === 'quarterly') {
        periodEnd.setMonth(periodEnd.getMonth() + 3);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
    }

    // Existing provisioned cycle → no-op
    const existing = await tx
      .select()
      .from(subscriptionCycles)
      .where(eq(subscriptionCycles.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing[0]?.status === 'provisioned') {
      return { cycle: existing[0], created: false, creditsGranted: false };
    }

    let cycle = existing[0] ?? null;

    if (!cycle) {
      try {
        const [inserted] = await tx
          .insert(subscriptionCycles)
          .values({
            subscriptionId: params.subscriptionId,
            userId: params.userId,
            planId: params.planId,
            razorpayPaymentId,
            periodStart: now.toISOString(),
            periodEnd: periodEnd.toISOString(),
            imageCreditsGranted: imageCredits,
            videoCreditsGranted: videoCredits,
            status: 'pending',
            idempotencyKey,
            metadata: params.metadata ?? null,
          })
          .returning();
        cycle = inserted;
      } catch (error: any) {
        if (
          error?.code === '23505' ||
          /unique|duplicate/i.test(String(error?.message || ''))
        ) {
          const raced = await tx
            .select()
            .from(subscriptionCycles)
            .where(eq(subscriptionCycles.idempotencyKey, idempotencyKey))
            .limit(1);
          if (raced[0]?.status === 'provisioned') {
            return { cycle: raced[0], created: false, creditsGranted: false };
          }
          cycle = raced[0] ?? null;
          if (!cycle) throw error;
        } else {
          throw error;
        }
      }
    }

    // Lock pending cycle row
    const lockedCycle = await tx.execute(
      sql`SELECT * FROM subscription_cycles WHERE id = ${cycle!.id} FOR UPDATE`
    );
    const lockedRows = (lockedCycle as any).rows ?? lockedCycle;
    const locked = Array.isArray(lockedRows) ? lockedRows[0] : null;
    if (!locked) {
      throw new SubscriptionEntitlementError('PROVISION_FAILED', 'Cycle row missing after insert');
    }
    if (locked.status === 'provisioned') {
      const [fresh] = await tx
        .select()
        .from(subscriptionCycles)
        .where(eq(subscriptionCycles.id, cycle!.id))
        .limit(1);
      return { cycle: fresh!, created: false, creditsGranted: false };
    }

    // Lock wallet and reset subscription buckets (preserve addon)
    await tx.execute(sql`SELECT * FROM user_credits WHERE id = ${params.userId} FOR UPDATE`);

    const creditRows = await tx
      .select()
      .from(userCredits)
      .where(eq(userCredits.id, params.userId))
      .limit(1);

    let wallet = creditRows[0];
    const ts = new Date().toISOString();

    if (!wallet) {
      const [createdWallet] = await tx
        .insert(userCredits)
        .values({
          id: params.userId,
          credits: 0,
          imageCreditsSubscription: imageCredits,
          imageCreditsAddon: 0,
          videoCreditsSubscription: videoCredits,
          videoCreditsAddon: 0,
          lastResetAt: ts,
          updatedAt: ts,
        })
        .returning();
      wallet = createdWallet;
    } else {
      const [updated] = await tx
        .update(userCredits)
        .set({
          imageCreditsSubscription: imageCredits,
          videoCreditsSubscription: videoCredits,
          lastResetAt: ts,
          updatedAt: ts,
        })
        .where(eq(userCredits.id, params.userId))
        .returning();
      wallet = updated;
    }

    const historyMeta = {
      cycleId: cycle!.id,
      subscriptionId: params.subscriptionId,
      razorpayPaymentId,
      idempotencyKey,
      planId: params.planId,
      source: 'subscription_cycle_provision',
    };

    await tx.insert(creditHistory).values({
      userId: params.userId,
      creditType: 'image',
      amount: imageCredits,
      operation: 'reset',
      source: 'subscription_cycle',
      balanceAfter: imageCredits + (wallet.imageCreditsAddon ?? 0),
      metadata: historyMeta,
    });
    await tx.insert(creditHistory).values({
      userId: params.userId,
      creditType: 'video',
      amount: videoCredits,
      operation: 'reset',
      source: 'subscription_cycle',
      balanceAfter: videoCredits + (wallet.videoCreditsAddon ?? 0),
      metadata: historyMeta,
    });

    // Update subscription period + activate if still pending
    const nextReset = new Date(periodEnd);
    await tx
      .update(subscriptions)
      .set({
        status: 'active',
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: periodEnd.toISOString(),
        nextResetDate: nextReset.toISOString(),
        updatedAt: ts,
      })
      .where(eq(subscriptions.id, params.subscriptionId));

    const [provisioned] = await tx
      .update(subscriptionCycles)
      .set({
        status: 'provisioned',
        periodStart: now.toISOString(),
        periodEnd: periodEnd.toISOString(),
        imageCreditsGranted: imageCredits,
        videoCreditsGranted: videoCredits,
        updatedAt: ts,
        metadata: {
          ...(params.metadata || {}),
          provisionedAt: ts,
        },
      })
      .where(
        and(eq(subscriptionCycles.id, cycle!.id), eq(subscriptionCycles.status, 'pending'))
      )
      .returning();

    if (!provisioned) {
      // Another worker finished
      const [fresh] = await tx
        .select()
        .from(subscriptionCycles)
        .where(eq(subscriptionCycles.id, cycle!.id))
        .limit(1);
      return { cycle: fresh!, created: false, creditsGranted: false };
    }

    return { cycle: provisioned, created: true, creditsGranted: true };
  });
}
