// pages/api/credits/update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import { CreditsDAO } from '@/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Deduct 1 credit using Prisma DAO
    const result = await CreditsDAO.deduct(userId, 1);

    if (!result.success) {
      // Check if insufficient credits
      if (result.error?.includes('Insufficient credits')) {
        return res.status(400).json({ error: 'Insufficient credits' });
      }

      return res.status(500).json({ error: result.error || 'Failed to deduct credits' });
    }

    return res.status(200).json({ ok: true, credits: result.newCredits });
  } catch (e) {
    console.error("credits/update error", e);

    // Check if insufficient credits
    if ((e as any).message?.includes('Insufficient credits')) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }

    res.status(500).json({ error: (e as any).message || "Internal error" });
  }
}
