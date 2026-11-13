// database/models/GenerationLocks.dao.ts
// Cross-instance generation idempotency locks (commercial video).

import { db } from '../client';
import { generationJobLocks } from '@/database/schema';
import { and, eq, sql } from 'drizzle-orm';
import { isUniqueViolation } from '@/lib/db/unique-violation';

export type GenerationJobLock = typeof generationJobLocks.$inferSelect;

/**
 * An in_progress lock older than this belongs to a request that can no longer be running
 * (commercial generate is capped at 800s), e.g. the function was killed mid-run.
 */
export const STALE_GENERATION_LOCK_MINUTES = 15;

/** A resume request runs at most ~13 min (800s function); after that another may take over. */
export const RESUME_TAKEOVER_MINUTES = 14;

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
   * - completed: never reclaimed — it was already billed; the caller replays the stored result
   * - failed: reclaimed (its credits were released)
   * - in_progress older than STALE_GENERATION_LOCK_MINUTES is reclaimed (dead request)
   */
  static async tryClaim(params: {
    lockKey: string;
    userId: string;
  }): Promise<
    | { claimed: true; lock: GenerationJobLock }
    | { claimed: false; reason: 'in_progress' | 'completed' | 'owned_by_other'; lock: GenerationJobLock }
  > {
    const { lockKey, userId } = params;
    const existing = await this.getByKey(lockKey);

    if (existing) {
      if (existing.userId !== userId) {
        return { claimed: false, reason: 'owned_by_other', lock: existing };
      }
      if (existing.status === 'in_progress') {
        const [reclaimed] = await db
          .update(generationJobLocks)
          .set({
            status: 'in_progress',
            reservationId: null,
            resultSummary: { reclaimedStaleLock: true, previous: existing.resultSummary ?? null },
            updatedAt: new Date().toISOString(),
          })
          .where(
            and(
              eq(generationJobLocks.lockKey, lockKey),
              eq(generationJobLocks.status, 'in_progress'),
              sql`${generationJobLocks.updatedAt} < now() - make_interval(mins => ${STALE_GENERATION_LOCK_MINUTES})`
            )
          )
          .returning();
        if (reclaimed) {
          console.warn('[GenerationLocksDAO] reclaimed stale in_progress lock', {
            lockKey,
            staleReservationId: existing.reservationId,
          });
          return { claimed: true, lock: reclaimed };
        }
        return { claimed: false, reason: 'in_progress', lock: existing };
      }
      if (existing.status === 'completed') {
        return { claimed: false, reason: 'completed', lock: existing };
      }
      // Reclaim failed
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
            eq(generationJobLocks.status, 'failed')
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
      if (isUniqueViolation(error)) {
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

  /** Lock-key prefix shared by every fix of one original video. */
  static fixKeyPrefix(rootKey: string): string {
    return `fix:${rootKey}:`;
  }

  /** Free fixes that completed for this original video (failed fixes never count). */
  static async countFreeFixes(userId: string, rootKey: string): Promise<number> {
    const rows = await db
      .select({ n: sql<number>`count(*)` })
      .from(generationJobLocks)
      .where(
        and(
          eq(generationJobLocks.userId, userId),
          eq(generationJobLocks.status, 'completed'),
          sql`starts_with(${generationJobLocks.lockKey}, ${this.fixKeyPrefix(rootKey)})`,
          sql`${generationJobLocks.resultSummary}->>'free' = 'true'`
        )
      );
    return Number(rows[0]?.n ?? 0);
  }

  /** A fix of this video still running (not left behind by a dead request). */
  static async hasActiveFix(userId: string, rootKey: string): Promise<boolean> {
    const rows = await db
      .select({ lockKey: generationJobLocks.lockKey })
      .from(generationJobLocks)
      .where(
        and(
          eq(generationJobLocks.userId, userId),
          eq(generationJobLocks.status, 'in_progress'),
          sql`starts_with(${generationJobLocks.lockKey}, ${this.fixKeyPrefix(rootKey)})`,
          sql`${generationJobLocks.updatedAt} >= now() - make_interval(mins => ${STALE_GENERATION_LOCK_MINUTES})`
        )
      )
      .limit(1);
    return rows.length > 0;
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

  /**
   * The provider is still rendering when the request runs out of time: keep the lock
   * (and its credit reservation) in progress and record what a later request needs
   * to finish the same job without paying the provider again.
   */
  static async markWaitingOnProvider(
    lockKey: string,
    pendingProvider: Record<string, unknown>
  ): Promise<void> {
    await db
      .update(generationJobLocks)
      .set({
        resultSummary: { pendingProvider: { ...pendingProvider, handedOverAt: new Date().toISOString() } },
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(generationJobLocks.lockKey, lockKey), eq(generationJobLocks.status, 'in_progress')));
  }

  /**
   * Let exactly one request take over a job waiting on the provider. A takeover
   * older than RESUME_TAKEOVER_MINUTES belongs to a request that has since died.
   */
  static async claimProviderResume(
    lockKey: string,
    userId: string
  ): Promise<GenerationJobLock | null> {
    const [row] = await db
      .update(generationJobLocks)
      .set({
        resultSummary: sql`jsonb_set(${generationJobLocks.resultSummary}, '{pendingProvider,resumingAt}', to_jsonb(now()::text))`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(generationJobLocks.lockKey, lockKey),
          eq(generationJobLocks.userId, userId),
          eq(generationJobLocks.status, 'in_progress'),
          sql`${generationJobLocks.resultSummary} ? 'pendingProvider'`,
          sql`coalesce((${generationJobLocks.resultSummary}->'pendingProvider'->>'resumingAt')::timestamptz, 'epoch'::timestamptz) < now() - make_interval(mins => ${RESUME_TAKEOVER_MINUTES})`
        )
      )
      .returning();
    return row ?? null;
  }
}
