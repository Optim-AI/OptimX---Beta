// database/models/Credits.dao.ts
// Atomic credit wallet operations + video credit reservations.
// Video wallet unit = SkalX Video Credits (NOT seconds, NOT provider tokens).

import { db } from '../client';
import { userCredits, creditHistory, creditReservations } from '@/database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { splitCreditDeduction as splitDeduction } from '@/lib/billing/credit-split';

type UserCredits = typeof userCredits.$inferSelect;
type CreditHistory = typeof creditHistory.$inferSelect;
type CreditReservation = typeof creditReservations.$inferSelect;

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
    /** Credits held for in-flight generations (already deducted from total). */
    reserved: number;
  };
  lastResetAt: string | null;
}

type CreditOp = 'add' | 'deduct' | 'reset' | 'expire' | 'reserve' | 'release' | 'consume' | 'migrate';

function toBalance(record: UserCredits, reservedVideo = 0): CreditBalance {
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
      reserved: reservedVideo,
    },
    lastResetAt: record.lastResetAt,
  };
}

/**
 * Data Access Object for Credits operations.
 * user_credits.id IS the auth user id.
 */
export class CreditsDAO {
  static async getFullBalance(userId: string): Promise<CreditBalance | null> {
    const result = await db
      .select()
      .from(userCredits)
      .where(eq(userCredits.id, userId))
      .limit(1);

    if (!result[0]) return null;

    const reserved = await this.getReservedAmount(userId, 'video');
    return toBalance(result[0], reserved);
  }

