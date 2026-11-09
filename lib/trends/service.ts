/**
 * Trends for a brand:
 *  - one shared trend list per category per day (India), so brands in the same category share the search cost
 *  - per brand: fit + ideas, stored in brand_trend_ideas
 * Runs in the background (Trigger.dev, or inline in local dev).
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { brandTrendIdeas, trendSnapshots } from '@/database/schema';
import { metaLog } from '@/lib/meta/log';
import { groundedTrendSearch, structureTrends, youtubeTrending } from './find';
import { brandContext, categoryKey, fitTrends } from './fit';
import type { BrandTrend, Trend, TrendsResponse } from './types';

export const REFRESHES_PER_DAY = 3;
const RUN_STALE_MS = 15 * 60_000;
const SNAPSHOT_WAIT_MS = 4 * 60_000;

export class TrendsError extends Error {
  constructor(message: string, readonly status = 400, readonly code = 'BAD_REQUEST') {
    super(message);
  }
}

/** Today's date in India (trend lists are per Indian day). */
export function todayIST(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

type SnapshotRow = typeof trendSnapshots.$inferSelect;

async function buildSnapshot(row: SnapshotRow): Promise<SnapshotRow> {
  try {
    const today = row.day;
    const [grounded, videos] = await Promise.all([groundedTrendSearch(row.categoryLabel, today), youtubeTrending()]);
    const structured = await structureTrends(grounded.blocks, today);
    const trends: Trend[] = [...structured.trends, ...videos];
    if (!trends.length) throw new Error('No trends with sources were found');
    const [done] = await db.update(trendSnapshots).set({
      status: 'succeeded', trends, queries: grounded.queries, model: [grounded.model, structured.model].filter(Boolean).join(' + '),
      usage: { search: grounded.usage, structure: structured.usage, droppedBlocks: structured.dropped }, error: null, finishedAt: new Date().toISOString(),
    }).where(eq(trendSnapshots.id, row.id)).returning();
    metaLog.info('trend_snapshot_built', { category: row.categoryKey, trends: trends.length, dropped: structured.dropped, videos: videos.length });
    return done;
  } catch (err) {
    const message = (err as Error).message.slice(0, 500);
    await db.update(trendSnapshots).set({ status: 'failed', error: message, finishedAt: new Date().toISOString() }).where(eq(trendSnapshots.id, row.id));
    throw err;
  }
}

/** Today's shared list for a category: reuse it, wait for one being built, or build it. */
export async function getOrBuildSnapshot(categoryLabel: string, deps: { sleep?: (ms: number) => Promise<void> } = {}): Promise<SnapshotRow> {
  const key = categoryKey(categoryLabel);
  const day = todayIST();
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const [created] = await db.insert(trendSnapshots).values({ categoryKey: key, categoryLabel, day, status: 'running' })
    .onConflictDoNothing().returning();
  if (created) return buildSnapshot(created);

  const deadline = Date.now() + SNAPSHOT_WAIT_MS;
  for (;;) {
    const [row] = await db.select().from(trendSnapshots).where(and(eq(trendSnapshots.categoryKey, key), eq(trendSnapshots.region, 'IN'), eq(trendSnapshots.day, day)));
    if (!row) throw new Error('Trend list disappeared');
    if (row.status === 'succeeded') return row;
    const stale = Date.now() - new Date(row.createdAt).getTime() > RUN_STALE_MS;
    if (row.status === 'failed' || stale) {
      // Take over a failed or stuck build (only one caller wins the update).
      const [claimed] = await db.update(trendSnapshots).set({ status: 'running', error: null, createdAt: new Date().toISOString() })
        .where(and(eq(trendSnapshots.id, row.id), eq(trendSnapshots.status, row.status), eq(trendSnapshots.createdAt, row.createdAt))).returning();
      if (claimed) return buildSnapshot(claimed);
    }
    if (Date.now() > deadline) throw new Error('Timed out waiting for today’s trend list');
    await sleep(5000);
  }
}

/** The background job: build/reuse today's list, fit it to the brand, store the result. */
export async function runBrandTrends(input: { ideasId: string }): Promise<void> {
  const [row] = await db.select().from(brandTrendIdeas).where(eq(brandTrendIdeas.id, input.ideasId));
  if (!row || row.status !== 'running') return;
  try {
    const ctx = await brandContext(row.userId);
    if (!ctx) throw new TrendsError('Add your brand in Brand Kit first, so SkalX knows what you sell.');
    const snapshot = await getOrBuildSnapshot(ctx.category);
    const fit = await fitTrends(ctx, snapshot.trends as Trend[]);
    await db.update(brandTrendIdeas).set({
      status: 'succeeded', snapshotId: snapshot.id, categoryLabel: ctx.category,
      output: { trends: fit.trends, skipped: fit.skipped }, model: fit.model, usage: fit.usage, error: null, finishedAt: new Date().toISOString(),
    }).where(eq(brandTrendIdeas.id, row.id));
    metaLog.info('brand_trends_ready', { userId: row.userId, trends: fit.trends.length, skipped: fit.skipped });
  } catch (err) {
    const message = err instanceof TrendsError ? err.message : 'SkalX couldn’t check trends just now. Please try again in a few minutes.';
    await db.update(brandTrendIdeas).set({ status: 'failed', error: message, finishedAt: new Date().toISOString() }).where(eq(brandTrendIdeas.id, row.id));
    metaLog.error('brand_trends_failed', { userId: row.userId, message: (err as Error).message });
  }
}

const startOfIstDay = () => new Date(`${todayIST()}T00:00:00+05:30`).toISOString();

async function refreshesUsedToday(userId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(brandTrendIdeas)
    .where(and(eq(brandTrendIdeas.userId, userId), eq(brandTrendIdeas.trigger, 'manual'), gte(brandTrendIdeas.createdAt, startOfIstDay())));
  return r?.n ?? 0;
}

/** Start a refresh (one at a time, a few per day). Returns the new row id, or the running one. */
export async function startBrandTrends(userId: string, trigger: 'manual' | 'schedule' = 'manual'): Promise<{ id: string; started: boolean }> {
  const [latest] = await db.select().from(brandTrendIdeas).where(eq(brandTrendIdeas.userId, userId)).orderBy(desc(brandTrendIdeas.createdAt)).limit(1);
  if (latest?.status === 'running' && Date.now() - new Date(latest.createdAt).getTime() < RUN_STALE_MS) return { id: latest.id, started: false };
  if (trigger === 'manual' && (await refreshesUsedToday(userId)) >= REFRESHES_PER_DAY) {
    throw new TrendsError('You’ve refreshed trends a few times today. New trends arrive tomorrow.', 429, 'LIMIT');
  }
  const ctx = await brandContext(userId);
  if (!ctx) throw new TrendsError('Add your brand in Brand Kit first, so SkalX knows what you sell.', 409, 'NO_BRAND');
  const [row] = await db.insert(brandTrendIdeas).values({ userId, trigger, status: 'running', categoryLabel: ctx.category }).returning();
  return { id: row.id, started: true };
}

export async function trendsView(userId: string): Promise<TrendsResponse> {
  const rows = await db.select().from(brandTrendIdeas).where(eq(brandTrendIdeas.userId, userId)).orderBy(desc(brandTrendIdeas.createdAt)).limit(5);
  const running = rows.find((r) => r.status === 'running' && Date.now() - new Date(r.createdAt).getTime() < RUN_STALE_MS);
  const ok = rows.find((r) => r.status === 'succeeded');
  const latest = rows[0];
  const used = await refreshesUsedToday(userId);
  const out = (ok?.output ?? null) as { trends?: BrandTrend[]; skipped?: number } | null;
  let day: string | null = null;
  if (ok?.snapshotId) {
    const [s] = await db.select({ day: trendSnapshots.day }).from(trendSnapshots).where(eq(trendSnapshots.id, ok.snapshotId));
    day = s?.day ?? null;
  }
  return {
    state: running ? 'running' : ok ? 'ready' : latest?.status === 'failed' ? 'failed' : 'none',
    category: ok?.categoryLabel ?? latest?.categoryLabel ?? null,
    updatedAt: ok?.finishedAt ?? null,
    day,
    trends: out?.trends ?? [],
    skipped: out?.skipped ?? 0,
    error: latest?.status === 'failed' ? latest.error : null,
    refreshesLeftToday: Math.max(0, REFRESHES_PER_DAY - used),
  };
}
