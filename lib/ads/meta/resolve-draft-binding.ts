/**
 * Load trusted Meta Ads integration + selected account for draft APIs (W2.1).
 * Never accepts client-supplied account identity as authorization.
 */

import { IntegrationDAO } from "@/database/models/Integration.dao";
import { AdAccountDAO } from "@/database/models/AdAccount.dao";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";

const DISCONNECTED = new Set(["expired", "revoked", "invalid", "unhealthy"]);

export type TrustedMetaDraftBinding = {
  integration: NonNullable<
    Awaited<ReturnType<typeof IntegrationDAO.findByUserAndProvider>>
  >;
  selectedAccount: NonNullable<
    Awaited<ReturnType<typeof AdAccountDAO.findSelected>>
  >;
};

export type ResolveDraftBindingDeps = {
  findIntegrationByUserAndProvider: (
    userId: string,
    provider: string
  ) => Promise<TrustedMetaDraftBinding["integration"] | null>;
  findSelectedAdAccount: (
    integrationId: string
  ) => Promise<TrustedMetaDraftBinding["selectedAccount"] | null>;
};

const defaultDeps: ResolveDraftBindingDeps = {
  findIntegrationByUserAndProvider: (userId, provider) =>
    IntegrationDAO.findByUserAndProvider(userId, provider),
  findSelectedAdAccount: (integrationId) =>
    AdAccountDAO.findSelected(integrationId),
};

/**
 * Resolve Meta Ads integration + explicitly selected ad account for drafts.
 * Throws MetaAdsDraftValidationError on missing/unhealthy/unselected.
 */
export async function resolveTrustedMetaDraftBinding(
  authenticatedUserId: string,
  deps: Partial<ResolveDraftBindingDeps> = {}
): Promise<TrustedMetaDraftBinding> {
  const d = { ...defaultDeps, ...deps };
  const uid = String(authenticatedUserId || "").trim();
  if (!uid) {
    throw new MetaAdsDraftValidationError(
      "unauthenticated",
      "Authenticated user is required."
    );
  }

  const integration = await d.findIntegrationByUserAndProvider(uid, "meta");
  if (!integration) {
    throw new MetaAdsDraftValidationError(
      "integration_account_mismatch",
      "Connect Meta Ads under Integrations before creating drafts."
    );
  }
  if (String(integration.userId) !== uid) {
    throw new MetaAdsDraftValidationError(
      "integration_owner_mismatch",
      "Meta Ads integration does not belong to the authenticated user."
    );
  }
  if (String(integration.provider) !== "meta") {
    throw new MetaAdsDraftValidationError(
      "wrong_provider",
      `Drafts require Ads provider "meta"; got "${integration.provider}".`
    );
  }

  const health = String(integration.healthStatus || "").toLowerCase();
  if (DISCONNECTED.has(health)) {
    throw new MetaAdsDraftValidationError(
      "integration_account_mismatch",
      "Meta Ads integration needs reconnect before Ads drafts."
    );
  }

  const selectedAccount = await d.findSelectedAdAccount(integration.id);
  if (!selectedAccount) {
    throw new MetaAdsDraftValidationError(
      "account_not_selected",
      "Select a Meta Ads account. The first discovered account is never used."
    );
  }

  return { integration, selectedAccount };
}
