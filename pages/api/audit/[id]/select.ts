import type { NextApiRequest, NextApiResponse } from 'next';
import { canAccessAudit, toPublicAudit } from '@/lib/audit/access';
import { getAudit, getAuditViewer, selectAuditIdea, viewerOwnerIds } from '@/lib/audit/store';

/** POST /api/audit/:id/select { index } — remember which idea the visitor picked. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const index = Number(req.body?.index);
  if (!Number.isInteger(index) || index < 0 || index > 2) {
    return res.status(400).json({ ok: false, code: 'invalid_index', error: 'Choose one of the three ideas.' });
  }
  try {
    const id = String(req.query.id || '');
    const viewer = await getAuditViewer(req);
    const existing = await getAudit(id);
    if (!existing || !canAccessAudit(existing.userId, viewer)) {
      return res.status(404).json({ ok: false, code: 'not_found', error: 'Audit not found.' });
    }
    if (!Array.isArray(existing.ideas) || !existing.ideas[index]) {
      return res.status(409).json({ ok: false, code: 'not_ready', error: 'Ideas are not ready yet.' });
    }
    const row = await selectAuditIdea(id, viewerOwnerIds(viewer), index);
    if (!row) return res.status(409).json({ ok: false, code: 'not_ready', error: 'Ideas are not ready yet.' });
    return res.status(200).json({ ok: true, audit: toPublicAudit(row, viewer) });
  } catch (e) {
    console.error('[audit] select failed', (e as Error)?.message);
    return res.status(500).json({ ok: false, code: 'server_error', error: "We couldn't save your choice." });
  }
}
