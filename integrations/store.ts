// lib/integrationStore.ts
// REFACTORED: Now uses Prisma IntegrationDAO and SettingsDAO instead of direct Supabase
import { IntegrationDAO, SettingsDAO } from '@/database';

export const PLATFORMS = ["meta", "google-ads", "whatsapp", "linkedin", "twitter"] as const;
export type PlatformId = (typeof PLATFORMS)[number];

/**
 * NOTE (security):
 * - This module exposes two different kinds of helpers:
 *   1) Global (admin) app_settings flags: getStatuses / setStatus
 *   2) Per-user integration helpers: getUserStatuses / setUserStatusForUser,
 *      saveIntegration(userId) and readSavedIntegration(userId)
 *
 * The integration read/write helpers are strictly user-scoped. There is no
 * "latest row for provider" fallback: a missing userId must never resolve to
 * another user's tokens.
 */

/* -------------------- Admin/global app_settings helpers -------------------- */

/** Get integration flags from app_settings (init if missing) — global (admin) flags */
export async function getStatuses(): Promise<Record<string, boolean>> {
  return SettingsDAO.getIntegrationFlags();
}

/** Set connection flag in app_settings — global (admin) flags */
export async function setStatus(platformId: string, connected: boolean): Promise<void> {
  return SettingsDAO.setIntegrationFlag(platformId, connected);
}

/* -------------------- Per-user integration flag helpers -------------------- */

/** Get per-user integration flags stored in app_settings_user (creates if missing) */
export async function getUserStatuses(userId: string): Promise<Record<string, boolean>> {
  if (!userId) throw new Error("getUserStatuses requires userId");
  return SettingsDAO.getUserIntegrationFlags(userId);
}

/** Set per-user integration flag in app_settings (user-scoped) */
export async function setUserStatusForUser(userId: string, platformId: string, connected: boolean): Promise<void> {
  if (!userId) throw new Error("setUserStatusForUser requires userId");
  return SettingsDAO.setUserIntegrationFlag(userId, platformId, connected);
}

/* -------------------- Integration rows (user-scoped) -------------------- */

/**
 * Save or update integration row.
 * - IMPORTANT: store pageAccessToken in access_token column.
 * - Only upserts rows for the given user (no cross-user updates). Throws without a userId.
 */
export async function saveIntegration(
  savedObj: any,
  options: { userId: string; provider?: string }
) {
  const provider = options?.provider ?? "meta";
  const userId = options?.userId ?? null;
  if (!userId) {
    throw new Error("saveIntegration requires userId");
  }

  const pageAccessToken = savedObj?.pageAccessToken ?? savedObj?.page_access_token ?? null;
  const userAccessToken = savedObj?.userAccessToken ?? savedObj?.user_access_token ?? null;
  const pageId = savedObj?.pageId ?? savedObj?.page_id ?? null;
  const igUserId = savedObj?.igUserId ?? savedObj?.ig_user_id ?? null;
  const adAccountIdRaw = savedObj?.adAccountId ?? savedObj?.ad_account_id ?? null;
  const ad_account_id = typeof adAccountIdRaw === "string"
    ? adAccountIdRaw.replace(/^act_/, "").replace(/^act_act_/, "")
    : null;

  const metadata = {
    pageId,
    igUserId,
    adAccountIdRaw,
    savedAt: new Date().toISOString(),
  };

  return IntegrationDAO.upsert({
    userId,
    provider,
    providerUserId: igUserId ?? pageId ?? null,
    adAccountId: ad_account_id,
    pageId,
    igUserId,
    accessToken: pageAccessToken,
    refreshToken: userAccessToken,
    tokenExpiresAt: savedObj?.tokenExpiresAt || savedObj?.token_expires_at || null,
    scopes: savedObj?.scopes || null,
    pageName: savedObj?.pageName || null,
    pageCategory: savedObj?.pageCategory || null,
    allPages: savedObj?.allPages || null,
    raw: savedObj?.raw ?? savedObj,
    metadata,
    healthStatus: savedObj?.healthStatus || 'healthy',
    lastHealthCheck: savedObj?.lastHealthCheck || new Date().toISOString(),
    healthErrorMessage: savedObj?.healthErrorMessage || null,
  });
}

/**
 * Read the integration row for a user and provider.
 * Returns null when userId is missing, so callers treat it as "not connected"
 * instead of receiving another user's tokens.
 */
export async function readSavedIntegration(options: { userId: string | null; provider?: string }) {
  const provider = options?.provider ?? "meta";
  const userId = options?.userId ?? null;
  if (!userId) return null;

  const integration = await IntegrationDAO.findByUserAndProvider(userId, provider);
  if (!integration) return null;

  // Rebuild the expected format for backward compatibility
  const rebuilt = {
    createdAt: integration.createdAt,
    pageAccessToken: integration.accessToken ?? (integration.metadata as any)?.pageAccessToken ?? null,
    userAccessToken: integration.refreshToken ?? integration.accessToken ?? null,
    pageId: integration.pageId ?? (integration.metadata as any)?.pageId ?? null,
    igUserId: integration.igUserId ?? (integration.metadata as any)?.igUserId ?? null,
    adAccountId: integration.adAccountId ? `act_${integration.adAccountId}` : ((integration.metadata as any)?.adAccountIdRaw ?? null),
    longUserToken: integration.refreshToken ?? null,
    raw: integration.raw ?? null,
    savedRowId: integration.id,
    user_id: integration.userId,
    // Health tracking fields
    tokenExpiresAt: integration.tokenExpiresAt ?? null,
    healthStatus: integration.healthStatus ?? 'healthy',
    lastHealthCheck: integration.lastHealthCheck ?? null,
    healthErrorMessage: integration.healthErrorMessage ?? null,
  };

  return rebuilt;
}

/* -------------------- small admin helpers (tweak: allow user-scoped listing) -------------------- */

/** List integrations — if userId provided, list only that user's integrations. Otherwise admin list. */
export async function listIntegrations(provider?: string, userId?: string | null) {
  if (!userId) {
    // Admin mode - would need to modify DAO to support this
    throw new Error("listIntegrations requires userId");
  }
  return IntegrationDAO.listByUser(userId, provider);
}

/** Delete integration by id (admin). Keep this explicit. */
export async function deleteIntegration(id: string) {
  return IntegrationDAO.delete(id);
}
