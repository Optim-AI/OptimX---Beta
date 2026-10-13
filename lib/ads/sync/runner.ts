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
import { daysAgo, isoDate, type AdsProviderId, type SyncResult } from "@/lib/ads/types";
import {
  classifyAdsSyncOutcome,
  normalizeFetchDailyMetricsResult,
} from "@/lib/ads/sync/outcome";
import { normalizeCurrencyCode } from "@/lib/ads/analytics/currency";

export interface RunSyncOptions {
  userId: string;
  provider: AdsProviderId | string;
  since?: string;
  until?: string;
  triggerSource?: "manual" | "cron" | "reconnect";
  /** Days of history when since/until omitted (default 30) */
  lookbackDays?: number;
}

export async function runAdsSync(options: RunSyncOptions): Promise<SyncResult> {
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
  // Meta Ads: user token lives in refresh_token (see token-contract.ts).
  // Prefer it for Marketing API reads; do not use organic publish credentials.
  let token =
    provider === "meta"
      ? String(refreshToken || accessToken || "").trim()
      : String(accessToken || "").trim();
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
    accountCurrency: selected.currency ?? null,
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

    const metricsRaw = await adsProvider.fetchDailyMetrics(
      ctx,
      selected.accountId,
      { since, until }
    );
    const metricsResult = normalizeFetchDailyMetricsResult(metricsRaw);

    // Ensure spend rows carry the selected account currency (providers may omit it)
    const accountCurrency = normalizeCurrencyCode(selected.currency);
    const metricsForUpsert = metricsResult.metrics.map((m) => ({
      ...m,
      currency: normalizeCurrencyCode(m.currency) || accountCurrency,
    }));

    // Persist whatever metrics we successfully retrieved before classifying outcome
    const metricsUpserted = await AdMetricsDAO.upsertDaily(
      integration.id,
      selected.id,
      provider,
      metricsForUpsert
    );

    const outcome = classifyAdsSyncOutcome({
      entitiesUpserted,
      metricsUpserted,
      metricsResult,
    });

    const details = {
      since,
      until,
      accountId: selected.accountId,
      currency: accountCurrency,
      levelsAttempted: metricsResult.levelsAttempted,
      levelsSucceeded: metricsResult.levelsSucceeded,
      failures: metricsResult.failures,
      metricsFetched: metricsResult.metrics.length,
    };

    if (outcome.status === "success") {
      await AdAccountDAO.markSynced(selected.id);
      await IntegrationDAO.update(integration.id, {
        syncStatus: "success",
        syncErrorMessage: null,
        lastSyncedAt: new Date().toISOString(),
        healthStatus: "healthy",
        lastHealthCheck: new Date().toISOString(),
      } as any);
    } else if (outcome.status === "partial") {
      await AdAccountDAO.markSynced(selected.id);
      await IntegrationDAO.update(integration.id, {
        syncStatus: "partial",
        syncErrorMessage: outcome.errorMessage,
        lastSyncedAt: new Date().toISOString(),
        // Partial is not a token health failure
        healthStatus: "healthy",
        healthErrorMessage: null,
        lastHealthCheck: new Date().toISOString(),
      } as any);
    } else {
      await IntegrationDAO.update(integration.id, {
        syncStatus: "error",
        syncErrorMessage: outcome.errorMessage,
        healthStatus: "unhealthy",
        healthErrorMessage: outcome.errorMessage,
        lastHealthCheck: new Date().toISOString(),
      } as any);
    }

    await AdSyncRunDAO.finish(run.id, {
      status: outcome.status,
      entitiesUpserted,
      metricsUpserted,
      errorMessage: outcome.errorMessage,
      details,
    });

    // Classified outcomes (success / partial / error) are returned — not thrown —
    // so API/cron can report status without double-finishing the run.
    return {
      ok: outcome.ok,
      status: outcome.status,
      runId: run.id,
      since,
      until,
      entitiesUpserted,
      metricsUpserted,
      accountId: selected.accountId,
      errorMessage: outcome.errorMessage,
      warnings: metricsResult.failures.map(
        (f) => `${f.level}: ${f.message}`
      ),
      details,
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
