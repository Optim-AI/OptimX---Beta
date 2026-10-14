import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { trialAccessRequests } from '@/database/schema';
import type { TrialRequestValidated } from './validate';

export const TRIAL_REQUEST_LIMITS = {
  perIpHour: 3,
  perIpDay: 10,
  /** Reuse a pending request for the same email within this window. */
  dedupeDays: 30,
} as const;

export type TrialRequestRow = typeof trialAccessRequests.$inferSelect;

export async function findRecentPendingByEmail(
  email: string,
  withinDays = TRIAL_REQUEST_LIMITS.dedupeDays
): Promise<TrialRequestRow | null> {
  const since = new Date(Date.now() - withinDays * 86_400_000).toISOString();
  const [row] = await db
    .select()
    .from(trialAccessRequests)
    .where(
      and(
        eq(trialAccessRequests.email, email.toLowerCase()),
        eq(trialAccessRequests.status, 'pending'),
        gte(trialAccessRequests.createdAt, since)
      )
    )
    .orderBy(sql`${trialAccessRequests.createdAt} desc`)
    .limit(1);
  return row ?? null;
}

export async function countTrialRequestsByIp(
  ipHash: string,
  sinceIso: string
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(trialAccessRequests)
    .where(
      and(
        eq(trialAccessRequests.clientIpHash, ipHash),
        gte(trialAccessRequests.createdAt, sinceIso)
      )
    );
  return Number(row?.n ?? 0);
}

export async function insertTrialRequest(input: {
  data: TrialRequestValidated;
  ipHash: string | null;
  userAgent: string | null;
}): Promise<TrialRequestRow> {
  const [row] = await db
    .insert(trialAccessRequests)
    .values({
      fullName: input.data.fullName,
      email: input.data.email,
      companyName: input.data.companyName,
      websiteUrl: input.data.websiteUrl,
      useCase: input.data.useCase,
      status: 'pending',
      clientIpHash: input.ipHash,
      userAgent: input.userAgent?.slice(0, 400) || null,
      updatedAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function markTrialNotifyResult(
  id: string,
  result: { ok: true } | { ok: false; error: string }
): Promise<void> {
  await db
    .update(trialAccessRequests)
    .set({
      notifySentAt: result.ok ? new Date().toISOString() : null,
      notifyError: result.ok ? null : result.error.slice(0, 500),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(trialAccessRequests.id, id));
}
