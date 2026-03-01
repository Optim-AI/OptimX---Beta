// pages/api/admin/vouchers/create.ts
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
    const { valid, username } = verifyAdminToken(token);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized - invalid token' });
    }

    const { userId, creditType, credits, expiresAt, note, reportId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    if (!creditType || (creditType !== 'image' && creditType !== 'video')) {
      return res.status(400).json({ error: 'creditType must be "image" or "video"' });
    }
    const creditsNum = Number(credits);
    if (!Number.isFinite(creditsNum) || !Number.isInteger(creditsNum) || creditsNum <= 0) {
      return res.status(400).json({ error: 'credits must be a positive integer' });
    }

    const voucher = await VoucherDAO.create({
      userId,
      creditType,
      credits: creditsNum,
      status: 'active',
      expiresAt: expiresAt || null,
      issuedBy: username || 'admin',
      reportId: reportId || null,
      note: note || null,
    });

    return res.status(200).json({ success: true, voucher });
  } catch (error: any) {
    console.error('Create voucher error:', error);
    return res.status(500).json({ error: 'Failed to create voucher', message: error.message });
  }
}
