// pages/api/integrations/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../lib/requestHelpers";
import { readSavedIntegration } from "../../../lib/integrationStore";

/**
 * Returns which platforms are connected for the current user.
 * For now returns only meta:true/false; extend for other providers.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) return res.status(200).json({ meta: false });

    const saved = await readSavedIntegration({ provider: "meta", userId });
    return res.status(200).json({ meta: !!saved });
  } catch (err) {
    console.error("integrations/status error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
