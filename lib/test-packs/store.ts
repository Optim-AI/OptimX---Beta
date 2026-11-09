/** test_packs / test_pack_variants persistence. Every query is scoped by userId. */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { testPacks, testPackVariants } from '@/database/schema';

export type TestPackRow = typeof testPacks.$inferSelect;
export type TestPackVariantRow = typeof testPackVariants.$inferSelect;

const now = () => new Date().toISOString();

export async function createPack(values: typeof testPacks.$inferInsert): Promise<TestPackRow> {
  const [row] = await db.insert(testPacks).values(values).returning();
  return row;
}

export async function getPack(userId: string, id: string): Promise<TestPackRow | null> {
  const [row] = await db.select().from(testPacks).where(and(eq(testPacks.id, id), eq(testPacks.userId, userId))).limit(1);
  return row ?? null;
}

export async function getPackById(id: string): Promise<TestPackRow | null> {
  const [row] = await db.select().from(testPacks).where(eq(testPacks.id, id)).limit(1);
  return row ?? null;
}

export async function listPacks(userId: string, limit = 20) {
  return db.select().from(testPacks).where(eq(testPacks.userId, userId)).orderBy(desc(testPacks.createdAt)).limit(limit);
}

export async function updatePack(id: string, patch: Partial<TestPackRow>) {
  await db.update(testPacks).set({ ...patch, updatedAt: now() }).where(eq(testPacks.id, id));
}

/** Move draft/failed/partial (or a generating run stuck for 75+ min) → generating, once. */
export async function claimForGeneration(userId: string, id: string, patch: Partial<TestPackRow>): Promise<boolean> {
  const res = await db.update(testPacks).set({ ...patch, status: 'generating', updatedAt: now() })
    .where(and(eq(testPacks.id, id), eq(testPacks.userId, userId), sql`(${testPacks.status} in ('draft', 'failed', 'partial')
      or (${testPacks.status} = 'generating' and ${testPacks.updatedAt} < now() - interval '75 minutes'))`))
    .returning({ id: testPacks.id });
  return res.length > 0;
}

export async function listVariants(packId: string) {
  return db.select().from(testPackVariants).where(eq(testPackVariants.packId, packId)).orderBy(asc(testPackVariants.position));
}

export async function replaceVariants(packId: string, rows: (typeof testPackVariants.$inferInsert)[]) {
  await db.transaction(async (tx) => {
    await tx.delete(testPackVariants).where(eq(testPackVariants.packId, packId));
    if (rows.length) await tx.insert(testPackVariants).values(rows);
  });
}

export async function updateVariant(id: string, patch: Partial<TestPackVariantRow>) {
  await db.update(testPackVariants).set({ ...patch, updatedAt: now() }).where(eq(testPackVariants.id, id));
}

export async function packsCreatedToday(userId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(testPacks)
    .where(and(eq(testPacks.userId, userId), sql`${testPacks.createdAt} > now() - interval '24 hours'`));
  return r?.n ?? 0;
}
