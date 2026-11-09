// GET  /api/meta-intel/insights → latest AI insights + whether an analysis is running
// POST /api/meta-intel/insights → re-run the analysis now (limited per day; skipped if nothing changed)
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { MetaConnectionDAO } from '@/database';
import { latestInsight, runningInsight, manualRunsLastDay } from '@/lib/meta-intel/insights-store';
import { enqueueAnalysis } from '@/lib/meta-intel/enqueue-analysis';
import { SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { metaLog } from '@/lib/meta/log';
import type { Insights } from '@/lib/meta-intel/insights-types';
import { refsFromInput, type InsightRef } from '@/lib/meta-intel/insight-refs';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/database/client';
import { metaOrganicPosts } from '@/database/schema';

export const MANUAL_RUNS_PER_DAY = 5;

export type InsightsResponse = {
  insight: { id: string; output: Insights; createdAt: string; periodSince: string | null; periodUntil: string | null; rangeDays: number; mode: 'ads' | 'posts'; refs: Record<string, InsightRef> } | null;
  running: boolean;
  lastError: string | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  res.setHeader('Cache-Control', 'private, no-store');

  try {
    const conn = await MetaConnectionDAO.getByUser(userId);
    if (!conn) return res.status(404).json({ error: 'not_connected' });

    if (req.method === 'GET') {
      const [ok, running, latest] = await Promise.all([latestInsight(conn.id, 'succeeded'), runningInsight(conn.id), latestInsight(conn.id)]);
      const body: InsightsResponse = {
        insight: ok ? {
          id: ok.id, output: ok.output as Insights, createdAt: ok.createdAt, periodSince: ok.periodSince, periodUntil: ok.periodUntil,
          rangeDays: ok.rangeDays, mode: (ok.input as { analysis?: string } | null)?.analysis === 'posts' ? 'posts' : 'ads',
          refs: ok ? await withPostThumbnails(conn.id, refsFromInput(ok.input)) : {},
        } : null,
        running: !!running,
        lastError: latest?.status === 'failed' ? 'The last analysis did not finish.' : null,
      };
      return res.status(200).json(body);
    }

    if (req.method === 'POST') {
      if (conn.status !== 'active') return res.status(409).json({ error: 'not_active', message: 'Reconnect Meta first.' });
      if (await runningInsight(conn.id)) return res.status(202).json({ ok: true, running: true });
      if ((await manualRunsLastDay(conn.id)) >= MANUAL_RUNS_PER_DAY) {
        return res.status(429).json({ error: 'limit', message: 'You’ve refreshed insights several times today. New insights arrive automatically after each sync.' });
      }
      await enqueueAnalysis({ userId, trigger: 'manual' });
      return res.status(202).json({ ok: true, running: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    if (err instanceof SyncNotConfiguredError) {
      return res.status(503).json({ error: 'not_configured', message: 'AI insights are not set up yet. Please contact support.' });
    }
    metaLog.error('insights_api_failed', { userId, message: (err as Error).message });
    return res.status(500).json({ error: 'insights_failed' });
  }
}

/** Post pictures for the insight cards (ads get theirs from the dashboard's ad list). */
async function withPostThumbnails(connectionId: string, refs: Record<string, InsightRef>): Promise<Record<string, InsightRef>> {
  const ids = Object.entries(refs).filter(([, r]) => r.kind === 'post').map(([id]) => id);
  if (!ids.length) return refs;
  const rows = await db.select({ id: metaOrganicPosts.metaId, url: metaOrganicPosts.thumbnailUrl }).from(metaOrganicPosts)
    .where(and(eq(metaOrganicPosts.connectionId, connectionId), inArray(metaOrganicPosts.metaId, ids)));
  for (const r of rows) if (refs[r.id]) refs[r.id] = { ...refs[r.id], thumbnailUrl: r.url ?? null };
  return refs;
}
