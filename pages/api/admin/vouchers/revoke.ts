// pages/api/admin/vouchers/revoke.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyAdminToken } from '@/lib/admin-auth';
import { VoucherDAO } from '@/database/models/Voucher.dao';

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

    const { voucherId } = req.body;

    if (!voucherId) {
      return res.status(400).json({ error: 'voucherId is required' });
    }

    const revoked = await VoucherDAO.revoke(voucherId);

    if (!revoked) {
      return res.status(400).json({ error: 'Voucher not found or not active' });
    }

    return res.status(200).json({ success: true, voucher: revoked });
  } catch (error: any) {
    console.error('Revoke voucher error:', error);
    return res.status(500).json({ error: 'Failed to revoke voucher', message: error.message });
  }
}
