/**
 * Idempotent upserts for synced Meta data. Conflict keys are (connection_id, meta id[, date]).
 * Insight upserts only rewrite rows whose numbers changed, and report how many did,
 * so the run knows whether analysis should re-run.
 */
import { sql, and, eq, inArray, desc } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { db } from '@/database/client';
import {
  metaCampaigns, metaAdsets, metaAds, metaCreatives, metaAdInsightsDaily,
  metaOrganicPosts, metaOrganicPostInsightsDaily, syncRuns, skalxAssetHashes, metaConnections, metaAssets,
} from '@/database/schema';
import type { NormalizedInsight } from './metrics';

const BATCH = 400;

function chunks<T>(rows: T[], size = BATCH): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** `set` object that copies every listed column from EXCLUDED. */
function excludedSet(cols: Record<string, PgColumn>) {
  const set: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(cols)) set[key] = sql.raw(`excluded."${col.name}"`);
  return set;
}

async function upsertRows<T extends PgTable>(
  table: T,
  rows: Record<string, unknown>[],
  target: PgColumn[],
  updateCols: Record<string, PgColumn>,
): Promise<number> {
  let n = 0;
  for (const part of chunks(rows)) {
    if (!part.length) continue;
    await db
      .insert(table)
      .values(part as never)
      .onConflictDoUpdate({ target, set: excludedSet(updateCols) as never });
    n += part.length;
  }
  return n;
}

const now = () => new Date().toISOString();
const iso = (v: unknown) => (typeof v === 'string' && v ? new Date(v).toISOString() : null);
const numStr = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

// ---------- structure ----------

export async function upsertCampaigns(connectionId: string, adAccountId: string, nodes: Record<string, any>[]) {
  const rows = nodes.map((c) => ({
    connectionId, adAccountId, metaId: String(c.id), name: c.name ?? null, objective: c.objective ?? null,
    status: c.status ?? null, effectiveStatus: c.effective_status ?? null,
    dailyBudget: numStr(c.daily_budget), lifetimeBudget: numStr(c.lifetime_budget),
    startTime: iso(c.start_time), stopTime: iso(c.stop_time), createdTime: iso(c.created_time), updatedTime: iso(c.updated_time),
    raw: c, syncedAt: now(),
  }));
  const t = metaCampaigns;
  return upsertRows(t, rows, [t.connectionId, t.metaId], {
    name: t.name, objective: t.objective, status: t.status, effectiveStatus: t.effectiveStatus, dailyBudget: t.dailyBudget,
    lifetimeBudget: t.lifetimeBudget, startTime: t.startTime, stopTime: t.stopTime, createdTime: t.createdTime,
    updatedTime: t.updatedTime, raw: t.raw, syncedAt: t.syncedAt,
  });
}

export async function upsertAdsets(connectionId: string, adAccountId: string, nodes: Record<string, any>[]) {
  const rows = nodes.map((a) => ({
    connectionId, adAccountId, metaId: String(a.id), campaignMetaId: a.campaign_id ? String(a.campaign_id) : null,
    name: a.name ?? null, status: a.status ?? null, effectiveStatus: a.effective_status ?? null,
    optimizationGoal: a.optimization_goal ?? null, billingEvent: a.billing_event ?? null,
    dailyBudget: numStr(a.daily_budget), lifetimeBudget: numStr(a.lifetime_budget),
    createdTime: iso(a.created_time), updatedTime: iso(a.updated_time), raw: a, syncedAt: now(),
  }));
  const t = metaAdsets;
  return upsertRows(t, rows, [t.connectionId, t.metaId], {
    campaignMetaId: t.campaignMetaId, name: t.name, status: t.status, effectiveStatus: t.effectiveStatus,
    optimizationGoal: t.optimizationGoal, billingEvent: t.billingEvent, dailyBudget: t.dailyBudget,
    lifetimeBudget: t.lifetimeBudget, createdTime: t.createdTime, updatedTime: t.updatedTime, raw: t.raw, syncedAt: t.syncedAt,
  });
}

