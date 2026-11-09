/**
 * Instagram watch lists for a connected brand: hashtags and competitor accounts.
 * Data is fetched live from Meta and cached for 6 hours. The brand's own account is always
 * included (as "You") so competitors are compared with it.
 */
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/database/client';
import { igHashtagQueries, igStyleReads, igWatchItems } from '@/database/schema';
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { decryptToken } from '@/lib/meta/crypto';
import { metaLog } from '@/lib/meta/log';
import { getUserBrand } from '@/lib/brand-kit/server';
import { cleanHashtag, cleanUsername, discoverAccount, hashtagPosts, IgLookupError } from './api';
import { accountStats, hashtagStats } from './stats';
import { readStyle } from './style';
import type { AccountStats, HashtagStats, InstagramView, StyleRead, WatchItem } from './types';

export const LIMITS = { hashtags: 5, accounts: 5 } as const;
/** Meta allows 30 unique hashtags per Instagram account per 7 days; SkalX stops at 25 to stay clear. */
export const HASHTAG_QUOTA = 25;
export const META_HASHTAG_LIMIT = 30;
export const STYLE_READS_PER_DAY = 3;
const FRESH_MS = 6 * 60 * 60_000;
const WEEK_MS = 7 * 86_400_000;

export class IgWatchError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type Ctx = { connectionId: string; userId: string; igUserId: string; igUsername: string | null; token: string };

async function context(userId: string): Promise<Ctx | null> {
  const conn = await MetaConnectionDAO.getByUser(userId);
  if (!conn || conn.status !== 'active') return null;
  const assets = await MetaConnectionDAO.listAssets(userId);
  const ig = assets.find((a) => a.kind === 'ig_account' && a.selected);
  if (!ig) return null;
  const meta = (ig.metadata ?? {}) as { username?: string };
  const igUsername = meta.username ?? (ig.name ? ig.name.replace(/^@/, '') : null);
  return { connectionId: conn.id, userId, igUserId: ig.metaId, igUsername, token: decryptToken(conn.tokenEnc) };
}

type Row = typeof igWatchItems.$inferSelect;
const fresh = (r: Row) => !!r.lastFetchedAt && Date.now() - new Date(r.lastFetchedAt).getTime() < FRESH_MS;

async function hashtagQuotaUsed(igUserId: string): Promise<number> {
  const since = new Date(Date.now() - WEEK_MS).toISOString();
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(igHashtagQueries)
    .where(and(eq(igHashtagQueries.igUserId, igUserId), gte(igHashtagQueries.windowStartedAt, since)));
  return r?.n ?? 0;
}

/** Counts a hashtag against the weekly limit the way Meta does: from its first query, for 7 days. */
async function claimHashtag(ctx: Ctx, tag: string): Promise<void> {
  const [row] = await db.select().from(igHashtagQueries).where(and(eq(igHashtagQueries.igUserId, ctx.igUserId), eq(igHashtagQueries.hashtag, tag)));
  const inWindow = row && Date.now() - new Date(row.windowStartedAt).getTime() < WEEK_MS;
  if (inWindow) return;
  if ((await hashtagQuotaUsed(ctx.igUserId)) >= HASHTAG_QUOTA) {
    throw new IgWatchError(`You’ve looked up ${HASHTAG_QUOTA} different hashtags this week. Instagram allows ${META_HASHTAG_LIMIT} a week per account, so SkalX pauses new ones until some free up. Your saved hashtags still refresh.`, 429);
  }
  await db.insert(igHashtagQueries).values({ connectionId: ctx.connectionId, igUserId: ctx.igUserId, hashtag: tag, windowStartedAt: new Date().toISOString() })
    .onConflictDoUpdate({ target: [igHashtagQueries.igUserId, igHashtagQueries.hashtag], set: { windowStartedAt: new Date().toISOString(), connectionId: ctx.connectionId } });
}

async function refresh(ctx: Ctx, row: Row): Promise<void> {
  try {
    let data: HashtagStats | AccountStats;
    if (row.kind === 'hashtag') {
      await claimHashtag(ctx, row.value);
      const { top, recent } = await hashtagPosts(ctx.igUserId, ctx.token, row.value);
      data = hashtagStats(row.value, top, recent);
    } else {
      const acct = await discoverAccount(ctx.igUserId, ctx.token, row.value);
      data = accountStats(acct, { isYou: !!ctx.igUsername && row.value === ctx.igUsername.toLowerCase() });
    }
    await db.update(igWatchItems).set({ data, lastFetchedAt: new Date().toISOString(), lastError: null }).where(eq(igWatchItems.id, row.id));
  } catch (err) {
    const message = err instanceof IgLookupError || err instanceof IgWatchError ? err.message : 'Instagram couldn’t load this right now.';
    if (!(err instanceof IgLookupError || err instanceof IgWatchError)) metaLog.error('ig_watch_refresh_failed', { kind: row.kind, message: (err as Error).message });
    await db.update(igWatchItems).set({ lastError: message, lastFetchedAt: new Date().toISOString() }).where(eq(igWatchItems.id, row.id));
  }
}

async function ensureSelf(ctx: Ctx): Promise<void> {
  if (!ctx.igUsername) return;
  await db.insert(igWatchItems).values({ connectionId: ctx.connectionId, userId: ctx.userId, kind: 'account', value: ctx.igUsername.toLowerCase() }).onConflictDoNothing();
}

async function rows(ctx: Ctx): Promise<Row[]> {
  return db.select().from(igWatchItems).where(eq(igWatchItems.connectionId, ctx.connectionId)).orderBy(igWatchItems.createdAt);
}

