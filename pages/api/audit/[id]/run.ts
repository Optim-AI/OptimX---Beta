import type { NextApiRequest, NextApiResponse } from 'next';
import { canAccessAudit, toPublicAudit } from '@/lib/audit/access';
import { AuditStageError, defaultAuditDeps, finalStatus, runAuditStages } from '@/lib/audit/pipeline';
import {
  acquireAuditLease,
  failAudit,
  finishAudit,
  getAudit,
  getAuditViewer,
  rowToWorkState,
  saveAuditProgress,
  viewerOwnerIds,
} from '@/lib/audit/store';

export const config = { maxDuration: 300 };

/**
 * POST /api/audit/:id/run — execute remaining research stages under a lease.
 * Concurrent or repeated calls get the current state instead of a second run.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const id = String(req.query.id || '');
  try {
    const viewer = await getAuditViewer(req);
    const existing = await getAudit(id);
    if (!existing || !canAccessAudit(existing.userId, viewer)) {
      return res.status(404).json({ ok: false, code: 'not_found', error: 'Audit not found.' });
    }
    const leased = await acquireAuditLease(id, viewerOwnerIds(viewer));
    if (!leased) {
      return res.status(202).json({ ok: true, running: false, audit: toPublicAudit(existing, viewer) });
    }

    const state = rowToWorkState(leased);
    try {
      await runAuditStages(state, defaultAuditDeps(), (_stage, s) => saveAuditProgress(id, s));
      await finishAudit(id, finalStatus(state));
    } catch (e) {
      const err =
        e instanceof AuditStageError
          ? { code: e.code, message: e.message }
          : { code: 'research_failed', message: 'Research was interrupted. You can retry — completed steps are kept.' };
      if (!(e instanceof AuditStageError)) console.error('[audit] run failed', (e as Error)?.message);
      await failAudit(id, err);
    }
    const row = await getAudit(id);
    return res.status(200).json({ ok: true, running: false, audit: row ? toPublicAudit(row, viewer) : null });
  } catch (e) {
    console.error('[audit] run handler failed', (e as Error)?.message);
    return res.status(500).json({ ok: false, code: 'server_error', error: 'Something went wrong running your audit.' });
  }
}
