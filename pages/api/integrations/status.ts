// pages/api/integrations/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "../../../lib/requestHelpers";
import {
  getStatuses,
  getUserStatuses,
  readSavedIntegration,
  PLATFORMS,
} from "../../../lib/integrationStore";

/**
 * Returns which platforms are connected.
 * Response shape: { meta: boolean, "google-ads": boolean, ... }
 *
 * Behavior:
 *  - If authenticated: return per-user flags (from getUserStatuses) and ensure true if a saved integration exists.
 *  - If unauthenticated: return global flags from app_settings (getStatuses).
 *
 * Important: prefer reading the authenticated user from the request; do NOT trust a client-supplied userId.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Try to identify authenticated user from request/session
    const userId = await getUserIdFromRequest(req);

    // If authenticated -> use per-user flags (safe, user-scoped)
    if (userId) {
      // Initialize result with per-user stored flags (ensures defaults exist)
      const userFlags = await getUserStatuses(userId).catch(() => {
        // on error, create a safe default object with false values
        const fallback: Record<string, boolean> = {};
        PLATFORMS.forEach((p) => (fallback[p] = false));
        return fallback;
      });

      const result: Record<string, boolean> = {};
      PLATFORMS.forEach((p) => {
        result[p] = !!userFlags[p];
      });

      // Additionally ensure that if an integration row exists for this user/provider we mark it true.
      await Promise.all(
        PLATFORMS.map(async (provider) => {
          try {
            const saved = await readSavedIntegration({ userId, provider });
            if (saved) result[provider] = true;
          } catch (err) {
            // ignore per-provider errors
          }
        })
      );

      return res.status(200).json(result);
    }

    // If not authenticated -> return global admin flags (legacy behavior)
    const globalFlags = await getStatuses();
    const out: Record<string, boolean> = {};
    PLATFORMS.forEach((p) => {
      out[p] = !!globalFlags[p];
    });
    return res.status(200).json(out);
  } catch (err) {
    console.error("integrations/status error:", err);
    return res.status(500).json({ error: "server_error" });
  }
}
