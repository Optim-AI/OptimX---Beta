/**
 * Unified ads sync runner — pulls entities + daily metrics into the MPDL.
 */

import { IntegrationDAO } from "@/database/models/Integration.dao";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";
import {
  AdMetricsDAO,
  AdPlatformEntityDAO,
  AdSyncRunDAO,
} from "@/database/models/AdMetrics.dao";
import { getAdsProvider } from "@/lib/ads/providers";
import { revealTokens, prepareTokensForStorage } from "@/lib/ads/crypto/tokens";
import { daysAgo, isoDate, type AdsProviderId } from "@/lib/ads/types";

export interface RunSyncOptions {
  userId: string;
  provider: AdsProviderId | string;
  since?: string;
  until?: string;
  triggerSource?: "manual" | "cron" | "reconnect";
  /** Days of history when since/until omitted (default 30) */
  lookbackDays?: number;
}

export async function runAdsSync(options: RunSyncOptions) {
  const {
    userId,
    provider,
    triggerSource = "manual",
    lookbackDays = 30,
  } = options;

  const until = options.until || isoDate(new Date());
  const since = options.since || daysAgo(lookbackDays);

  const integration = await IntegrationDAO.findByUserAndProvider(userId, provider);
  if (!integration) {
    throw new Error(`No ${provider} integration for user`);
  }

  const { accessToken, refreshToken } = revealTokens(integration);
  if (!accessToken && !refreshToken) {
    throw new Error("Integration has no access credentials");
  }

  const adsProvider = getAdsProvider(provider);
  let token = accessToken || "";
  let currentRefresh = refreshToken;

  // Refresh if provider supports it and access token missing/near expiry
  const expiresAt = integration.tokenExpiresAt
    ? new Date(integration.tokenExpiresAt).getTime()
    : null;
  const needsRefresh =
    !!adsProvider.refreshAccessToken &&
    !!currentRefresh &&
    (!token || (expiresAt != null && expiresAt - Date.now() < 5 * 60 * 1000));

  if (needsRefresh && adsProvider.refreshAccessToken) {
    const refreshed = await adsProvider.refreshAccessToken({
      userId,
      integrationId: integration.id,
      accessToken: token,
      refreshToken: currentRefresh,
      metadata: (integration.metadata as any) || {},
    });
    if (refreshed) {
      token = refreshed.accessToken;
      currentRefresh = refreshed.refreshToken || currentRefresh;
      const prepared = prepareTokensForStorage({
        accessToken: token,
        refreshToken: currentRefresh,
      });
      await IntegrationDAO.update(integration.id, {
        accessToken: prepared.accessToken,
        refreshToken: prepared.refreshToken,
        tokenEncrypted: prepared.tokenEncrypted,
        tokenExpiresAt: refreshed.expiresAt || null,
        healthStatus: "healthy",
        healthErrorMessage: null,
        lastHealthCheck: new Date().toISOString(),
      } as any);
    }
  }

  if (!token) throw new Error("Unable to obtain access token for sync");

  const selected =
    (await AdAccountDAO.findSelected(integration.id)) ||
    (integration.adAccountId
      ? await AdAccountDAO.findByExternalId(integration.id, integration.adAccountId)
      : null);

  if (!selected) {
    throw new Error(
      "No advertising account selected. Complete asset selection before syncing."
    );
  }

  await IntegrationDAO.update(integration.id, {
    syncStatus: "syncing",
    syncErrorMessage: null,
  } as any);

  const run = await AdSyncRunDAO.start({
    integrationId: integration.id,
    adAccountId: selected.id,
    provider,
    triggerSource,
    sinceDate: since,
    untilDate: until,
  });

  const ctx = {
    userId,
    integrationId: integration.id,
    accessToken: token,
    refreshToken: currentRefresh,
    selectedAccountId: selected.accountId,
    managerCustomerId:
      (selected.metadata as any)?.managerId ||
      (integration.metadata as any)?.managerCustomerId ||
      process.env.GOOGLE_ADS_MANAGER_ID ||
      null,
    metadata: {
      ...((integration.metadata as any) || {}),
      ...((selected.metadata as any) || {}),
    },
  };

  try {
    const entities = await adsProvider.fetchEntities(ctx, selected.accountId);
    const entitiesUpserted = await AdPlatformEntityDAO.upsertMany(
      integration.id,
      selected.id,
      provider,
      entities
    );

    const metrics = await adsProvider.fetchDailyMetrics(ctx, selected.accountId, {
      since,
      until,
    });
    const metricsUpserted = await AdMetricsDAO.upsertDaily(
      integration.id,
      selected.id,
      provider,
      metrics
    );

    await AdAccountDAO.markSynced(selected.id);
    await IntegrationDAO.update(integration.id, {
      syncStatus: "success",
      syncErrorMessage: null,
      lastSyncedAt: new Date().toISOString(),
      healthStatus: "healthy",
      lastHealthCheck: new Date().toISOString(),
    } as any);

    await AdSyncRunDAO.finish(run.id, {
      status: "success",
      entitiesUpserted,
      metricsUpserted,
      details: { since, until, accountId: selected.accountId },
    });

    return {
      ok: true,
      runId: run.id,
      since,
      until,
      entitiesUpserted,
      metricsUpserted,
      accountId: selected.accountId,
    };
  } catch (err: any) {
    const message = err?.message || String(err);
    await IntegrationDAO.update(integration.id, {
      syncStatus: "error",
      syncErrorMessage: message,
      healthStatus: "unhealthy",
      healthErrorMessage: message,
      lastHealthCheck: new Date().toISOString(),
    } as any);
    await AdSyncRunDAO.finish(run.id, {
      status: "error",
      errorMessage: message,
    });
    throw err;
  }
}
