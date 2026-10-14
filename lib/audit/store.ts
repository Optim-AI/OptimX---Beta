import type { NextApiRequest } from 'next';
import { and, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { getUserIdFromRequest } from '@/auth/request';
import { db } from '@/database/client';
import { marketingAudits } from '@/database/schema';
import { readGuestSession } from '@/lib/onboarding/guest-session';
import { MAX_AUDIT_ATTEMPTS, type AuditViewer } from './access';
import type { AuditWorkState } from './pipeline';
import type { AuditCounts } from './rate-limit';
import type { AuditStage } from './types';

export type AuditRow = typeof marketingAudits.$inferSelect;

const LEASE_SECONDS = 270;
const REUSE_WINDOW_HOURS = 24;

export async function getAuditViewer(req: NextApiRequest): Promise<AuditViewer> {
  const [authUserId, guest] = await Promise.all([
    getUserIdFromRequest(req).catch(() => null),
    readGuestSession(req).catch(() => null),
  ]);
  return { authUserId, guestProfileId: guest?.profileId ?? null };
}

export function viewerOwnerIds(viewer: AuditViewer): string[] {
  return [viewer.authUserId, viewer.guestProfileId].filter((v): v is string => Boolean(v));
}

export async function getAudit(id: string): Promise<AuditRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select().from(marketingAudits).where(eq(marketingAudits.id, id)).limit(1);
  return row ?? null;
}

export async function countRecentAudits(actorId: string, ipHash: string): Promise<AuditCounts> {
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [r] = await db
    .select({
      actorHour: sql<number>`count(*) filter (where ${marketingAudits.userId} = ${actorId} and ${marketingAudits.createdAt} >= ${hourAgo})`,
      actorDay: sql<number>`count(*) filter (where ${marketingAudits.userId} = ${actorId})`,
      ipHour: sql<number>`count(*) filter (where ${marketingAudits.clientIpHash} = ${ipHash} and ${marketingAudits.createdAt} >= ${hourAgo})`,
      ipDay: sql<number>`count(*) filter (where ${marketingAudits.clientIpHash} = ${ipHash})`,
    })
    .from(marketingAudits)
    .where(
      and(
        gte(marketingAudits.createdAt, dayAgo),
        or(eq(marketingAudits.userId, actorId), eq(marketingAudits.clientIpHash, ipHash))
      )
    );
  return {
    actorHour: Number(r?.actorHour ?? 0),
    actorDay: Number(r?.actorDay ?? 0),
    ipHour: Number(r?.ipHour ?? 0),
    ipDay: Number(r?.ipDay ?? 0),
  };
}

/**
 * Reuse a recent non-failed audit for the same owner + host, else insert.
 * An advisory transaction lock serializes concurrent submits of the same site.
 */
