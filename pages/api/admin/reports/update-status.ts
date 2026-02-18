// pages/api/admin/reports/update-status.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminToken } from '@/lib/admin-auth';
import { ReportDAO } from '@/database/models/Report.dao';

/**
 * POST /api/admin/reports/update-status
 * Update a report's status (admin only)
 * Body: { reportId: string, status: 'open' | 'reviewed' | 'resolved' }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized - no token provided' });
    }

    const { valid } = verifyAdminToken(token);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized - invalid token' });
    }

    const { reportId, status } = req.body || {};

    if (!reportId || typeof reportId !== 'string') {
      return res.status(400).json({ error: 'reportId is required' });
    }

    const validStatuses = ['open', 'reviewed', 'resolved'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const updated = await ReportDAO.updateStatus(reportId, status);

    return res.status(200).json({
      success: true,
      message: `Report status updated to "${status}"`,
      report: updated,
    });
  } catch (error: any) {
    console.error('Update report status error:', error);
    return res.status(500).json({
      error: 'Failed to update report status',
      message: error.message,
    });
  }
}
