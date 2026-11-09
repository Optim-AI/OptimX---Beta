import type { NextApiRequest, NextApiResponse } from 'next';
import { canAccessAudit } from '@/lib/audit/access';
import { ensureSampleAd, getSampleAd } from '@/lib/audit/sample-ad';
import { getAudit, getAuditViewer } from '@/lib/audit/store';

export const config = { maxDuration: 120 };

/**
 * GET  /api/audit/:id/sample-ad — current sample-ad state.
 * POST /api/audit/:id/sample-ad — generate it once (owner only; one per email lead, daily cap).
 * Unknown and foreign ids both 404.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const id = String(req.query.id || '');
    const [row, viewer] = await Promise.all([getAudit(id), getAuditViewer(req)]);
    if (!row || !canAccessAudit(row.userId, viewer)) {
      return res.status(404).json({ ok: false, code: 'not_found', error: 'Audit not found.' });
    }
    const sample = req.method === 'POST' ? await ensureSampleAd(row) : await getSampleAd(row.id);
    return res.status(200).json({ ok: true, sample });
  } catch (e) {
    // A missing audit_leads table (migration not applied) just means "no sample".
    const msg = String((e as Error)?.message || '');
    if (/audit_leads/.test(msg) && /does not exist/.test(msg)) {
      return res.status(200).json({ ok: true, sample: { status: 'none' } });
    }
    console.error('[audit] sample-ad failed', msg);
    return res.status(500).json({ ok: false, code: 'server_error', error: "We couldn't make the sample ad." });
  }
}
