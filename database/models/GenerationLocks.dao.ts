// database/models/GenerationLocks.dao.ts
// Cross-instance generation idempotency locks (commercial video).

import { db } from '../client';
import { generationJobLocks } from '@/database/schema';
import { and, eq, inArray } from 'drizzle-orm';

export type GenerationJobLock = typeof generationJobLocks.$inferSelect;

export class GenerationLocksDAO {
  static async getByKey(lockKey: string): Promise<GenerationJobLock | null> {
    const rows = await db
      .select()
      .from(generationJobLocks)
      .where(eq(generationJobLocks.lockKey, lockKey))
      .limit(1);
    return rows[0] || null;
  }

  /**
   * Claim an exclusive in-progress lock for a logical generation request.
   * - force=true: allow reclaim after completed/failed (QC regenerate / retry)
   * - force=false: reject if in_progress or completed
   */
  static async tryClaim(params: {
    lockKey: string;
    userId: string;
    force?: boolean;
  }): Promise<
    | { claimed: true; lock: GenerationJobLock }
    | { claimed: false; reason: 'in_progress' | 'completed' | 'owned_by_other'; lock: GenerationJobLock }
  > {
    const { lockKey, userId, force = false } = params;
    const existing = await this.getByKey(lockKey);

    if (existing) {
      if (existing.userId !== userId) {
        return { claimed: false, reason: 'owned_by_other', lock: existing };
      }
      if (existing.status === 'in_progress') {
        return { claimed: false, reason: 'in_progress', lock: existing };
      }
      if (existing.status === 'completed' && !force) {
        return { claimed: false, reason: 'completed', lock: existing };
      }
      // Reclaim failed or force-completed
      const [updated] = await db
        .update(generationJobLocks)
        .set({
          status: 'in_progress',
          reservationId: null,
          resultSummary: null,
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(generationJobLocks.lockKey, lockKey),
            inArray(generationJobLocks.status, force ? ['completed', 'failed'] : ['failed'])
          )
        )
        .returning();
      if (updated) {
        return { claimed: true, lock: updated };
      }
      const raced = await this.getByKey(lockKey);
      if (raced?.status === 'in_progress') {
        return { claimed: false, reason: 'in_progress', lock: raced };
      }
      if (raced?.status === 'completed') {
        return { claimed: false, reason: 'completed', lock: raced };
      }
      // Fall through to insert if row vanished
    }

    try {
      const [created] = await db
        .insert(generationJobLocks)
        .values({
          lockKey,
          userId,
          status: 'in_progress',
        })
        .returning();
      return { claimed: true, lock: created };
    } catch (error: any) {
      if (
        error?.code === '23505' ||
        /unique|duplicate/i.test(String(error?.message || ''))
      ) {
        const raced = await this.getByKey(lockKey);
        if (raced) {
          if (raced.status === 'in_progress') {
            return { claimed: false, reason: 'in_progress', lock: raced };
          }
          if (raced.status === 'completed') {
            return { claimed: false, reason: 'completed', lock: raced };
          }
        }
      }
      throw error;
    }
  }

  static async attachReservation(
    lockKey: string,
    reservationId: string
  ): Promise<void> {
    await db
      .update(generationJobLocks)
      .set({
        reservationId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationJobLocks.lockKey, lockKey));
  }

  static async markCompleted(
    lockKey: string,
    resultSummary?: Record<string, unknown>
  ): Promise<void> {
    await db
      .update(generationJobLocks)
      .set({
        status: 'completed',
        resultSummary: resultSummary ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationJobLocks.lockKey, lockKey));
  }

  static async markFailed(
    lockKey: string,
    resultSummary?: Record<string, unknown>
  ): Promise<void> {
    await db
      .update(generationJobLocks)
      .set({
        status: 'failed',
        resultSummary: resultSummary ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationJobLocks.lockKey, lockKey));
  }
}
