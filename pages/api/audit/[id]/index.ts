import type { NextApiRequest, NextApiResponse } from 'next';
import { canAccessAudit, toPublicAudit } from '@/lib/audit/access';
import { getAudit, getAuditViewer } from '@/lib/audit/store';

/** GET /api/audit/:id — owner-only public view. Unknown and foreign ids both 404. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const id = String(req.query.id || '');
    const [row, viewer] = await Promise.all([getAudit(id), getAuditViewer(req)]);
    if (!row || !canAccessAudit(row.userId, viewer)) {
      return res.status(404).json({ ok: false, code: 'not_found', error: 'Audit not found.' });
    }
    return res.status(200).json({ ok: true, audit: toPublicAudit(row, viewer) });
  } catch (e) {
    console.error('[audit] get failed', (e as Error)?.message);
    return res.status(500).json({ ok: false, code: 'server_error', error: "We couldn't load this audit." });
  }
}
