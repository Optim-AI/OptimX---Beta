// pages/api/ads/status.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { IntegrationDAO } from "@/database";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";
import { AdSyncRunDAO, AdMetricsDAO } from "@/database/models/AdMetrics.dao";
import { isLinkedInConfigured } from "@/lib/ads/providers/linkedin/client";
import { getMetaPendingSelection } from "@/lib/ads/meta/pending-session";

const ADS_PROVIDERS = ["meta", "google-ads", "linkedin"] as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "missing_user" });

  const statuses: Record<string, any> = {};
  const metaPending = await getMetaPendingSelection(userId).catch(() => null);

  for (const provider of ADS_PROVIDERS) {
    const integration = await IntegrationDAO.findByUserAndProvider(userId, provider);
    if (!integration) {
      statuses[provider] = {
        connected: false,
        configured:
          provider === "linkedin"
            ? isLinkedInConfigured()
            : provider === "google-ads"
              ? !!(
                  process.env.GOOGLE_ADS_CLIENT_ID &&
                  process.env.GOOGLE_ADS_CLIENT_SECRET &&
                  process.env.GOOGLE_ADS_DEVELOPER_TOKEN
                )
              : !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
        ...(provider === "meta"
          ? {
              pendingSelection: metaPending,
              syncStatus: "idle",
              hasMetrics: false,
              selectedAccountCount: 0,
            }
          : {}),
      };
      continue;
    }

    const accounts = await AdAccountDAO.listByIntegration(integration.id);
    const selected = accounts.find((a) => a.isSelected) || null;
    const recentSyncs = await AdSyncRunDAO.listRecent(integration.id, 3);
    const hasMetrics = await AdMetricsDAO.hasData(integration.id);
    const unhealthyStatuses = ["expired", "revoked", "invalid", "unhealthy"];
    const needsReconnect = unhealthyStatuses.includes(integration.healthStatus || "");

    statuses[provider] = {
      connected: !needsReconnect,
      needsReconnect,
      integrationId: integration.id,
      healthStatus: integration.healthStatus,
      healthErrorMessage: integration.healthErrorMessage,
      tokenExpiresAt: integration.tokenExpiresAt,
      scopes: integration.scopes,
      syncStatus: (integration as any).syncStatus,
      lastSyncedAt: (integration as any).lastSyncedAt,
      syncErrorMessage: (integration as any).syncErrorMessage,
      adAccountId: integration.adAccountId,
      pageId: integration.pageId,
      selectedAccount: selected
        ? {
            id: selected.accountId,
            name: selected.name,
            currency: selected.currency,
            status: selected.status,
          }
        : null,
      selectedAccountCount: accounts.filter((a) => a.isSelected).length,
      accounts: accounts.map((a) => ({
        id: a.accountId,
        name: a.name,
        isSelected: a.isSelected,
        currency: a.currency,
        status: a.status,
      })),
      hasMetrics,
      recentSyncs: recentSyncs.map((s) => ({
        id: s.id,
        status: s.status,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        metricsUpserted: s.metricsUpserted,
        errorMessage: s.errorMessage,
      })),
      ...(provider === "meta"
        ? {
            // Pending only matters before an integration exists
            pendingSelection: null,
          }
        : {}),
      // Never return tokens
    };
  }

  res.status(200).json({ ok: true, providers: statuses });
}
