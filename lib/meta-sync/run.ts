/**
 * Runs one queued sync end to end. Called in the background after a request, or by the hourly cron.
 * Steps per selected ad account: account info → structure → insights → back-fill → creatives;
 * then creative images, SKX tagging, organic (Instagram + Page).
 * A failing step is recorded and the run continues; auth errors stop the run and mark the
 * connection so the UI asks the user to reconnect.
 */
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { decryptToken } from '@/lib/meta/crypto';
import { MetaGraphError } from '@/lib/meta/graph';
import { metaLog } from '@/lib/meta/log';
import { syncRange, todayInTz } from './dates';
import { detectMadeBySkalx } from './skx';
import * as store from './store';
import { createContext, recordError, type SyncContext } from './context';
import { refreshAccount, syncStructure, syncInsights, backfillFromInsights, syncCreatives } from './ads';
import { copyCreativeImages, type ImageStorage } from './images';
import { syncInstagram, syncPage } from './organic';

export type RunDeps = { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; storage?: ImageStorage; imageFetch?: typeof fetch };

export type RunResult = {
  runId: string;
  userId?: string;
  status: 'succeeded' | 'partial' | 'failed' | 'skipped';
  dataChanged: boolean;
  counts: Record<string, number>;
  errors: number;
};

/** A run stuck in running longer than this is treated as dead. */
const STALE_RUN_MS = 3 * 60 * 60 * 1000;

export async function tagSkalxAds(ctx: SyncContext) {
  const md5s = await store.skalxMd5sForUser(ctx.userId);
  const ads = await store.adsForSkxTagging(ctx.connectionId);
  const updates = ads
    .map((a) => ({ a, r: detectMadeBySkalx({ adName: a.name, imageHash: a.imageHash, storedMd5: a.storedMd5 }, md5s) }))
    .filter(({ a, r }) => a.made !== r.made || (a.reason ?? null) !== r.reason)
    .map(({ a, r }) => ({ metaId: a.metaId, made: r.made, reason: r.reason }));
  if (updates.length) {
    await store.setSkxFlags(ctx.connectionId, updates);
    ctx.dataChanged = true;
  }
  const finalFlag = new Map(updates.map((u) => [u.metaId, u.made]));
  ctx.counts.skalx_ads = ads.filter((a) => finalFlag.get(a.metaId) ?? a.made).length;
}

