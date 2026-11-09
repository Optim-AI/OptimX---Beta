// GET /api/meta-intel/deletion-status?code=… — public status for a deletion confirmation code.
import type { NextApiRequest, NextApiResponse } from 'next';
import { MetaConnectionDAO } from '@/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  const code = typeof req.query.code === 'string' ? req.query.code.trim() : '';
  if (!/^skx-[A-Za-z0-9_-]{6,40}$/.test(code)) return res.status(400).json({ error: 'invalid_code' });
  try {
    const row = await MetaConnectionDAO.getDeletionRequestByCode(code);
    if (!row) return res.status(404).json({ error: 'not_found' });
    // Only status + timestamps; no ids or Meta data.
    return res.status(200).json({
      status: row.status === 'no_data' ? 'completed' : row.status,
      requestedAt: row.requestedAt,
      completedAt: row.completedAt,
    });
  } catch {
    return res.status(500).json({ error: 'lookup_failed' });
  }
}
