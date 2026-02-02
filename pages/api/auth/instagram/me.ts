// pages/api/auth/instagram/me.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../../lib/integrationStore";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.json({ connected: false });

    const row = await readSavedIntegration({ provider: "meta", userId });
    if (!row) return res.json({ connected: false });

    res.json({ connected: true, pageId: row.pageId, igUserId: row.igUserId, createdAt: row.createdAt });
  } catch (e) {
    console.error("me handler error:", e);
    res.json({ connected: false });
  }
}