/** Refresh anything older than 6 hours (or everything when forced), a few at a time. */
async function refreshStale(ctx: Ctx, list: Row[], force = false): Promise<void> {
  const stale = list.filter((r) => force || !fresh(r));
  for (let i = 0; i < stale.length; i += 3) await Promise.all(stale.slice(i, i + 3).map((r) => refresh(ctx, r)));
}

const toItem = <T>(r: Row): WatchItem<T> => ({ id: r.id, value: r.value, data: (r.data as T) ?? null, fetchedAt: r.lastFetchedAt, error: r.lastError });

const startOfDay = () => new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

export async function instagramView(userId: string, opts: { force?: boolean } = {}): Promise<InstagramView> {
  const ctx = await context(userId);
  if (!ctx) {
    return { connected: false, igUsername: null, you: null, hashtags: [], accounts: [], hashtagQuota: { used: 0, limit: HASHTAG_QUOTA, metaLimit: META_HASHTAG_LIMIT }, limits: LIMITS, style: null, styleReadsLeftToday: 0 };
  }
  await ensureSelf(ctx);
  await refreshStale(ctx, await rows(ctx), opts.force);
  const list = await rows(ctx);
  const self = ctx.igUsername?.toLowerCase() ?? null;
  const [style] = await db.select().from(igStyleReads).where(and(eq(igStyleReads.connectionId, ctx.connectionId), eq(igStyleReads.status, 'succeeded'))).orderBy(desc(igStyleReads.createdAt)).limit(1);
  const [reads] = await db.select({ n: sql<number>`count(*)::int` }).from(igStyleReads).where(and(eq(igStyleReads.connectionId, ctx.connectionId), gte(igStyleReads.createdAt, startOfDay())));
  const youRow = list.find((r) => r.kind === 'account' && r.value === self);
  return {
    connected: true,
    igUsername: ctx.igUsername,
    you: (youRow?.data as AccountStats) ?? null,
    hashtags: list.filter((r) => r.kind === 'hashtag').map((r) => toItem<HashtagStats>(r)),
    accounts: list.filter((r) => r.kind === 'account' && r.value !== self).map((r) => toItem<AccountStats>(r)),
    hashtagQuota: { used: await hashtagQuotaUsed(ctx.igUserId), limit: HASHTAG_QUOTA, metaLimit: META_HASHTAG_LIMIT },
    limits: LIMITS,
    style: style ? { output: style.output as StyleRead, createdAt: style.createdAt, dropped: (style.dropped as unknown[]).length } : null,
    styleReadsLeftToday: Math.max(0, STYLE_READS_PER_DAY - (reads?.n ?? 0)),
  };
}

async function requireCtx(userId: string): Promise<Ctx> {
  const ctx = await context(userId);
  if (!ctx) throw new IgWatchError('Connect Meta with an Instagram business account first (Settings → Integrations).', 409);
  return ctx;
}

export async function addWatch(userId: string, kind: 'hashtag' | 'account', raw: string): Promise<void> {
  const ctx = await requireCtx(userId);
  const value = kind === 'hashtag' ? cleanHashtag(raw) : cleanUsername(raw);
  if (!value) throw new IgWatchError(kind === 'hashtag' ? 'Type a hashtag with letters or numbers only (no spaces or emoji).' : 'Type an Instagram username, like @brandname.');
  if (kind === 'account' && value === ctx.igUsername?.toLowerCase()) throw new IgWatchError('That’s your own account. It’s already shown as “You”.');
  const existing = (await rows(ctx)).filter((r) => r.kind === kind && r.value !== ctx.igUsername?.toLowerCase());
  if (existing.some((r) => r.value === value)) return;
  const max = kind === 'hashtag' ? LIMITS.hashtags : LIMITS.accounts;
  if (existing.length >= max) throw new IgWatchError(`You can watch up to ${max} ${kind === 'hashtag' ? 'hashtags' : 'accounts'}. Remove one first.`);
  if (kind === 'hashtag') await claimHashtag(ctx, value); // check the weekly limit before saving
  const [row] = await db.insert(igWatchItems).values({ connectionId: ctx.connectionId, userId, kind, value }).onConflictDoNothing().returning();
  if (row) await refresh(ctx, row);
}

export async function removeWatch(userId: string, id: string): Promise<void> {
  const ctx = await requireCtx(userId);
  await db.delete(igWatchItems).where(and(eq(igWatchItems.id, id), eq(igWatchItems.connectionId, ctx.connectionId), sql`${igWatchItems.value} <> ${ctx.igUsername?.toLowerCase() ?? ''}`));
}

export async function runStyleRead(userId: string, deps?: Parameters<typeof readStyle>[0]['deps']): Promise<void> {
  const ctx = await requireCtx(userId);
  const view = await instagramView(userId);
  if (view.styleReadsLeftToday <= 0) throw new IgWatchError('You’ve read competitor styles a few times today. Try again tomorrow.', 429);
  const accounts = [view.you, ...view.accounts.map((a) => a.data)].filter((a): a is AccountStats => !!a);
  if (!accounts.some((a) => !a.isYou)) throw new IgWatchError('Add at least one competitor first.');
  const { snapshot } = await getUserBrand(userId).catch(() => ({ snapshot: null }));
  try {
    const r = await readStyle({
      brand: { name: snapshot?.name ?? null, category: snapshot?.industry ?? null, offering: snapshot?.offering ?? null, tone: snapshot?.tone ?? null },
      accounts, deps,
    });
    await db.insert(igStyleReads).values({ connectionId: ctx.connectionId, userId, status: 'succeeded', output: r.output, dropped: r.dropped, model: r.model, usage: r.usage as object });
  } catch (err) {
    await db.insert(igStyleReads).values({ connectionId: ctx.connectionId, userId, status: 'failed', error: (err as Error).message.slice(0, 500) });
    throw new IgWatchError((err as Error).message || 'The style read didn’t work. Try again.', 502);
  }
}