export async function upsertAds(connectionId: string, adAccountId: string, nodes: Record<string, any>[]) {
  const rows = nodes.map((a) => ({
    connectionId, adAccountId, metaId: String(a.id),
    adsetMetaId: a.adset_id ? String(a.adset_id) : null, campaignMetaId: a.campaign_id ? String(a.campaign_id) : null,
    creativeMetaId: a.creative?.id ? String(a.creative.id) : null, name: a.name ?? null, status: a.status ?? null,
    effectiveStatus: a.effective_status ?? null, createdTime: iso(a.created_time), updatedTime: iso(a.updated_time),
    raw: a, syncedAt: now(),
  }));
  const t = metaAds;
  return upsertRows(t, rows, [t.connectionId, t.metaId], {
    adsetMetaId: t.adsetMetaId, campaignMetaId: t.campaignMetaId, creativeMetaId: t.creativeMetaId, name: t.name,
    status: t.status, effectiveStatus: t.effectiveStatus, createdTime: t.createdTime, updatedTime: t.updatedTime,
    raw: t.raw, syncedAt: t.syncedAt,
  });
}

export type CreativeRow = {
  metaId: string; name: string | null; objectType: string | null; title: string | null; body: string | null;
  callToActionType: string | null; imageHash: string | null; videoId: string | null; sourceImageUrl: string | null; raw: unknown;
};

export async function upsertCreatives(connectionId: string, adAccountId: string, creatives: CreativeRow[]) {
  const rows = creatives.map((c) => ({ connectionId, adAccountId, ...c, syncedAt: now() }));
  const t = metaCreatives;
  let n = 0;
  for (const part of chunks(rows)) {
    if (!part.length) continue;
    await db.insert(t).values(part as never).onConflictDoUpdate({
      target: [t.connectionId, t.metaId],
      set: {
        ...excludedSet({
          name: t.name, objectType: t.objectType, title: t.title, body: t.body, callToActionType: t.callToActionType,
          imageHash: t.imageHash, videoId: t.videoId, sourceImageUrl: t.sourceImageUrl, raw: t.raw, syncedAt: t.syncedAt,
        }),
        // Meta CDN urls change on every fetch; only re-copy the image when the image itself changed.
        storedPath: sql`case when (excluded.image_hash, excluded.video_id) is distinct from (${t.imageHash}, ${t.videoId}) then null else ${t.storedPath} end`,
      } as never,
    });
    n += part.length;
  }
  return n;
}

export async function markCreativeImageStored(connectionId: string, metaId: string, storedPath: string, md5: string) {
  await db.update(metaCreatives)
    .set({ storedPath, storedMd5: md5, imageStoredAt: now() })
    .where(and(eq(metaCreatives.connectionId, connectionId), eq(metaCreatives.metaId, metaId)));
}

/** Creatives that still need their image copied (none stored, or the image hash changed since). */
export async function creativesNeedingImages(connectionId: string, limit: number) {
  return db.select({
    metaId: metaCreatives.metaId, adAccountId: metaCreatives.adAccountId, imageHash: metaCreatives.imageHash,
    sourceImageUrl: metaCreatives.sourceImageUrl, storedPath: metaCreatives.storedPath,
  })
    .from(metaCreatives)
    .where(and(
      eq(metaCreatives.connectionId, connectionId),
      sql`${metaCreatives.sourceImageUrl} is not null`,
      sql`${metaCreatives.storedPath} is null`,
    ))
    .limit(limit);
}

export async function creativeIdsForAccount(connectionId: string, adAccountId: string): Promise<string[]> {
  const rows = await db.selectDistinct({ id: metaAds.creativeMetaId }).from(metaAds)
    .where(and(eq(metaAds.connectionId, connectionId), eq(metaAds.adAccountId, adAccountId), sql`${metaAds.creativeMetaId} is not null`));
  return rows.map((r) => r.id).filter((x): x is string => !!x);
}

export async function existingMetaIds(table: typeof metaAds | typeof metaAdsets | typeof metaCampaigns | typeof metaCreatives, connectionId: string, ids: string[]) {
  if (!ids.length) return new Set<string>();
  const found = new Set<string>();
  for (const part of chunks(ids, 1000)) {
    const rows = await db.select({ id: table.metaId }).from(table).where(and(eq(table.connectionId, connectionId), inArray(table.metaId, part)));
    rows.forEach((r) => found.add(r.id));
  }
  return found;
}

