/**
 * Trusted Meta Ads write-context loader (PR W1.3 / W2.3B).
 *
 * Resolves identity → integration (`provider = meta`) → explicitly selected
 * `ad_accounts` row → typed credentials from the database.
 *
 * Credential mapping (W2.3B — see `token-contract.ts`):
 * - User Ads token ← `integrations.refresh_token`
 * - Page token     ← `integrations.access_token`
 * - Page id        ← `integrations.page_id`
 *
 * `ResolvedMetaAdsWriteContext.accessToken` / `userAccessToken` are the **user**
 * token for `act_*` Marketing API operations. Never relabel a Page token as a
 * user token.
 *
 * Authorization model (same as Ads sync / status DAOs):
 * - Callers pass a **verified** server-side user id (e.g. from
 *   `getUserIdFromRequest`); never trust request-body identity or tokens.
 * - Reads go through `IntegrationDAO` / `AdAccountDAO` over `DATABASE_URL`
 *   (table-owner / server role). RLS is not FORCE'd so the server role
 *   bypasses PostgREST policies; **application filters** enforce
 *   `user_id` + `provider = 'meta'` and selected-account ownership.
 * - Do not accept a client-preconstructed write context.
 *
 * This module does not call Meta Graph and does not create campaigns.
 */

import { IntegrationDAO } from "@/database/models/Integration.dao";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";
import { revealTokens } from "@/lib/ads/crypto/tokens";
import { normalizeCurrencyCode } from "@/lib/ads/analytics/currency";
import { mapMetaAdsStoredTokens } from "@/lib/ads/providers/meta/token-contract";
import {
  META_ORGANIC_PROVIDER_IDS,
  MetaAdsWriteContextError,
  type MetaAdsWriteContextErrorCode,
  type ResolvedMetaAdsWriteContext,
  resolveMetaAdsWriteContext,
} from "@/lib/ads/providers/meta/write-context";

export const META_ADS_WRITE_PROVIDER = "meta" as const;

/** Health statuses that mean the Ads connection is not usable for writes. */
const DISCONNECTED_HEALTH = new Set([
  "expired",
  "revoked",
  "invalid",
  "unhealthy",
]);

export type MetaAdsWriteAuthErrorCode =
  | MetaAdsWriteContextErrorCode
  | "unauthenticated"
  | "no_integration"
  | "integration_disconnected"
  | "integration_owner_mismatch"
  | "account_integration_mismatch"
  | "account_not_selected"
  | "account_provider_mismatch"
  | "token_decrypt_failed";

export class MetaAdsWriteAuthError extends Error {
  readonly code: MetaAdsWriteAuthErrorCode;

  constructor(code: MetaAdsWriteAuthErrorCode, message: string) {
    super(message);
    this.name = "MetaAdsWriteAuthError";
    this.code = code;
  }
}

type IntegrationRow = NonNullable<
  Awaited<ReturnType<typeof IntegrationDAO.findByUserAndProvider>>
>;
type AdAccountRow = NonNullable<
  Awaited<ReturnType<typeof AdAccountDAO.findSelected>>
>;

export type LoadMetaAdsWriteContextDeps = {
  findIntegrationByUserAndProvider: (
    userId: string,
    provider: string
  ) => Promise<IntegrationRow | null>;
  findSelectedAdAccount: (
    integrationId: string
  ) => Promise<AdAccountRow | null>;
  revealTokens: typeof revealTokens;
};

const defaultDeps: LoadMetaAdsWriteContextDeps = {
  findIntegrationByUserAndProvider: (userId, provider) =>
    IntegrationDAO.findByUserAndProvider(userId, provider),
  findSelectedAdAccount: (integrationId) =>
    AdAccountDAO.findSelected(integrationId),
  revealTokens,
};

function fail(
  code: MetaAdsWriteAuthErrorCode,
  message: string
): never {
  throw new MetaAdsWriteAuthError(code, message);
}

/**
 * Load a write-ready Meta Ads context from DB for an authenticated user.
 *
 * @param authenticatedUserId - Verified server auth subject; not from body.
 */
