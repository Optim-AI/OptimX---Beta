/** ai_insights persistence. */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { aiInsights } from '@/database/schema';

export type AiInsightRow = typeof aiInsights.$inferSelect;

export async function startInsightRun(input: { connectionId: string; userId: string; trigger: 'sync' | 'manual'; rangeDays: number }) {
  const [row] = await db.insert(aiInsights).values({ ...input, status: 'running' }).returning();
  return row;
}

export async function finishInsightRun(id: string, patch: Partial<AiInsightRow>) {
  await db.update(aiInsights).set({ ...patch, finishedAt: new Date().toISOString() }).where(eq(aiInsights.id, id));
}

export async function latestInsight(connectionId: string, status?: 'succeeded' | 'running' | 'failed') {
  const [row] = await db.select().from(aiInsights)
    .where(status ? and(eq(aiInsights.connectionId, connectionId), eq(aiInsights.status, status)) : eq(aiInsights.connectionId, connectionId))
    .orderBy(desc(aiInsights.createdAt)).limit(1);
  return row ?? null;
}

/** A run counts as in progress for at most 15 minutes (a crashed worker must not block forever). */
export async function runningInsight(connectionId: string) {
  const [row] = await db.select().from(aiInsights)
    .where(and(eq(aiInsights.connectionId, connectionId), eq(aiInsights.status, 'running'), gte(aiInsights.createdAt, sql`now() - interval '15 minutes'`)))
    .limit(1);
  return row ?? null;
}

export async function manualRunsLastDay(connectionId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(aiInsights)
    .where(and(eq(aiInsights.connectionId, connectionId), eq(aiInsights.trigger, 'manual'), gte(aiInsights.createdAt, sql`now() - interval '24 hours'`)));
  return r?.n ?? 0;
}
