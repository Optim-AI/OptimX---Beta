// pages/api/testing/add-test-credits.ts
// Adds test credits without payment
// DEVELOPMENT ONLY

import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { CreditsDAO } from '@/database/models/Credits.dao';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CRITICAL: Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is only available in development mode' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { type = 'image', amount = 10 } = req.body;

    if (type !== 'image' && type !== 'video') {
      return res.status(400).json({ error: 'type must be "image" or "video"' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    let result;
    if (type === 'image') {
      result = await CreditsDAO.addImageCreditsAddon(userId, amount);
    } else {
      result = await CreditsDAO.addVideoCreditsAddon(userId, amount);
    }

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json({
      success: true,
      message: `Added ${amount} ${type} credits`,
      balance: result.balance,
    });
  } catch (error: any) {
    console.error('Add test credits error:', error);
    return res.status(500).json({
      error: 'Failed to add test credits',
      message: error.message,
    });
  }
}
