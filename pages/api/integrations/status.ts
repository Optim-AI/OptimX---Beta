// pages/api/integrations/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import {
  getStatuses,
  getUserStatuses,
  readSavedIntegration,
  PLATFORMS,
} from '@/integrations/store';
import { getMetaPendingSelection } from "@/lib/ads/meta/pending-session";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";
import { AdMetricsDAO } from "@/database/models/AdMetrics.dao";

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

      const result: Record<string, any> = {};
      PLATFORMS.forEach((p) => {
        result[p] = !!userFlags[p];
      });

      const metaPending = await getMetaPendingSelection(userId).catch(() => null);

      // Additionally ensure that if an integration row exists for this user/provider we mark it true.
      // Also include health status information for Meta
      await Promise.all(
        PLATFORMS.map(async (provider) => {
          try {
            const saved = await readSavedIntegration({ userId, provider });
            if (saved) {
              const unhealthyStatuses = ["expired", "revoked", "invalid", "unhealthy"];
              const needsReconnect = unhealthyStatuses.includes(
                saved.healthStatus || ""
              );

              // Rich status for all advertising providers (tokens never included)
              if (
                provider === "meta" ||
                provider === "google-ads" ||
                provider === "linkedin"
              ) {
                let selectedAccountCount = saved.adAccountId ? 1 : 0;
                let hasMetrics = false;
                try {
                  if (saved.savedRowId) {
                    const accounts = await AdAccountDAO.listByIntegration(
                      saved.savedRowId
                    );
                    selectedAccountCount = accounts.filter((a) => a.isSelected).length;
                    hasMetrics = await AdMetricsDAO.hasData(saved.savedRowId);
                  }
                } catch {
                  // keep defaults
                }

                result[provider] = {
                  connected: !needsReconnect,
                  healthStatus: saved.healthStatus || "healthy",
                  healthMessage:
                    saved.healthErrorMessage ||
                    saved.syncErrorMessage ||
                    "Connected and working normally",
                  tokenExpiresAt: saved.tokenExpiresAt || null,
                  lastChecked: saved.lastHealthCheck || null,
                  lastSyncedAt: saved.lastSyncedAt || null,
                  syncStatus: saved.syncStatus || "idle",
                  syncErrorMessage: saved.syncErrorMessage || null,
                  needsReconnect,
                  adAccountId: saved.adAccountId || null,
                  selectedAccountCount,
                  hasMetrics,
                  pendingSelection: null,
                  ...(provider === "meta"
                    ? {
                        hasFacebook: !!saved.pageId,
                        hasInstagram: !!saved.igUserId,
                      }
                    : {}),
                };
              } else {
                result[provider] = true;
              }
            } else if (provider === "meta" && metaPending) {
              // OAuth completed; integration not finalized until asset selection
              result.meta = {
                connected: false,
                pendingSelection: metaPending,
                syncStatus: "idle",
                hasMetrics: false,
                selectedAccountCount: 0,
                needsReconnect: false,
                healthStatus: "pending_selection",
                healthMessage: "Select a Facebook Page and Ad Account to finish connecting",
              };
            }
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