export async function loadMetaAdsWriteContext(
  authenticatedUserId: string | null | undefined,
  deps: Partial<LoadMetaAdsWriteContextDeps> = {}
): Promise<ResolvedMetaAdsWriteContext> {
  const d: LoadMetaAdsWriteContextDeps = { ...defaultDeps, ...deps };

  const userId =
    typeof authenticatedUserId === "string"
      ? authenticatedUserId.trim()
      : "";
  if (!userId) {
    fail(
      "unauthenticated",
      "Meta Ads write requires an authenticated user."
    );
  }

  const integration = await d.findIntegrationByUserAndProvider(
    userId,
    META_ADS_WRITE_PROVIDER
  );
  if (!integration) {
    fail(
      "no_integration",
      "No Meta Ads integration connected for this user."
    );
  }

  // Defense in depth: never proceed if the row is not owned / not Ads provider.
  if (String(integration.userId) !== userId) {
    fail(
      "integration_owner_mismatch",
      "Meta Ads integration does not belong to the authenticated user."
    );
  }

  const rowProvider = String(integration.provider || "").trim();
  if (
    (META_ORGANIC_PROVIDER_IDS as readonly string[]).includes(rowProvider)
  ) {
    fail(
      "organic_provider",
      `Provider "${rowProvider}" is for organic publishing, not Meta Ads writes.`
    );
  }
  if (rowProvider !== META_ADS_WRITE_PROVIDER) {
    fail(
      "wrong_provider",
      `Meta Ads writes require provider "meta"; got "${rowProvider || "(empty)"}".`
    );
  }

  const health = String(integration.healthStatus || "").toLowerCase();
  if (DISCONNECTED_HEALTH.has(health)) {
    fail(
      "integration_disconnected",
      "Meta Ads integration is disconnected or revoked. Reconnect before write operations."
    );
  }

  // Explicit selection only — never first account, never integration.adAccountId fallback.
  const selected = await d.findSelectedAdAccount(integration.id);
  if (!selected) {
    fail(
      "no_selected_account",
      "Select a Meta Ads account before write operations. The first discovered account is never used as a fallback."
    );
  }

  if (String(selected.integrationId) !== String(integration.id)) {
    fail(
      "account_integration_mismatch",
      "Selected ad account does not belong to this Meta Ads integration."
    );
  }

  if (!selected.isSelected) {
    fail(
      "account_not_selected",
      "Ad account is not explicitly selected for Meta Ads writes."
    );
  }

  const accountProvider = selected.provider
    ? String(selected.provider).trim()
    : "";
  if (
    accountProvider &&
    (META_ORGANIC_PROVIDER_IDS as readonly string[]).includes(accountProvider)
  ) {
    fail(
      "organic_provider",
      `Ad account provider "${accountProvider}" is not valid for Meta Ads writes.`
    );
  }
  if (accountProvider && accountProvider !== META_ADS_WRITE_PROVIDER) {
    fail(
      "account_provider_mismatch",
      `Selected ad account provider must be "meta"; got "${accountProvider}".`
    );
  }

  const currency = normalizeCurrencyCode(selected.currency);
  if (!currency) {
    fail(
      "missing_currency",
      "Selected Meta Ads account has no usable currency; never assume INR."
    );
  }
  // Currency always comes from the selected ad_accounts row (stored record).

  let typed: ReturnType<typeof mapMetaAdsStoredTokens>;
  try {
    const revealed = d.revealTokens({
      accessToken: integration.accessToken ?? null,
      refreshToken: integration.refreshToken ?? null,
    });
    typed = mapMetaAdsStoredTokens(revealed);
  } catch {
    // Never log ciphertext or plaintext.
    fail(
      "token_decrypt_failed",
      "Meta Ads access token could not be decrypted."
    );
  }

  // Account / campaign Marketing API writes require the **user** Ads token.
  if (!typed.userAccessToken) {
    fail(
      "missing_user_access_token",
      "Meta Ads integration has no usable user Ads access token. Reconnect Meta Ads (user token is stored separately from the Page token)."
    );
  }

  const pageIdRaw =
    integration.pageId != null ? String(integration.pageId).trim() : "";
  const pageId = pageIdRaw || null;

  try {
    return resolveMetaAdsWriteContext(
      {
        userId,
        integrationId: integration.id,
        // Pass user Ads token into the shared AdsProviderContext.accessToken slot
        accessToken: typed.userAccessToken,
        selectedAccountId: selected.accountId,
        accountCurrency: currency,
        provider: META_ADS_WRITE_PROVIDER,
      },
      {
        adAccountRowId: selected.id,
        pageId,
        pageAccessToken: typed.pageAccessToken,
      }
    );
  } catch (e) {
    if (e instanceof MetaAdsWriteContextError) {
      fail(e.code, e.message);
    }
    throw e;
  }
}
