/**
 * Pure validation for Meta Ads drafts (PR W2.0) — no Graph / no DB I/O.
 */

import { normalizeCurrencyCode } from "@/lib/ads/analytics/currency";
import { metaBudgetOffsetForCurrency } from "@/lib/ads/providers/meta/budget";
import {
  canTransitionMetaAdsDraftStatus,
  isMetaAdsDraftStatus,
  metaAdsDraftStatusAllowsMetaIds,
  type MetaAdsDraftStatus,
} from "@/lib/ads/meta/draft-status";
import {
  isMetaAdsDraftCta,
  isMetaAdsDraftObjective,
  isPublicHttpsUrl,
  parseMetaAdsDraftPlacements,
  parseMetaAdsDraftTargeting,
} from "@/lib/ads/meta/draft-contract";

export type MetaAdsDraftValidationErrorCode =
  | "unauthenticated"
  | "invalid_status"
  | "invalid_status_transition"
  | "meta_ids_not_allowed"
  | "missing_currency"
  | "unverified_currency"
  | "invalid_budget"
  | "integration_account_mismatch"
  | "wrong_provider"
  | "account_not_selected"
  | "integration_owner_mismatch"
  | "invalid_objective"
  | "invalid_cta"
  | "invalid_targeting"
  | "invalid_placements"
  | "invalid_destination_url"
  | "invalid_schedule"
  | "creative_id_required"
  | "invalid_creative_id"
  | "creative_not_found"
  | "creative_not_image"
  | "creative_url_unavailable"
  | "creative_url_mismatch"
  | "creative_url_unsafe";

export class MetaAdsDraftValidationError extends Error {
  readonly code: MetaAdsDraftValidationErrorCode;

  constructor(code: MetaAdsDraftValidationErrorCode, message: string) {
    super(message);
    this.name = "MetaAdsDraftValidationError";
    this.code = code;
  }
}

export type MetaObjectIds = {
  metaCampaignId?: string | null;
  metaAdsetId?: string | null;
  metaCreativeId?: string | null;
  metaAdId?: string | null;
};

export function assertNoFabricatedMetaIdsForStatus(
  status: MetaAdsDraftStatus,
  ids: MetaObjectIds
): void {
  if (metaAdsDraftStatusAllowsMetaIds(status)) return;
  const present = [
    ids.metaCampaignId,
    ids.metaAdsetId,
    ids.metaCreativeId,
    ids.metaAdId,
  ].some((v) => v != null && String(v).trim() !== "");
  if (present) {
    throw new MetaAdsDraftValidationError(
      "meta_ids_not_allowed",
      `Status "${status}" is local-only and must not carry Meta object ids. A local draft is not a Meta campaign.`
    );
  }
}

export function assertValidStatusTransition(
  from: MetaAdsDraftStatus,
  to: MetaAdsDraftStatus
): void {
  if (!isMetaAdsDraftStatus(to)) {
    throw new MetaAdsDraftValidationError(
      "invalid_status",
      `Invalid Meta Ads draft status "${String(to)}".`
    );
  }
  if (!canTransitionMetaAdsDraftStatus(from, to)) {
    throw new MetaAdsDraftValidationError(
      "invalid_status_transition",
      `Cannot transition Meta Ads draft from "${from}" to "${to}".`
    );
  }
}

/**
 * Stamp/validate currency using Meta budget offset allowlist.
 * Returns normalized currency code — never trusts client as sole source.
 */
export function stampVerifiedDraftCurrency(
  accountCurrency: string | null | undefined
): string {
  const code = normalizeCurrencyCode(accountCurrency);
  if (!code) {
    throw new MetaAdsDraftValidationError(
      "missing_currency",
      "Selected ad account currency is required; never assume INR."
    );
  }
  try {
    metaBudgetOffsetForCurrency(code);
  } catch {
    throw new MetaAdsDraftValidationError(
      "unverified_currency",
      `Currency ${code} is not verified for Meta Ads budget writes.`
    );
  }
  return code;
}

export function assertValidDailyBudgetMajor(
  major: number | string | null | undefined
): void {
  if (major == null || major === "") return; // optional until create-paused
  const n = typeof major === "number" ? major : Number(String(major).trim());
  if (!Number.isFinite(n) || n <= 0) {
    throw new MetaAdsDraftValidationError(
      "invalid_budget",
      "Daily budget must be a positive finite amount in major currency units."
    );
  }
}

/**
 * First-release field contract (W2.2). Null/empty optional fields skip checks;
 * non-empty values must match the allowlist / schema.
 */
