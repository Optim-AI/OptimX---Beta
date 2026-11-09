/** weekly_briefs persistence. */
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { weeklyBriefs, metaConnections } from '@/database/schema';

export type WeeklyBriefRow = typeof weeklyBriefs.$inferSelect;
const now = () => new Date().toISOString();

/** Insert the week's row, or take over an existing one that isn't finished. Returns null if already built. */
export async function claimWeek(input: { connectionId: string; userId: string; weekStart: string; weekEnd: string; trigger: 'schedule' | 'manual'; rebuild: boolean }) {
  const [inserted] = await db.insert(weeklyBriefs).values({ ...input, status: 'building' }).onConflictDoNothing().returning();
  if (inserted) return inserted;
  const [existing] = await db.select().from(weeklyBriefs).where(and(eq(weeklyBriefs.connectionId, input.connectionId), eq(weeklyBriefs.weekStart, input.weekStart))).limit(1);
  if (!existing) return null;
  const stale = existing.status === 'building' && Date.now() - Date.parse(existing.updatedAt) > 30 * 60 * 1000;
  if (existing.status === 'failed' || stale || (input.rebuild && existing.status === 'ready')) {
    const [row] = await db.update(weeklyBriefs).set({ status: 'building', trigger: input.trigger, error: null, updatedAt: now() }).where(eq(weeklyBriefs.id, existing.id)).returning();
    return row;
  }
  return null;
}

export async function updateBrief(id: string, patch: Partial<WeeklyBriefRow>) {
  await db.update(weeklyBriefs).set({ ...patch, updatedAt: now() }).where(eq(weeklyBriefs.id, id));
}

export async function latestReadyBrief(connectionId: string) {
  const [row] = await db.select().from(weeklyBriefs).where(and(eq(weeklyBriefs.connectionId, connectionId), eq(weeklyBriefs.status, 'ready'))).orderBy(desc(weeklyBriefs.weekStart)).limit(1);
  return row ?? null;
}

export async function buildingBrief(connectionId: string) {
  const [row] = await db.select().from(weeklyBriefs)
    .where(and(eq(weeklyBriefs.connectionId, connectionId), eq(weeklyBriefs.status, 'building'), sql`${weeklyBriefs.updatedAt} > now() - interval '30 minutes'`)).limit(1);
  return row ?? null;
}

export async function manualBriefsToday(connectionId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(weeklyBriefs)
    .where(and(eq(weeklyBriefs.connectionId, connectionId), eq(weeklyBriefs.trigger, 'manual'), sql`${weeklyBriefs.updatedAt} > now() - interval '24 hours'`));
  return r?.n ?? 0;
}

export async function hasBriefForWeek(connectionId: string, weekStart: string): Promise<boolean> {
  const [r] = await db.select({ id: weeklyBriefs.id }).from(weeklyBriefs).where(and(eq(weeklyBriefs.connectionId, connectionId), eq(weeklyBriefs.weekStart, weekStart))).limit(1);
  return !!r;
}

export async function setBriefEmailEnabled(userId: string, enabled: boolean) {
  await db.update(metaConnections).set({ briefEmailEnabled: enabled, updatedAt: now() }).where(eq(metaConnections.userId, userId));
}
