// pages/api/admin/reports/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminToken } from '@/lib/admin-auth';
import { ReportDAO } from '@/database/models/Report.dao';

/**
 * GET /api/admin/reports/list
 * Get all reports, newest first (admin only)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
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

    const reports = await ReportDAO.getAllWithUserInfo();

    return res.status(200).json({
      success: true,
      reports,
    });
  } catch (error: any) {
    console.error('Get reports error:', error);
    return res.status(500).json({
      error: 'Failed to get reports',
      message: error.message,
    });
  }
}
