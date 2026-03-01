// pages/api/admin/vouchers/list.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminToken } from '@/lib/admin-auth';
import { VoucherDAO } from '@/database/models/Voucher.dao';

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

    const limit = Number(req.query.limit) || 100;
    const offset = Number(req.query.offset) || 0;
    const reportId = req.query.reportId as string | undefined;

    let vouchers;
    if (reportId) {
      vouchers = await VoucherDAO.getByReportId(reportId);
    } else {
      vouchers = await VoucherDAO.getAll(limit, offset);
    }

    return res.status(200).json({ success: true, vouchers });
  } catch (error: any) {
    console.error('List vouchers error:', error);
    return res.status(500).json({ error: 'Failed to list vouchers', message: error.message });
  }
}
