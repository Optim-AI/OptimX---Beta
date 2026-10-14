import type { NextApiRequest, NextApiResponse } from 'next';
import { canAccessAudit, toPublicAudit } from '@/lib/audit/access';
import {
  classifyAuditPersistError,
  clientMessageForCode,
  logAuditApiError,
  newAuditRequestId,
} from '@/lib/audit/api-errors';
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
  const requestId = newAuditRequestId();
  res.setHeader('x-audit-request-id', requestId);

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      code: 'method_not_allowed',
      requestId,
      error: clientMessageForCode('method_not_allowed'),
    });
  }
  const id = String(req.query.id || '');
  try {
    const viewer = await getAuditViewer(req);
    const existing = await getAudit(id);
    if (!existing || !canAccessAudit(existing.userId, viewer)) {
      return res.status(404).json({
        ok: false,
        code: 'not_found',
        requestId,
        error: clientMessageForCode('not_found'),
      });
    }
    const leased = await acquireAuditLease(id, viewerOwnerIds(viewer));
    if (!leased) {
      return res.status(202).json({
        ok: true,
        running: false,
        requestId,
        audit: toPublicAudit(existing, viewer),
      });
    }

    const state = rowToWorkState(leased);
    try {
      await runAuditStages(state, defaultAuditDeps(), (_stage, s) => saveAuditProgress(id, s));
      await finishAudit(id, finalStatus(state));
    } catch (e) {
      const err =
        e instanceof AuditStageError
          ? { code: e.code, message: e.message }
          : {
              code: 'research_failed',
              message: 'Research was interrupted. You can retry — completed steps are kept.',
            };
      if (!(e instanceof AuditStageError)) {
        logAuditApiError({
          requestId,
          stage: 'run',
          code: err.code,
          detail: 'stage_runner_exception',
          err: e,
          auditId: id,
          host: existing.normalizedHost,
        });
      }
      try {
        await failAudit(id, err);
      } catch (persistErr) {
        logAuditApiError({
          requestId,
          stage: 'persist',
          code: 'database_error',
          detail: 'fail_audit_write',
          err: persistErr,
          auditId: id,
        });
      }
    }
    const row = await getAudit(id);
    return res.status(200).json({
      ok: true,
      running: false,
      requestId,
      audit: row ? toPublicAudit(row, viewer) : null,
    });
  } catch (e) {
    const classified = classifyAuditPersistError(e);
    logAuditApiError({
      requestId,
      stage: 'run',
      code: classified.code === 'server_error' ? 'run_failed' : classified.code,
      detail: classified.detail,
      err: e,
      auditId: id,
    });
    return res.status(classified.status).json({
      ok: false,
      code: classified.code === 'server_error' ? 'run_failed' : classified.code,
      requestId,
      error: classified.code === 'server_error' ? clientMessageForCode('run_failed') : classified.message,
    });
  }
}