export async function runQueuedSync(runId: string, deps: RunDeps = {}): Promise<RunResult> {
  const run = await store.getRun(runId);
  if (!run) throw new Error(`sync run ${runId} not found`);
  if (run.status !== 'queued' && run.status !== 'running') {
    return { runId, status: 'skipped', dataChanged: false, counts: {}, errors: 0 };
  }

  const conn = await MetaConnectionDAO.getByUser(run.userId);
  if (!conn || conn.id !== run.connectionId || conn.status !== 'active' || !conn.tokenEnc) {
    await store.updateRun(runId, { status: 'failed', finishedAt: new Date().toISOString(), errors: [{ step: 'start', message: 'Connection is not active' }] });
    return { runId, status: 'failed', dataChanged: false, counts: {}, errors: 1 };
  }

  await store.updateRun(runId, { status: 'running', startedAt: run.startedAt ?? new Date().toISOString() });
  const ctx = createContext({ runId, connectionId: conn.id, userId: conn.userId, token: decryptToken(conn.tokenEnc), fetchImpl: deps.fetchImpl, sleep: deps.sleep });
  const assets = await MetaConnectionDAO.listAssets(conn.userId);
  const adAccounts = assets.filter((a) => a.kind === 'ad_account' && a.selected);
  const page = assets.find((a) => a.kind === 'page' && a.selected);
  const ig = assets.find((a) => a.kind === 'ig_account' && a.selected);
  const previous = await store.lastCompletedRun(conn.id);

  const bounds: { since: string | null; until: string | null } = { since: null, until: null };
  let authFailure: MetaGraphError | null = null;

  const guard = async (step: string, fn: () => Promise<unknown>, account?: string) => {
    if (authFailure) return;
    try {
      await fn();
    } catch (err) {
      if (err instanceof MetaGraphError && err.isAuthError) authFailure = err;
      recordError(ctx, step, err, account);
    }
  };

  for (const acct of adAccounts) {
    let info = { currency: acct.currency, timezoneName: acct.timezoneName };
    await guard('account', async () => { info = await refreshAccount(ctx, acct.metaId); }, acct.metaId);
    const range = syncRange(run.kind as 'full' | 'incremental', info.timezoneName, previous?.rangeUntil ?? null);
    if (!bounds.since || range.since < bounds.since) bounds.since = range.since;
    if (!bounds.until || range.until > bounds.until) bounds.until = range.until;

    await guard('structure', () => syncStructure(ctx, acct.metaId), acct.metaId);
    let rows: Awaited<ReturnType<typeof syncInsights>> = [];
    await guard('insights', async () => { rows = await syncInsights(ctx, acct.metaId, range, info); }, acct.metaId);
    await guard('backfill', () => backfillFromInsights(ctx, acct.metaId, rows), acct.metaId);
    await guard('creatives', async () => {
      await syncCreatives(ctx, acct.metaId, await store.creativeIdsForAccount(ctx.connectionId, acct.metaId));
    }, acct.metaId);
  }

  await guard('images', () => copyCreativeImages(ctx, { storage: deps.storage, fetchImpl: deps.imageFetch }));
  await guard('skx_tagging', () => tagSkalxAds(ctx));

  const orgTz = adAccounts[0]?.timezoneName ?? 'Asia/Kolkata';
  const today = todayInTz(orgTz);
  if (ig) await guard('instagram', () => syncInstagram(ctx, ig.metaId, today), ig.metaId);
  if (page) await guard('facebook_page', () => syncPage(ctx, page.metaId, page.pageTokenEnc, today), page.metaId);

  const somethingSynced = Object.entries(ctx.counts).some(([k, v]) => v > 0 && !k.endsWith('_failed'));
  const status: RunResult['status'] = authFailure || (!somethingSynced && ctx.errors.length)
    ? 'failed'
    : ctx.errors.length ? 'partial' : 'succeeded';

  if (authFailure) {
    const e = authFailure as MetaGraphError;
    await MetaConnectionDAO.updateHealth(conn.id, { status: 'expired', lastError: e.message.slice(0, 300) });
  }
  if (status !== 'failed') await store.setLastSync(conn.id);

  await store.updateRun(runId, {
    status, finishedAt: new Date().toISOString(), counts: { ...ctx.counts, max_usage_pct: ctx.maxUsagePct },
    errors: ctx.errors.slice(0, 50), dataChanged: ctx.dataChanged, rangeSince: bounds.since, rangeUntil: bounds.until,
  });
  metaLog.info('sync_finished', { runId, connectionId: conn.id, status, counts: ctx.counts, errors: ctx.errors.length });
  return { runId, userId: conn.userId, status, dataChanged: ctx.dataChanged, counts: ctx.counts, errors: ctx.errors.length };
}

/**
 * Create a queued run unless one is already active. A run stuck past STALE_RUN_MS is failed first.
 * Returns null when another sync is genuinely in progress.
 */
export async function createQueuedRun(input: { connectionId: string; userId: string; trigger: 'initial' | 'schedule' | 'manual'; kind?: 'full' | 'incremental' }) {
  const active = await store.activeRun(input.connectionId);
  if (active) {
    const age = Date.now() - Date.parse(active.startedAt ?? active.createdAt);
    if (age < STALE_RUN_MS) return null;
    await store.updateRun(active.id, { status: 'failed', finishedAt: new Date().toISOString(), errors: [{ step: 'watchdog', message: 'Run did not finish in time' }] });
  }
  const previous = await store.lastCompletedRun(input.connectionId);
  const kind = input.kind ?? (previous ? 'incremental' : 'full');
  return store.insertQueuedRun({ connectionId: input.connectionId, userId: input.userId, trigger: input.trigger, kind });
}