// ---------- insights ----------

/** Upsert daily rows; returns how many rows were inserted or actually changed. */
export async function upsertInsights(connectionId: string, adAccountId: string, rows: NormalizedInsight[]): Promise<{ written: number; changed: number }> {
  const t = metaAdInsightsDaily;
  let changed = 0;
  for (const part of chunks(rows)) {
    if (!part.length) continue;
    const values = part.map((r) => ({
      connectionId, adAccountId, adMetaId: r.adMetaId, adsetMetaId: r.adsetMetaId, campaignMetaId: r.campaignMetaId,
      date: r.date, currency: r.currency, spend: String(r.spend), impressions: r.impressions, reach: r.reach,
      frequency: numStr(r.frequency), clicks: r.clicks, linkClicks: r.linkClicks, ctr: numStr(r.ctr), cpc: numStr(r.cpc),
      cpm: numStr(r.cpm), purchases: numStr(r.purchases), revenue: numStr(r.revenue), roas: numStr(r.roas), cpa: numStr(r.cpa),
      purchaseSource: r.purchaseSource, roasSource: r.roasSource, actions: r.actions, actionValues: r.actionValues, syncedAt: now(),
    }));
    const res = await db.insert(t).values(values as never).onConflictDoUpdate({
      target: [t.connectionId, t.adMetaId, t.date],
      set: excludedSet({
        adsetMetaId: t.adsetMetaId, campaignMetaId: t.campaignMetaId, currency: t.currency, spend: t.spend,
        impressions: t.impressions, reach: t.reach, frequency: t.frequency, clicks: t.clicks, linkClicks: t.linkClicks,
        ctr: t.ctr, cpc: t.cpc, cpm: t.cpm, purchases: t.purchases, revenue: t.revenue, roas: t.roas, cpa: t.cpa,
        purchaseSource: t.purchaseSource, roasSource: t.roasSource, actions: t.actions, actionValues: t.actionValues, syncedAt: t.syncedAt,
      }) as never,
      setWhere: sql`(${t.spend}, ${t.impressions}, ${t.clicks}, ${t.purchases}, ${t.revenue}, ${t.reach})
        is distinct from (excluded.spend, excluded.impressions, excluded.clicks, excluded.purchases, excluded.revenue, excluded.reach)`,
    }).returning({ id: t.id });
    changed += res.length;
  }
  return { written: rows.length, changed };
}

// ---------- organic ----------

export type OrganicPostRow = {
  platform: 'instagram' | 'facebook'; accountMetaId: string; metaId: string; mediaType: string | null; caption: string | null;
  permalink: string | null; thumbnailUrl: string | null; postedAt: string | null; raw: unknown;
};

export async function upsertOrganicPosts(connectionId: string, posts: OrganicPostRow[]) {
  const t = metaOrganicPosts;
  return upsertRows(t, posts.map((p) => ({ connectionId, ...p, syncedAt: now() })), [t.connectionId, t.metaId], {
    mediaType: t.mediaType, caption: t.caption, permalink: t.permalink, thumbnailUrl: t.thumbnailUrl,
    postedAt: t.postedAt, raw: t.raw, syncedAt: t.syncedAt,
  });
}

export type OrganicInsightRow = {
  postMetaId: string; date: string; views: number | null; reach: number | null; likes: number | null; comments: number | null;
  saves: number | null; shares: number | null; interactions: number | null; metrics: Record<string, number>;
};

export async function upsertOrganicInsights(connectionId: string, rows: OrganicInsightRow[]) {
  const t = metaOrganicPostInsightsDaily;
  return upsertRows(t, rows.map((r) => ({ connectionId, ...r, syncedAt: now() })), [t.connectionId, t.postMetaId, t.date], {
    views: t.views, reach: t.reach, likes: t.likes, comments: t.comments, saves: t.saves, shares: t.shares,
    interactions: t.interactions, metrics: t.metrics, syncedAt: t.syncedAt,
  });
}

// ---------- SKX tagging ----------

