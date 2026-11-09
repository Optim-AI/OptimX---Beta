// GET   /api/meta-intel/brief → latest Monday brief + whether one is being built + email setting
// POST  /api/meta-intel/brief { send?: boolean } → build last week's brief now (limited per day)
// PATCH /api/meta-intel/brief { emailEnabled: boolean } → Monday email on/off
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { MetaConnectionDAO } from '@/database';
import { latestReadyBrief, buildingBrief, manualBriefsToday, setBriefEmailEnabled } from '@/lib/weekly-brief/store';
import { enqueueBrief } from '@/lib/weekly-brief/enqueue';
import { SyncNotConfiguredError } from '@/lib/meta-sync/enqueue';
import { metaLog } from '@/lib/meta/log';
import type { BriefContent } from '@/lib/weekly-brief/content';

// Starts background work that keeps running after the response (lib/jobs/background).
export const config = { maxDuration: 300 };

export const MANUAL_BRIEFS_PER_DAY = 3;

export type BriefResponse = {
  brief: { id: string; weekStart: string; weekEnd: string; content: BriefContent; delivery: Record<string, { status: string; at: string }>; createdAt: string } | null;
  building: boolean;
  emailEnabled: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const conn = await MetaConnectionDAO.getByUser(userId);
    if (!conn) return res.status(404).json({ error: 'not_connected' });

    if (req.method === 'GET') {
      const [b, building] = await Promise.all([latestReadyBrief(conn.id), buildingBrief(conn.id)]);
      const body: BriefResponse = {
        brief: b ? { id: b.id, weekStart: b.weekStart, weekEnd: b.weekEnd, content: b.content as BriefContent, delivery: (b.delivery ?? {}) as Record<string, { status: string; at: string }>, createdAt: b.createdAt } : null,
        building: !!building,
        emailEnabled: conn.briefEmailEnabled,
      };
      return res.status(200).json(body);
    }
    if (req.method === 'POST') {
      if (conn.status !== 'active') return res.status(409).json({ error: 'not_active', message: 'Reconnect Meta first.' });
      if (await buildingBrief(conn.id)) return res.status(202).json({ ok: true, building: true });
      if ((await manualBriefsToday(conn.id)) >= MANUAL_BRIEFS_PER_DAY) {
        return res.status(429).json({ error: 'limit', message: 'You’ve built the brief a few times today. It updates automatically every Monday.' });
      }
      await enqueueBrief({ userId, trigger: 'manual', send: (req.body ?? {}).send === true });
      return res.status(202).json({ ok: true, building: true });
    }
    if (req.method === 'PATCH') {
      const enabled = (req.body ?? {}).emailEnabled;
      if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'bad_request' });
      await setBriefEmailEnabled(userId, enabled);
      return res.status(200).json({ ok: true, emailEnabled: enabled });
    }
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    if (err instanceof SyncNotConfiguredError) return res.status(503).json({ error: 'not_configured', message: 'The Monday brief is not set up yet. Please contact support.' });
    metaLog.error('brief_api_failed', { userId, message: (err as Error).message });
    return res.status(500).json({ error: 'brief_failed' });
  }
}
