/** Shared state for one sync run: token, Graph options (injectable for tests), counters, errors. */
import type { GraphCallOptions } from '@/lib/meta/graph';
import type { MetaUsage } from '@/lib/meta/usage';
import { metaLog } from '@/lib/meta/log';

export type SyncError = { step: string; account?: string; message: string; code?: number };

export type SyncContext = {
  runId: string;
  connectionId: string;
  userId: string;
  token: string;
  graph: GraphCallOptions;
  counts: Record<string, number>;
  errors: SyncError[];
  dataChanged: boolean;
  maxUsagePct: number;
};

export function createContext(input: {
  runId: string; connectionId: string; userId: string; token: string;
  fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>;
}): SyncContext {
  const ctx: SyncContext = {
    runId: input.runId, connectionId: input.connectionId, userId: input.userId, token: input.token,
    counts: {}, errors: [], dataChanged: false, maxUsagePct: 0,
    graph: {},
  };
  ctx.graph = {
    fetchImpl: input.fetchImpl,
    sleep: input.sleep,
    onUsage: (u: MetaUsage) => { ctx.maxUsagePct = Math.max(ctx.maxUsagePct, u.maxPct); },
  };
  return ctx;
}

export function bump(ctx: SyncContext, key: string, n = 1) {
  ctx.counts[key] = (ctx.counts[key] ?? 0) + n;
}

export function recordError(ctx: SyncContext, step: string, err: unknown, account?: string) {
  const e = err as { message?: string; code?: number };
  ctx.errors.push({ step, account, message: String(e?.message ?? err).slice(0, 300), code: e?.code });
  metaLog.warn('sync_step_failed', { runId: ctx.runId, step, account, message: e?.message, code: e?.code });
}