  static async getReservedAmount(
    userId: string,
    creditType: 'image' | 'video' = 'video'
  ): Promise<number> {
    const rows = await db
      .select({
        total: sql<number>`coalesce(sum(${creditReservations.amount}), 0)`,
      })
      .from(creditReservations)
      .where(
        and(
          eq(creditReservations.userId, userId),
          eq(creditReservations.creditType, creditType),
          eq(creditReservations.status, 'reserved')
        )
      );
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Deduct image credits atomically (subscription first, then addon).
   */
  static async deductImageCredits(
    userId: string,
    amount: number = 1
  ): Promise<{
    success: boolean;
    balance?: CreditBalance;
    error?: string;
    fromSubscription?: number;
    fromAddon?: number;
  }> {
    if (!Number.isInteger(amount) || amount < 1) {
      return { success: false, error: 'Amount must be a positive integer' };
    }

    try {
      return await db.transaction(async (tx) => {
        const locked = await tx.execute(
          sql`SELECT * FROM user_credits WHERE id = ${userId} FOR UPDATE`
        );
        const rows = (locked as any).rows ?? locked;
        const record = Array.isArray(rows) ? rows[0] : null;
        if (!record) {
          return { success: false, error: 'User credits not found' };
        }

        const sub = Number(record.image_credits_subscription ?? record.imageCreditsSubscription);
        const addon = Number(record.image_credits_addon ?? record.imageCreditsAddon);
        const split = splitDeduction(sub, addon, amount);
        if (!split) {
          return { success: false, error: 'Insufficient image credits' };
        }

        const now = new Date().toISOString();
        const [updated] = await tx
          .update(userCredits)
          .set({
            imageCreditsSubscription: split.newSubscription,
            imageCreditsAddon: split.newAddon,
            updatedAt: now,
          })
          .where(eq(userCredits.id, userId))
          .returning();

        await tx.insert(creditHistory).values({
          userId,
          creditType: 'image',
          amount: -amount,
          operation: 'deduct',
          source: 'image_generation',
          balanceAfter: split.newSubscription + split.newAddon,
          metadata: {
            fromSubscription: split.fromSubscription,
            fromAddon: split.fromAddon,
          },
        });

        return {
          success: true,
          balance: toBalance(updated),
          fromSubscription: split.fromSubscription,
          fromAddon: split.fromAddon,
        };
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to deduct image credits' };
    }
  }

  /**
   * Deduct video credits (SkalX Video Credits) atomically.
   */
  static async deductVideoCredits(
    userId: string,
    credits: number
  ): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    if (!Number.isInteger(credits) || credits < 1) {
      return { success: false, error: 'Amount must be a positive integer' };
    }

    try {
      return await db.transaction(async (tx) => {
        const locked = await tx.execute(
          sql`SELECT * FROM user_credits WHERE id = ${userId} FOR UPDATE`
        );
        const rows = (locked as any).rows ?? locked;
        const record = Array.isArray(rows) ? rows[0] : null;
        if (!record) {
          return { success: false, error: 'User credits not found' };
        }

        const sub = Number(record.video_credits_subscription ?? record.videoCreditsSubscription);
        const addon = Number(record.video_credits_addon ?? record.videoCreditsAddon);
        const split = splitDeduction(sub, addon, credits);
        if (!split) {
          return { success: false, error: 'Insufficient video credits' };
        }

        const now = new Date().toISOString();
        const [updated] = await tx
          .update(userCredits)
          .set({
            videoCreditsSubscription: split.newSubscription,
            videoCreditsAddon: split.newAddon,
            updatedAt: now,
          })
          .where(eq(userCredits.id, userId))
          .returning();

        await tx.insert(creditHistory).values({
          userId,
          creditType: 'video',
          amount: -credits,
          operation: 'deduct',
          source: 'video_generation',
          balanceAfter: split.newSubscription + split.newAddon,
          metadata: {
            fromSubscription: split.fromSubscription,
            fromAddon: split.fromAddon,
          },
        });

        return { success: true, balance: toBalance(updated) };
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to deduct video credits' };
    }
  }

  /**
   * Reserve video credits for an in-flight generation (deduct + reservation row).
   * Concurrent reserves on the same wallet are serialized via FOR UPDATE.
   */
  static async reserveVideoCredits(params: {
    userId: string;
    amount: number;
    purpose?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    success: boolean;
    reservationId?: string;
    balance?: CreditBalance;
    error?: string;
    fromSubscription?: number;
    fromAddon?: number;
  }> {
    const { userId, amount, purpose = 'video_generation', referenceId, metadata } = params;
    if (!Number.isInteger(amount) || amount < 1) {
      return { success: false, error: 'Amount must be a positive integer' };
    }

    try {
      return await db.transaction(async (tx) => {
        // Idempotent re-reserve for same reference while still reserved
        if (referenceId) {
          const existing = await tx
            .select()
            .from(creditReservations)
            .where(
              and(
                eq(creditReservations.userId, userId),
                eq(creditReservations.referenceId, referenceId),
                eq(creditReservations.status, 'reserved')
              )
            )
            .limit(1);
          if (existing[0] && existing[0].amount === amount) {
            const bal = await this.getFullBalance(userId);
            return {
              success: true,
              reservationId: existing[0].id,
              balance: bal ?? undefined,
              fromSubscription: Number(existing[0].fromSubscription ?? 0),
              fromAddon: Number(existing[0].fromAddon ?? 0),
            };
          }
        }

        const locked = await tx.execute(
          sql`SELECT * FROM user_credits WHERE id = ${userId} FOR UPDATE`
        );
        const rows = (locked as any).rows ?? locked;
        const record = Array.isArray(rows) ? rows[0] : null;
        if (!record) {
          return { success: false, error: 'User credits not found' };
        }

        const sub = Number(record.video_credits_subscription ?? record.videoCreditsSubscription);
        const addon = Number(record.video_credits_addon ?? record.videoCreditsAddon);
        const split = splitDeduction(sub, addon, amount);
        if (!split) {
          return { success: false, error: 'Insufficient video credits' };
        }

        const now = new Date().toISOString();
        const [updated] = await tx
          .update(userCredits)
          .set({
            videoCreditsSubscription: split.newSubscription,
            videoCreditsAddon: split.newAddon,
            updatedAt: now,
          })
          .where(eq(userCredits.id, userId))
          .returning();

        const [reservation] = await tx
          .insert(creditReservations)
          .values({
            userId,
            creditType: 'video',
            amount,
            status: 'reserved',
            purpose,
            referenceId: referenceId ?? null,
            fromSubscription: split.fromSubscription,
            fromAddon: split.fromAddon,
            metadata: metadata ?? null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        await tx.insert(creditHistory).values({
          userId,
          creditType: 'video',
          amount: -amount,
          operation: 'reserve',
          source: purpose,
          balanceAfter: split.newSubscription + split.newAddon,
          metadata: {
            reservationId: reservation.id,
            referenceId,
            fromSubscription: split.fromSubscription,
            fromAddon: split.fromAddon,
            ...(metadata || {}),
          },
        });

        return {
          success: true,
          reservationId: reservation.id,
          balance: toBalance(updated),
          fromSubscription: split.fromSubscription,
          fromAddon: split.fromAddon,
        };
      });
    } catch (error: any) {
      // Concurrent insert of same active reference — return existing reservation
      if (
        referenceId &&
        (error?.code === '23505' || /unique|duplicate/i.test(String(error?.message || '')))
      ) {
        try {
          const existing = await db
            .select()
            .from(creditReservations)
            .where(
              and(
                eq(creditReservations.userId, userId),
                eq(creditReservations.referenceId, referenceId),
                eq(creditReservations.status, 'reserved')
              )
            )
            .limit(1);
          if (existing[0] && existing[0].amount === amount) {
            const bal = await this.getFullBalance(userId);
            return {
              success: true,
              reservationId: existing[0].id,
              balance: bal ?? undefined,
              fromSubscription: Number(existing[0].fromSubscription ?? 0),
              fromAddon: Number(existing[0].fromAddon ?? 0),
            };
          }
        } catch {
          // fall through
        }
      }
      return { success: false, error: error.message || 'Failed to reserve video credits' };
    }
  }

  /**
   * Mark reservation as consumed (credits already deducted at reserve).
   */
  static async consumeReservation(
    reservationId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        const locked = await tx.execute(
          sql`SELECT * FROM credit_reservations WHERE id = ${reservationId} AND user_id = ${userId} FOR UPDATE`
        );
        const rows = (locked as any).rows ?? locked;
        const reservation = Array.isArray(rows) ? rows[0] : null;
        if (!reservation) {
          return { success: false, error: 'Reservation not found' };
        }
        const status = reservation.status;
        if (status === 'consumed') {
          return { success: true };
        }
        if (status !== 'reserved') {
          return { success: false, error: `Reservation is ${status}` };
        }

        const now = new Date().toISOString();
        await tx
          .update(creditReservations)
          .set({ status: 'consumed', updatedAt: now })
          .where(eq(creditReservations.id, reservationId));

        const amount = Number(reservation.amount);
        const bal = await tx
          .select()
          .from(userCredits)
          .where(eq(userCredits.id, userId))
          .limit(1);
        const total =
          (bal[0]?.videoCreditsSubscription ?? 0) + (bal[0]?.videoCreditsAddon ?? 0);

        await tx.insert(creditHistory).values({
          userId,
          creditType: 'video',
          amount: 0,
          operation: 'consume',
          source: reservation.purpose || 'video_generation',
          balanceAfter: total,
          metadata: {
            reservationId,
            amount,
            referenceId: reservation.reference_id ?? reservation.referenceId,
          },
        });

        return { success: true };
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to consume reservation' };
    }
  }

  /**
   * Release a reservation and return credits to the wallet.
   */
  static async releaseReservation(
    reservationId: string,
    userId: string
  ): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        const locked = await tx.execute(
          sql`SELECT * FROM credit_reservations WHERE id = ${reservationId} AND user_id = ${userId} FOR UPDATE`
        );
        const rows = (locked as any).rows ?? locked;
        const reservation = Array.isArray(rows) ? rows[0] : null;
        if (!reservation) {
          return { success: false, error: 'Reservation not found' };
        }
        const status = reservation.status;
        if (status === 'released') {
          const bal = await this.getFullBalance(userId);
          return { success: true, balance: bal ?? undefined };
        }
        if (status !== 'reserved') {
          return { success: false, error: `Reservation is ${status}` };
        }

        await tx.execute(sql`SELECT * FROM user_credits WHERE id = ${userId} FOR UPDATE`);

        const fromSub = Number(reservation.from_subscription ?? reservation.fromSubscription ?? 0);
        const fromAddon = Number(reservation.from_addon ?? reservation.fromAddon ?? 0);
        const amount = Number(reservation.amount);
        const now = new Date().toISOString();

        const current = await tx
          .select()
          .from(userCredits)
          .where(eq(userCredits.id, userId))
          .limit(1);
        if (!current[0]) {
          return { success: false, error: 'User credits not found' };
        }

        const newSub = current[0].videoCreditsSubscription + fromSub;
        const newAddon = current[0].videoCreditsAddon + fromAddon;

        const [updated] = await tx
          .update(userCredits)
          .set({
            videoCreditsSubscription: newSub,
            videoCreditsAddon: newAddon,
            updatedAt: now,
          })
          .where(eq(userCredits.id, userId))
          .returning();

        await tx
          .update(creditReservations)
          .set({ status: 'released', updatedAt: now })
          .where(eq(creditReservations.id, reservationId));

        await tx.insert(creditHistory).values({
          userId,
          creditType: 'video',
          amount,
          operation: 'release',
          source: reservation.purpose || 'video_generation',
          balanceAfter: newSub + newAddon,
          metadata: {
            reservationId,
            fromSubscription: fromSub,
            fromAddon: fromAddon,
            referenceId: reservation.reference_id ?? reservation.referenceId,
          },
        });

        return { success: true, balance: toBalance(updated) };
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to release reservation' };
    }
  }

  static async addImageCreditsAddon(
    userId: string,
    amount: number,
    source: string = 'addon_purchase',
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    if (!Number.isInteger(amount) || amount < 1) {
      return { success: false, error: 'Amount must be a positive integer' };
    }

    try {
      return await db.transaction(async (tx) => {
        const locked = await tx.execute(
          sql`SELECT * FROM user_credits WHERE id = ${userId} FOR UPDATE`
        );
        const rows = (locked as any).rows ?? locked;
        const record = Array.isArray(rows) ? rows[0] : null;
        if (!record) {
          return { success: false, error: 'User credits not found' };
        }

        const currentAddon = Number(record.image_credits_addon ?? record.imageCreditsAddon);
        const now = new Date().toISOString();
        const newAddon = currentAddon + amount;

        const [updated] = await tx
          .update(userCredits)
          .set({
            imageCreditsAddon: newAddon,
            updatedAt: now,
          })
          .where(eq(userCredits.id, userId))
          .returning();

        await tx.insert(creditHistory).values({
          userId,
          creditType: 'image',
          amount,
          operation: 'add',
          source,
          balanceAfter: updated.imageCreditsSubscription + newAddon,
          metadata: metadata ?? null,
        });

        return { success: true, balance: toBalance(updated) };
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to add image credits' };
    }
  }

  /**
   * Add addon video credits (SkalX Video Credits).
   */
  static async addVideoCreditsAddon(
    userId: string,
    credits: number,
    source: string = 'addon_purchase',
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    if (!Number.isInteger(credits) || credits < 1) {
      return { success: false, error: 'Amount must be a positive integer' };
    }

    try {
      return await db.transaction(async (tx) => {
        const locked = await tx.execute(
          sql`SELECT * FROM user_credits WHERE id = ${userId} FOR UPDATE`
        );
        const rows = (locked as any).rows ?? locked;
        const record = Array.isArray(rows) ? rows[0] : null;
        if (!record) {
          return { success: false, error: 'User credits not found' };
        }

        const currentAddon = Number(record.video_credits_addon ?? record.videoCreditsAddon);
        const now = new Date().toISOString();
        const newAddon = currentAddon + credits;

        const [updated] = await tx
          .update(userCredits)
          .set({
            videoCreditsAddon: newAddon,
            updatedAt: now,
          })
          .where(eq(userCredits.id, userId))
          .returning();

        await tx.insert(creditHistory).values({
          userId,
          creditType: 'video',
          amount: credits,
          operation: 'add',
          source,
          balanceAfter: updated.videoCreditsSubscription + newAddon,
          metadata: metadata ?? null,
        });

        return { success: true, balance: toBalance(updated) };
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to add video credits' };
    }
  }

  static async resetSubscriptionCredits(
    userId: string,
    imageCredits: number,
    videoCredits: number
  ): Promise<{ success: boolean; balance?: CreditBalance; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT * FROM user_credits WHERE id = ${userId} FOR UPDATE`);
        const now = new Date().toISOString();

        const [updated] = await tx
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

        await tx.insert(creditHistory).values({
          userId,
          creditType: 'image',
          amount: imageCredits,
          operation: 'reset',
          source: 'subscription_reset',
          balanceAfter: imageCredits + updated.imageCreditsAddon,
        });
        await tx.insert(creditHistory).values({
          userId,
          creditType: 'video',
          amount: videoCredits,
          operation: 'reset',
          source: 'subscription_reset',
          balanceAfter: videoCredits + updated.videoCreditsAddon,
        });

        return { success: true, balance: toBalance(updated) };
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to reset credits' };
    }
  }

  static async initializeCredits(
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
        await db.insert(userCredits).values({
          id: userId,
          credits: 0,
          imageCreditsSubscription: imageCredits,
          imageCreditsAddon: 0,
          videoCreditsSubscription: videoCredits,
          videoCreditsAddon: 0,
          lastResetAt: now,
          updatedAt: now,
        });

        return {
          success: true,
          balance: {
            imageCredits: { subscription: imageCredits, addon: 0, total: imageCredits },
            videoCredits: {
              subscription: videoCredits,
              addon: 0,
              total: videoCredits,
              reserved: 0,
            },
            lastResetAt: now,
          },
        };
      }

      await this.logCreditChange(userId, 'image', imageCredits, 'add', 'subscription_init', imageCredits);
      await this.logCreditChange(userId, 'video', videoCredits, 'add', 'subscription_init', videoCredits);

      return { success: true, balance: toBalance(updated) };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to initialize credits' };
    }
  }

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

      await this.logCreditChange(userId, 'image', 0, 'expire', 'trial_end', 0);
      await this.logCreditChange(userId, 'video', 0, 'expire', 'trial_end', 0);

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to expire credits' };
    }
  }

  /**
   * One-shot migration of a user's video wallet from seconds → Video Credits (* 20).
   *
   * Classification-based: only converts wallets with positive legacy-seconds evidence
   * and no Video Credits denomination evidence. Idempotent via credit_history marker
   * source = seconds_to_video_credits_v1 (+ unique partial index).
   *
   * Does NOT modify image balances. Does NOT rewrite historical credit_history rows.
   */
  static async migrateVideoSecondsToCredits(
    userId: string,
    rate: number = 20
  ): Promise<{
    success: boolean;
    skipped?: boolean;
    skipReason?: string;
    decision?: string;
    oldSubscription?: number;
    oldAddon?: number;
    newSubscription?: number;
    newAddon?: number;
    imageSubscription?: number;
    imageAddon?: number;
    error?: string;
  }> {
    try {
      const {
        classifyVideoWalletForSecondsMigration,
        convertSecondsBalancesToVideoCredits,
        VIDEO_SECONDS_MIGRATION_SOURCE,
        VIDEO_SECONDS_MIGRATION_VERSION,
      } = await import('@/lib/billing/video-seconds-migration');

      return await db.transaction(async (tx) => {
        // 1. Lock wallet
        const locked = await tx.execute(
          sql`SELECT * FROM user_credits WHERE id = ${userId} FOR UPDATE`
        );
        const rows = (locked as any).rows ?? locked;
        const record = Array.isArray(rows) ? rows[0] : null;
        if (!record) {
          return { success: false, error: 'User credits not found' };
        }

        const oldSub = Number(record.video_credits_subscription ?? record.videoCreditsSubscription);
        const oldAddon = Number(record.video_credits_addon ?? record.videoCreditsAddon);
        const imageSub = Number(record.image_credits_subscription ?? record.imageCreditsSubscription);
        const imageAddon = Number(record.image_credits_addon ?? record.imageCreditsAddon);

        // 2. Re-check migration marker while locked
        const prior = await tx
          .select()
          .from(creditHistory)
          .where(
            and(
              eq(creditHistory.userId, userId),
              eq(creditHistory.operation, 'migrate'),
              eq(creditHistory.source, VIDEO_SECONDS_MIGRATION_SOURCE),
              eq(creditHistory.creditType, 'video')
            )
          )
          .limit(1);

        const historyRows = await tx
          .select()
          .from(creditHistory)
          .where(eq(creditHistory.userId, userId));

        const classification = classifyVideoWalletForSecondsMigration({
          videoCreditsSubscription: oldSub,
          videoCreditsAddon: oldAddon,
          hasMigrationMarker: !!prior[0],
          history: historyRows.map((h) => ({
            creditType: h.creditType,
            operation: h.operation,
            source: h.source,
            amount: h.amount,
            metadata: (h.metadata as Record<string, unknown> | null) ?? null,
          })),
        });

        if (classification.decision !== 'migrate_legacy_seconds') {
          return {
            success: true,
            skipped: true,
            skipReason: classification.reason,
            decision: classification.decision,
            oldSubscription: oldSub,
            oldAddon: oldAddon,
            newSubscription: oldSub,
            newAddon: oldAddon,
            imageSubscription: imageSub,
            imageAddon: imageAddon,
          };
        }

        // 3. Convert video only
        const { subscription: newSub, addon: newAddon } = convertSecondsBalancesToVideoCredits(
          oldSub,
          oldAddon,
          rate
        );
        const now = new Date().toISOString();

        await tx
          .update(userCredits)
          .set({
            videoCreditsSubscription: newSub,
            videoCreditsAddon: newAddon,
            updatedAt: now,
          })
          .where(eq(userCredits.id, userId));

        // 4. Append migration marker (never rewrite prior history)
        await tx.insert(creditHistory).values({
          userId,
          creditType: 'video',
          amount: newSub + newAddon - (oldSub + oldAddon),
          operation: 'migrate',
          source: VIDEO_SECONDS_MIGRATION_SOURCE,
          balanceAfter: newSub + newAddon,
          metadata: {
            unit_from: 'seconds',
            unit_to: 'video_credits',
            conversion_rate: rate,
            old_subscription_amount: oldSub,
            old_addon_amount: oldAddon,
            new_subscription_amount: newSub,
            new_addon_amount: newAddon,
            migration_version: VIDEO_SECONDS_MIGRATION_VERSION,
            classification_reason: classification.reason,
            // image checksums at migration time (unchanged)
            image_subscription_unchanged: imageSub,
            image_addon_unchanged: imageAddon,
          },
        });

        return {
          success: true,
          skipped: false,
          decision: classification.decision,
          oldSubscription: oldSub,
          oldAddon: oldAddon,
          newSubscription: newSub,
          newAddon: newAddon,
          imageSubscription: imageSub,
          imageAddon: imageAddon,
        };
      });
    } catch (error: any) {
      return { success: false, error: error.message || 'Migration failed' };
    }
  }

  private static async logCreditChange(
    userId: string,
    creditType: 'image' | 'video',
    amount: number,
    operation: CreditOp,
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

  static async getHistory(userId: string, limit: number = 50): Promise<CreditHistory[]> {
    return db
      .select()
      .from(creditHistory)
      .where(eq(creditHistory.userId, userId))
      .orderBy(creditHistory.createdAt)
      .limit(limit);
  }

  /** @deprecated Use deductImageCredits or deductVideoCredits instead */
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

  /** @deprecated Use addImageCreditsAddon or addVideoCreditsAddon instead */
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

  /** @deprecated Use getFullBalance instead */
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

export type { CreditReservation };
