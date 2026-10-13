/**
 * Read-only Meta Ads create preflight (PR W2.1) — no Graph writes.
 */

import { normalizeCurrencyCode } from "@/lib/ads/analytics/currency";
import { metaBudgetOffsetForCurrency } from "@/lib/ads/providers/meta/budget";
import {
  decideMetaAdsCreateAccess,
  type MetaAdsCreateAccess,
} from "@/lib/ads/meta/create-access";

const DISCONNECTED = new Set(["expired", "revoked", "invalid", "unhealthy"]);

export type MetaAdsPreflightBlockerCode =
  | "not_entitled"
  | "no_integration"
  | "integration_disconnected"
  | "no_selected_account"
  | "missing_currency"
  | "unverified_currency"
  | "page_not_bound";

export type MetaAdsPreflightResult = {
  ok: true;
  /** Never true for Meta campaign existence — local readiness only. */
  canCreateLocalDraft: boolean;
  /** Page is required before Meta-side create (W2.3+), not for local drafts. */
  canCreateOnMeta: boolean;
  entitled: MetaAdsCreateAccess;
  integration: {
    present: boolean;
    id: string | null;
    healthStatus: string | null;
    healthy: boolean;
    /** Facebook Page id from OAuth finalize — no tokens. */
    pageId: string | null;
    pageBound: boolean;
  };
  selectedAccount: {
    present: boolean;
    /** Internal ad_accounts.id */
    id: string | null;
    /** External Meta account id (no act_) */
    externalId: string | null;
    name: string | null;
    currency: string | null;
    currencySupported: boolean;
    currencyOffset: 1 | 100 | null;
  };
  blockers: Array<{ code: MetaAdsPreflightBlockerCode; message: string }>;
};

export type MetaAdsPreflightInput = {
  userId: string;
  integration: {
    id: string;
    healthStatus: string | null;
    pageId: string | null;
  } | null;
  selectedAccount: {
    id: string;
    accountId: string;
    name: string | null;
    currency: string | null;
  } | null;
  env?: Record<string, string | undefined>;
};

export function buildMetaAdsCreatePreflight(
  input: MetaAdsPreflightInput
): MetaAdsPreflightResult {
  const entitled = decideMetaAdsCreateAccess(input.userId, input.env);
  const blockers: MetaAdsPreflightResult["blockers"] = [];

  if (!entitled.entitled) {
    blockers.push({
      code: "not_entitled",
      message: entitled.reason || "Not entitled to create Meta Ads.",
    });
  }

  const integration = input.integration;
  const health = String(integration?.healthStatus || "").toLowerCase();
  const healthy = !!integration && !DISCONNECTED.has(health);

  if (!integration) {
    blockers.push({
      code: "no_integration",
      message: "Connect Meta Ads under Integrations before creating drafts.",
    });
  } else if (!healthy) {
    blockers.push({
      code: "integration_disconnected",
      message: "Meta Ads integration needs reconnect before Ads creation.",
    });
  }

  const selected = input.selectedAccount;
  let currencySupported = false;
  let currencyOffset: 1 | 100 | null = null;
  const currency = normalizeCurrencyCode(selected?.currency ?? null);

  if (!selected) {
    blockers.push({
      code: "no_selected_account",
      message:
        "Select a Meta Ads account. The first discovered account is never used.",
    });
  } else if (!currency) {
    blockers.push({
      code: "missing_currency",
      message: "Selected ad account has no currency; never assume INR.",
    });
  } else {
    try {
      currencyOffset = metaBudgetOffsetForCurrency(currency);
      currencySupported = true;
    } catch {
      blockers.push({
        code: "unverified_currency",
        message: `Currency ${currency} is not in the Meta budget-offset allowlist.`,
      });
    }
  }

  const pageBound = !!(integration?.pageId && String(integration.pageId).trim());
  if (integration && healthy && selected && currencySupported && !pageBound) {
    // Soft blocker for Meta create only — still allow local drafts.
    blockers.push({
      code: "page_not_bound",
      message:
        "No Facebook Page is bound to this Meta Ads integration. Local drafts are allowed; Meta-side creation will require a trusted Page selection.",
    });
  }

  const hardLocal = blockers.some((b) =>
    [
      "not_entitled",
      "no_integration",
      "integration_disconnected",
      "no_selected_account",
      "missing_currency",
      "unverified_currency",
    ].includes(b.code)
  );

  return {
    ok: true,
    canCreateLocalDraft: !hardLocal,
    canCreateOnMeta: !hardLocal && pageBound,
    entitled,
    integration: {
      present: !!integration,
      id: integration?.id ?? null,
      healthStatus: integration?.healthStatus ?? null,
      healthy,
      pageId: integration?.pageId ?? null,
      pageBound,
    },
    selectedAccount: {
      present: !!selected,
      id: selected?.id ?? null,
      externalId: selected?.accountId ?? null,
      name: selected?.name ?? null,
      currency,
      currencySupported,
      currencyOffset,
    },
    blockers,
  };
}
