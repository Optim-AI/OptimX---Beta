/**
 * Shape validation for Meta Ads write context (PR W1 / W1.2 / W2.3B).
 *
 * Application code must obtain context via
 * `loadMetaAdsWriteContext(authenticatedUserId)` (PR W1.3), which loads the
 * Ads integration and selected account from the database. Do **not** accept a
 * client-preconstructed context as authorization.
 *
 * Credential typing (W2.3B): `accessToken` / `userAccessToken` are the **user**
 * Ads token for `act_*` Marketing API ops. `pageId` / `pageAccessToken` are
 * separate. See `token-contract.ts`. Never relabel Page ↔ user tokens.
 */

import { normalizeCurrencyCode } from "@/lib/ads/analytics/currency";
import {
  ensureActPrefix,
  stripActPrefix,
} from "@/lib/ads/providers/meta/client";
import {
  metaBudgetExponentForCurrency,
  metaBudgetOffsetForCurrency,
  type MetaBudgetCurrencyOffset,
} from "@/lib/ads/providers/meta/budget";
import type { AdsProviderContext } from "@/lib/ads/providers/types";
import type { AdsProviderId } from "@/lib/ads/types";

/** Organic / publishing providers — not valid for Marketing API writes. */
export const META_ORGANIC_PROVIDER_IDS = [
  "meta-publish",
  "meta-instagram",
] as const;

export type MetaAdsWriteContextErrorCode =
  | "missing_provider"
  | "wrong_provider"
  | "organic_provider"
  | "missing_user_access_token"
  | "missing_page_binding"
  | "no_selected_account"
  | "missing_currency"
  | "unsupported_currency"
  | "unverified_currency";

export class MetaAdsWriteContextError extends Error {
  readonly code: MetaAdsWriteContextErrorCode;

  constructor(code: MetaAdsWriteContextErrorCode, message: string) {
    super(message);
    this.name = "MetaAdsWriteContextError";
    this.code = code;
  }
}

export type ResolvedMetaAdsWriteContext = {
  provider: "meta";
  userId: string;
  integrationId: string;
  /**
   * User Ads token for `act_*` Marketing API operations.
   * Identical to `accessToken` (AdsProviderContext field name).
   */
  userAccessToken: string;
  /**
   * Same as `userAccessToken` — user Ads token, **not** a Page token.
   * Kept for AdsProviderContext / Graph helper compatibility.
   */
  accessToken: string;
  /** Trusted Facebook Page id from `integrations.page_id` (never from body). */
  pageId: string | null;
  /**
   * Page access token from `integrations.access_token` when present.
   * Use only for verified Page-scoped needs; account writes use `userAccessToken`.
   */
  pageAccessToken: string | null;
  /** Internal `ad_accounts.id` when known (UUID); optional for Graph-only paths. */
  adAccountRowId?: string | null;
  /** External Meta ad account id without act_ */
  accountExternalId: string;
  /** act_{id} for Graph paths */
  actId: string;
  /** Ad account currency code from DB (Meta-supported) */
  currency: string;
  /** Meta Marketing API currency offset (1 or 100) — authoritative for budgets */
  currencyOffset: MetaBudgetCurrencyOffset;
  /** Decimal places implied by Meta offset (0 or 2) */
  currencyExponent: 0 | 2;
};

function assertAdsProvider(
  provider: string | null | undefined
): asserts provider is "meta" {
  if (provider == null || String(provider).trim() === "") {
    throw new MetaAdsWriteContextError(
      "missing_provider",
      'Meta Ads writes require an explicit provider "meta"; provider must not be omitted or defaulted.'
    );
  }
  const p = String(provider).trim();
  if ((META_ORGANIC_PROVIDER_IDS as readonly string[]).includes(p)) {
    throw new MetaAdsWriteContextError(
      "organic_provider",
      `Provider "${p}" is for organic publishing, not Meta Ads writes. Use Ads provider "meta".`
    );
  }
  if (p !== "meta") {
    throw new MetaAdsWriteContextError(
      "wrong_provider",
      `Meta Ads writes require provider "meta"; got "${p}".`
    );
  }
}