export async function createOrReuseAudit(input: {
  ownerIds: string[];
  actorId: string;
  websiteUrl: string;
  host: string;
  ipHash: string;
  beforeInsert: () => Promise<{ allowed: boolean }>;
}): Promise<{ row: AuditRow; reused: boolean } | { limited: true }> {
  const since = new Date(Date.now() - REUSE_WINDOW_HOURS * 3_600_000).toISOString();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`audit:${input.actorId}:${input.host}`}))`);
    const [existing] = await tx
      .select()
      .from(marketingAudits)
      .where(
        and(
          inArray(marketingAudits.userId, input.ownerIds),
          eq(marketingAudits.normalizedHost, input.host),
          gte(marketingAudits.createdAt, since),
          inArray(marketingAudits.status, ['queued', 'running', 'completed', 'partial'])
        )
      )
      .orderBy(sql`${marketingAudits.createdAt} desc`)
      .limit(1);
    if (existing) return { row: existing, reused: true };
    const gate = await input.beforeInsert();
    if (!gate.allowed) return { limited: true as const };
    const [row] = await tx
      .insert(marketingAudits)
      .values({
        userId: input.actorId,
        websiteUrl: input.websiteUrl,
        normalizedHost: input.host,
        clientIpHash: input.ipHash,
      })
      .returning();
    return { row, reused: false };
  });
}

/** Atomically claim the right to run. Returns null if another worker holds it. */
export async function acquireAuditLease(id: string, ownerIds: string[]): Promise<AuditRow | null> {
  const now = new Date().toISOString();
  const [row] = await db
    .update(marketingAudits)
    .set({
      status: 'running',
      attemptCount: sql`${marketingAudits.attemptCount} + 1`,
      leaseExpiresAt: new Date(Date.now() + LEASE_SECONDS * 1000).toISOString(),
      error: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(marketingAudits.id, id),
        inArray(marketingAudits.userId, ownerIds),
        lt(marketingAudits.attemptCount, MAX_AUDIT_ATTEMPTS),
        or(
          eq(marketingAudits.status, 'queued'),
          eq(marketingAudits.status, 'failed'),
          and(
            eq(marketingAudits.status, 'running'),
            or(isNull(marketingAudits.leaseExpiresAt), lt(marketingAudits.leaseExpiresAt, now))
          )
        )
      )
    )
    .returning();
  return row ?? null;
}

export function rowToWorkState(row: AuditRow): AuditWorkState {
  const arr = (v: unknown) => (Array.isArray(v) ? [...v] : []);
  return {
    websiteUrl: row.websiteUrl,
    normalizedHost: row.normalizedHost,
    stage: row.stage as AuditStage,
    site: (row.site as AuditWorkState['site']) ?? null,
    brand: (row.brand as AuditWorkState['brand']) ?? null,
    competitors: arr(row.competitors),
    competitorPosts: arr(row.competitorPosts),
    insights: (row.insights as AuditWorkState['insights']) ?? null,
    ideas: arr(row.ideas),
    sources: arr(row.sources),
    limitations: arr(row.limitations),
  };
}

export async function saveAuditProgress(id: string, state: AuditWorkState) {
  await db
    .update(marketingAudits)
    .set({
      stage: state.stage,
      site: state.site,
      brand: state.brand,
      competitors: state.competitors,
      competitorPosts: state.competitorPosts,
      insights: state.insights,
      ideas: state.ideas,
      sources: state.sources,
      limitations: state.limitations,
      leaseExpiresAt: new Date(Date.now() + LEASE_SECONDS * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(marketingAudits.id, id));
}

export async function finishAudit(id: string, status: 'completed' | 'partial') {
  const now = new Date().toISOString();
  await db
    .update(marketingAudits)
    .set({ status, leaseExpiresAt: null, completedAt: now, updatedAt: now })
    .where(eq(marketingAudits.id, id));
}

export async function failAudit(id: string, error: { code: string; message: string }) {
  await db
    .update(marketingAudits)
    .set({ status: 'failed', leaseExpiresAt: null, error, updatedAt: new Date().toISOString() })
    .where(eq(marketingAudits.id, id));
}

export async function selectAuditIdea(id: string, ownerIds: string[], index: number): Promise<AuditRow | null> {
  const [row] = await db
    .update(marketingAudits)
    .set({ selectedIdeaIndex: index, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(marketingAudits.id, id),
        inArray(marketingAudits.userId, ownerIds),
        inArray(marketingAudits.status, ['completed', 'partial'])
      )
    )
    .returning();
  return row ?? null;
}

/** Short-lived lock so double-clicks create exactly one campaign session. */
export async function lockAuditCampaign(id: string, userId: string): Promise<boolean> {
  const now = new Date();
  const stale = new Date(now.getTime() - 60_000).toISOString();
  const rows = await db
    .update(marketingAudits)
    .set({ campaignLockAt: now.toISOString() })
    .where(
      and(
        eq(marketingAudits.id, id),
        eq(marketingAudits.userId, userId),
        isNull(marketingAudits.campaignSessionId),
        or(isNull(marketingAudits.campaignLockAt), lt(marketingAudits.campaignLockAt, stale))
      )
    )
    .returning({ id: marketingAudits.id });
  return rows.length > 0;
}

export async function setAuditCampaign(id: string, sessionId: string | null) {
  await db
    .update(marketingAudits)
    .set({ campaignSessionId: sessionId, campaignLockAt: null, updatedAt: new Date().toISOString() })
    .where(eq(marketingAudits.id, id));
}
