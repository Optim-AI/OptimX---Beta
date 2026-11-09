// GET  /api/meta-intel/sync → latest sync run (status, counts, error count)
// POST /api/meta-intel/sync → "Sync now"
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { MetaConnectionDAO } from '@/database';
import { enqueueSync, SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { latestRuns, type SyncRunRow } from '@/lib/meta-sync/store';
import { metaLog } from '@/lib/meta/log';

const MANUAL_COOLDOWN_MS = 5 * 60 * 1000;

export type SyncRunView = {
  id: string;
  status: SyncRunRow['status'];
  kind: string;
  trigger: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  counts: Record<string, number>;
  errorCount: number;
  rangeSince: string | null;
  rangeUntil: string | null;
};

export function toRunView(r: SyncRunRow): SyncRunView {
  return {
    id: r.id, status: r.status, kind: r.kind, trigger: r.trigger, createdAt: r.createdAt, startedAt: r.startedAt,
    finishedAt: r.finishedAt, counts: (r.counts ?? {}) as Record<string, number>,
    errorCount: Array.isArray(r.errors) ? r.errors.length : 0, rangeSince: r.rangeSince, rangeUntil: r.rangeUntil,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  res.setHeader('Cache-Control', 'no-store');

  try {
    const conn = await MetaConnectionDAO.getByUser(userId);
    if (!conn) return res.status(404).json({ error: 'not_connected' });

    if (req.method === 'GET') {
      const [latest] = await latestRuns(conn.id, 1);
      return res.status(200).json({ run: latest ? toRunView(latest) : null });
    }

    if (req.method === 'POST') {
      if (conn.status !== 'active') {
        return res.status(409).json({ error: 'not_active', message: 'Finish connecting your Meta account first.' });
      }
      const [latest] = await latestRuns(conn.id, 1);
      if (latest?.trigger === 'manual' && Date.now() - Date.parse(latest.createdAt) < MANUAL_COOLDOWN_MS && latest.status !== 'failed') {
        return res.status(429).json({ error: 'cooldown', message: 'A sync just ran. Please wait a few minutes before syncing again.' });
      }
      const result = await enqueueSync({ connectionId: conn.id, userId, trigger: 'manual' });
      if (!result.queued) return res.status(409).json({ error: 'already_running', message: 'A sync is already running.' });
      return res.status(202).json({ ok: true, runId: result.runId });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    if (err instanceof SyncNotConfiguredError) {
      return res.status(503).json({ error: 'not_configured', message: 'Syncing is not set up yet. Please contact support.' });
    }
    metaLog.error('sync_api_failed', { userId, message: (err as Error).message });
    return res.status(500).json({ error: 'sync_failed' });
  }
}