/**
 * Lower-level shape resolver. Prefer `loadMetaAdsWriteContext` for any
 * user-facing write path — this function does not verify DB ownership.
 *
 * Requires explicit provider `"meta"`, selected account external id + currency —
 * no first-account fallback and no default provider.
 */
export type ResolveMetaAdsWriteContextOpts = {
  adAccountRowId?: string | null;
  /** Trusted Page id from DB — never from the request body. */
  pageId?: string | null;
  /** Page token from DB columns — never from the request body. */
  pageAccessToken?: string | null;
};

export function resolveMetaAdsWriteContext(
  ctx: AdsProviderContext & { provider?: AdsProviderId | string | null },
  opts?: ResolveMetaAdsWriteContextOpts
): ResolvedMetaAdsWriteContext {
  assertAdsProvider(ctx.provider);

  // Caller must pass the **user** Ads token here (see loadMetaAdsWriteContext).
  const userAccessToken = String(ctx.accessToken || "").trim();
  if (!userAccessToken) {
    throw new MetaAdsWriteContextError(
      "missing_user_access_token",
      "Meta Ads write requires a user Ads access token (not a Page token)."
    );
  }

  const accountExternalId = stripActPrefix(ctx.selectedAccountId);
  if (!accountExternalId) {
    throw new MetaAdsWriteContextError(
      "no_selected_account",
      "Select a Meta Ads account before write operations. The first discovered account is never used as a fallback."
    );
  }

  const currency = normalizeCurrencyCode(ctx.accountCurrency);
  if (!currency) {
    throw new MetaAdsWriteContextError(
      "missing_currency",
      "Selected Meta Ads account currency is required for write operations; never assume INR."
    );
  }

  let currencyOffset: MetaBudgetCurrencyOffset;
  let currencyExponent: 0 | 2;
  try {
    currencyOffset = metaBudgetOffsetForCurrency(currency);
    currencyExponent = metaBudgetExponentForCurrency(currency);
  } catch (e) {
    const code =
      e && typeof e === "object" && "code" in e
        ? String((e as { code: string }).code)
        : "unsupported_currency";
    throw new MetaAdsWriteContextError(
      code === "unverified_currency" || code === "missing_currency"
        ? (code as "unverified_currency" | "missing_currency")
        : "unsupported_currency",
      `Selected account currency ${currency} is not verified for Meta budget writes.`
    );
  }

  const actId = ensureActPrefix(accountExternalId)!;
  const pageIdRaw = opts?.pageId != null ? String(opts.pageId).trim() : "";
  const pageId = pageIdRaw || null;
  const pageTok =
    opts?.pageAccessToken != null && String(opts.pageAccessToken).trim()
      ? String(opts.pageAccessToken).trim()
      : null;

  return {
    provider: "meta",
    userId: ctx.userId,
    integrationId: ctx.integrationId,
    userAccessToken,
    accessToken: userAccessToken,
    pageId,
    pageAccessToken: pageTok,
    adAccountRowId: opts?.adAccountRowId ?? null,
    accountExternalId,
    actId,
    currency,
    currencyOffset,
    currencyExponent,
  };
}

/**
 * Guard used by future services: provider id must be Ads `meta`.
 */
export function assertMetaAdsWriteProvider(
  provider: string | null | undefined
): void {
  assertAdsProvider(provider);
}

/**
 * Page-backed creatives (`object_story_spec`) require a trusted Page id from
 * the Ads integration. Does not invent a Page or accept body overrides.
 */
export function assertMetaAdsPageBoundForCreative(
  ctx: ResolvedMetaAdsWriteContext
): void {
  if (!ctx.pageId || !String(ctx.pageId).trim()) {
    throw new MetaAdsWriteContextError(
      "missing_page_binding",
      "A Facebook Page must be bound on the Meta Ads integration before Page-backed ad creatives."
    );
  }
}
