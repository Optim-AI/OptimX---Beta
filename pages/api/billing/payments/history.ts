// pages/api/billing/payments/history.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { PaymentsDAO } from '@/database/models/Payments.dao';

/**
 * GET /api/billing/payments/history
 * Gets payment history for the current user
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const payments = await PaymentsDAO.getByUserId(userId, limit);

    return res.status(200).json({
      success: true,
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        paymentType: p.paymentType,
        metadata: p.metadata,
        createdAt: p.createdAt,
      })),
    });
  } catch (error: any) {
    console.error('Payment history error:', error);
    return res.status(500).json({
      error: 'Failed to fetch payment history',
      message: error.message,
    });
  }
}
