// pages/api/integrations/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../lib/requestHelpers";
import { getStatuses, readSavedIntegration, PLATFORMS } from "../../../lib/integrationStore";

/**
 * Returns which platforms are connected.
 * Response shape: { meta: boolean, "google-ads": boolean, ... }
 *
 * Behavior:
 *  - Reads global flags from app_settings.integrations_flags via getStatuses()
 *  - If request is authenticated, also checks per-user saved integrations and marks those true
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Read global flags from app_settings (initializes defaults if missing)
    const globalFlags = await getStatuses(); // Promise<Record<string, boolean>>

    // Start with a normalized set based on global flags and known platforms
    const result: Record<string, boolean> = {};
    PLATFORMS.forEach((p) => {
      result[p] = !!globalFlags[p];
    });

    // If a user is authenticated, prefer explicit per-user saved integrations (mark true if found)
    const userId = await getUserIdFromRequest(req);
    if (userId) {
      // Check saved integration rows for this user for each provider
      await Promise.all(
        PLATFORMS.map(async (provider) => {
          try {
            const saved = await readSavedIntegration({ userId, provider });
            if (saved) result[provider] = true;
          } catch (err) {
            // ignore per-provider errors
            // console.warn("per-provider check error", provider, err);
          }
        })
      );
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("integrations/status error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
