/** ad_studio_projects / ad_studio_drafts persistence. Every user-facing query is scoped by userId. */
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { adStudioDrafts, adStudioProjects } from '@/database/schema';

export type ProjectRow = typeof adStudioProjects.$inferSelect;
export type DraftRow = typeof adStudioDrafts.$inferSelect;
const now = () => new Date().toISOString();

export async function createProject(values: typeof adStudioProjects.$inferInsert) {
  const [row] = await db.insert(adStudioProjects).values(values).returning();
  return row;
}
export async function getProject(userId: string, id: string) {
  const [row] = await db.select().from(adStudioProjects).where(and(eq(adStudioProjects.id, id), eq(adStudioProjects.userId, userId))).limit(1);
  return row ?? null;
}
export async function getProjectById(id: string) {
  const [row] = await db.select().from(adStudioProjects).where(eq(adStudioProjects.id, id)).limit(1);
  return row ?? null;
}
export async function updateProject(id: string, patch: Partial<ProjectRow>) {
  await db.update(adStudioProjects).set({ ...patch, updatedAt: now() }).where(eq(adStudioProjects.id, id));
}
/** Start a round only when nothing is being drawn (a double click can't start two). */
export async function claimRound(userId: string, id: string): Promise<ProjectRow | null> {
  const [row] = await db.update(adStudioProjects)
    .set({ status: 'researching', rounds: sql`${adStudioProjects.rounds} + 1`, error: null, updatedAt: now() })
    .where(and(eq(adStudioProjects.id, id), eq(adStudioProjects.userId, userId),
      sql`(${adStudioProjects.status} in ('ready', 'failed') or ${adStudioProjects.updatedAt} < now() - interval '40 minutes')`))
    .returning();
  return row ?? null;
}

export async function listDrafts(projectId: string) {
  return db.select().from(adStudioDrafts).where(eq(adStudioDrafts.projectId, projectId))
    .orderBy(asc(adStudioDrafts.round), asc(adStudioDrafts.position), asc(adStudioDrafts.createdAt));
}
export async function getDraft(userId: string, projectId: string, draftId: string) {
  const [row] = await db.select().from(adStudioDrafts)
    .where(and(eq(adStudioDrafts.id, draftId), eq(adStudioDrafts.projectId, projectId), eq(adStudioDrafts.userId, userId))).limit(1);
  return row ?? null;
}
export async function getDraftById(draftId: string) {
  const [row] = await db.select().from(adStudioDrafts).where(eq(adStudioDrafts.id, draftId)).limit(1);
  return row ?? null;
}

export async function insertDrafts(rows: (typeof adStudioDrafts.$inferInsert)[]) {
  return rows.length ? db.insert(adStudioDrafts).values(rows).returning() : [];
}
export async function updateDraft(id: string, patch: Partial<DraftRow>) {
  await db.update(adStudioDrafts).set({ ...patch, updatedAt: now() }).where(eq(adStudioDrafts.id, id));
}

/** Free drafts (originals + edits; paid extra sizes don't count) for this product in the last 24 hours. */
export async function draftsLast24h(userId: string, productSlug: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(adStudioDrafts)
    .innerJoin(adStudioProjects, eq(adStudioProjects.id, adStudioDrafts.projectId))
    .where(and(eq(adStudioDrafts.userId, userId), eq(adStudioProjects.productSlug, productSlug), ne(adStudioDrafts.kind, 'format'), sql`${adStudioDrafts.createdAt} > now() - interval '24 hours'`));
  return r?.n ?? 0;
}

export { db, adStudioDrafts, adStudioProjects, inArray, and, eq, sql };