export async function skalxMd5sForUser(userId: string): Promise<Set<string>> {
  const rows = await db.select({ md5: skalxAssetHashes.md5 }).from(skalxAssetHashes).where(eq(skalxAssetHashes.userId, userId));
  return new Set(rows.map((r) => r.md5.toLowerCase()));
}

export async function adsForSkxTagging(connectionId: string) {
  return db.select({
    metaId: metaAds.metaId, name: metaAds.name, made: metaAds.madeBySkalx, reason: metaAds.skxReason,
    imageHash: metaCreatives.imageHash, storedMd5: metaCreatives.storedMd5,
  })
    .from(metaAds)
    .leftJoin(metaCreatives, and(eq(metaCreatives.connectionId, metaAds.connectionId), eq(metaCreatives.metaId, metaAds.creativeMetaId)))
    .where(eq(metaAds.connectionId, connectionId));
}

export async function setSkxFlags(connectionId: string, updates: { metaId: string; made: boolean; reason: string | null }[]) {
  for (const u of updates) {
    await db.update(metaAds).set({ madeBySkalx: u.made, skxReason: u.reason })
      .where(and(eq(metaAds.connectionId, connectionId), eq(metaAds.metaId, u.metaId)));
  }
}

// ---------- runs / connection ----------

export type SyncRunRow = typeof syncRuns.$inferSelect;

export async function insertQueuedRun(input: { connectionId: string; userId: string; kind: 'full' | 'incremental'; trigger: 'initial' | 'schedule' | 'manual' }): Promise<SyncRunRow | null> {
  const res = await db.insert(syncRuns).values({ ...input, status: 'queued' })
    .onConflictDoNothing().returning();
  return res[0] ?? null;
}

export async function getRun(runId: string) {
  const [r] = await db.select().from(syncRuns).where(eq(syncRuns.id, runId)).limit(1);
  return r ?? null;
}

export async function activeRun(connectionId: string) {
  const [r] = await db.select().from(syncRuns)
    .where(and(eq(syncRuns.connectionId, connectionId), inArray(syncRuns.status, ['queued', 'running'])))
    .limit(1);
  return r ?? null;
}

export async function latestRuns(connectionId: string, limit = 5) {
  return db.select().from(syncRuns).where(eq(syncRuns.connectionId, connectionId)).orderBy(desc(syncRuns.createdAt)).limit(limit);
}

/** Last successful/partial run's range end — the incremental sync starts from there. */
export async function lastCompletedRun(connectionId: string) {
  const [r] = await db.select().from(syncRuns)
    .where(and(eq(syncRuns.connectionId, connectionId), inArray(syncRuns.status, ['succeeded', 'partial'])))
    .orderBy(desc(syncRuns.createdAt)).limit(1);
  return r ?? null;
}

export async function updateRun(runId: string, patch: Partial<SyncRunRow>) {
  await db.update(syncRuns).set(patch).where(eq(syncRuns.id, runId));
}

export async function setLastSync(connectionId: string) {
  await db.update(metaConnections).set({ lastSyncAt: now(), updatedAt: now() }).where(eq(metaConnections.id, connectionId));
}

export async function updateAccountInfo(connectionId: string, metaId: string, info: { name?: string | null; currency?: string | null; timezoneName?: string | null; accountStatus?: number | null }) {
  const patch: Record<string, unknown> = { updatedAt: now() };
  if (info.name) patch.name = info.name;
  if (info.currency) patch.currency = info.currency;
  if (info.timezoneName) patch.timezoneName = info.timezoneName;
  if (typeof info.accountStatus === 'number') patch.accountStatus = info.accountStatus;
  await db.update(metaAssets).set(patch)
    .where(and(eq(metaAssets.connectionId, connectionId), eq(metaAssets.kind, 'ad_account'), eq(metaAssets.metaId, metaId)));
}

export async function activeConnectionsWithAccounts() {
  return db.select({
    connectionId: metaConnections.id, userId: metaConnections.userId, timezoneName: metaAssets.timezoneName,
  })
    .from(metaConnections)
    .innerJoin(metaAssets, and(eq(metaAssets.connectionId, metaConnections.id), eq(metaAssets.kind, 'ad_account'), eq(metaAssets.selected, true)))
    .where(eq(metaConnections.status, 'active'));
}
