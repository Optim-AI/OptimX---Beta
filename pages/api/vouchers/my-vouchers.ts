// pages/api/vouchers/my-vouchers.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { VoucherDAO } from '@/database/models/Voucher.dao';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const creditType = req.query.creditType as string | undefined;

    let vouchers;
    if (creditType && (creditType === 'image' || creditType === 'video')) {
      vouchers = await VoucherDAO.getActiveByUserIdAndType(userId, creditType);
    } else {
      vouchers = await VoucherDAO.getActiveByUserId(userId);
    }

    return res.status(200).json({ success: true, vouchers });
  } catch (error: any) {
    console.error('Fetch vouchers error:', error);
    return res.status(500).json({ error: 'Failed to fetch vouchers', message: error.message });
  }
}