export function assertFirstReleaseDraftFields(input: {
  objective?: string | null;
  callToAction?: string | null;
  destinationUrl?: string | null;
  targeting?: unknown;
  placements?: unknown;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
}): void {
  if (input.objective != null && String(input.objective).trim() !== "") {
    if (!isMetaAdsDraftObjective(String(input.objective).trim())) {
      throw new MetaAdsDraftValidationError(
        "invalid_objective",
        `Objective is not in the first-release allowlist.`
      );
    }
  }
  if (input.callToAction != null && String(input.callToAction).trim() !== "") {
    if (!isMetaAdsDraftCta(String(input.callToAction).trim())) {
      throw new MetaAdsDraftValidationError(
        "invalid_cta",
        `Call to action is not in the first-release allowlist.`
      );
    }
  }
  if (
    input.destinationUrl != null &&
    String(input.destinationUrl).trim() !== ""
  ) {
    if (!isPublicHttpsUrl(String(input.destinationUrl))) {
      throw new MetaAdsDraftValidationError(
        "invalid_destination_url",
        "Destination URL must be a public https:// URL."
      );
    }
  }
  if (input.targeting != null) {
    const empty =
      typeof input.targeting === "object" &&
      !Array.isArray(input.targeting) &&
      Object.keys(input.targeting as object).length === 0;
    if (!empty && !parseMetaAdsDraftTargeting(input.targeting)) {
      throw new MetaAdsDraftValidationError(
        "invalid_targeting",
        "Targeting must use first-release geo + age range fields only."
      );
    }
  }
  if (input.placements != null) {
    const empty =
      typeof input.placements === "object" &&
      !Array.isArray(input.placements) &&
      Object.keys(input.placements as object).length === 0;
    if (!empty && !parseMetaAdsDraftPlacements(input.placements)) {
      throw new MetaAdsDraftValidationError(
        "invalid_placements",
        "Placements must be automatic or Facebook Feed only."
      );
    }
  }
  const start =
    input.scheduleStart != null && String(input.scheduleStart).trim() !== ""
      ? Date.parse(String(input.scheduleStart))
      : NaN;
  const end =
    input.scheduleEnd != null && String(input.scheduleEnd).trim() !== ""
      ? Date.parse(String(input.scheduleEnd))
      : NaN;
  if (input.scheduleStart && Number.isNaN(start)) {
    throw new MetaAdsDraftValidationError(
      "invalid_schedule",
      "Schedule start must be a valid date."
    );
  }
  if (input.scheduleEnd && Number.isNaN(end)) {
    throw new MetaAdsDraftValidationError(
      "invalid_schedule",
      "Schedule end must be a valid date."
    );
  }
  if (!Number.isNaN(start) && !Number.isNaN(end) && end < start) {
    throw new MetaAdsDraftValidationError(
      "invalid_schedule",
      "Schedule end must be on or after the start date."
    );
  }
}

export type TrustedAccountBinding = {
  userId: string;
  integrationId: string;
  integrationUserId: string;
  integrationProvider: string;
  adAccountId: string;
  adAccountIntegrationId: string;
  adAccountProvider?: string | null;
  isSelected: boolean;
  currency: string | null;
};

/**
 * Fail closed unless integration + selected ad account belong to the user
 * and to each other, with provider meta.
 */
export function assertTrustedMetaAdsAccountBinding(
  b: TrustedAccountBinding
): { currency: string } {
  if (!b.userId?.trim()) {
    throw new MetaAdsDraftValidationError(
      "unauthenticated",
      "Authenticated user is required."
    );
  }
  if (String(b.integrationUserId) !== String(b.userId)) {
    throw new MetaAdsDraftValidationError(
      "integration_owner_mismatch",
      "Meta Ads integration does not belong to the authenticated user."
    );
  }
  if (String(b.integrationProvider) !== "meta") {
    throw new MetaAdsDraftValidationError(
      "wrong_provider",
      `Drafts require Ads provider "meta"; got "${b.integrationProvider}".`
    );
  }
  if (String(b.adAccountIntegrationId) !== String(b.integrationId)) {
    throw new MetaAdsDraftValidationError(
      "integration_account_mismatch",
      "Ad account does not belong to the given Meta Ads integration."
    );
  }
  if (
    b.adAccountProvider &&
    String(b.adAccountProvider).trim() !== "" &&
    String(b.adAccountProvider) !== "meta"
  ) {
    throw new MetaAdsDraftValidationError(
      "wrong_provider",
      `Ad account provider must be "meta"; got "${b.adAccountProvider}".`
    );
  }
  if (!b.isSelected) {
    throw new MetaAdsDraftValidationError(
      "account_not_selected",
      "Only the explicitly selected Meta Ads account may be used for drafts."
    );
  }
  const currency = stampVerifiedDraftCurrency(b.currency);
  return { currency };
}
