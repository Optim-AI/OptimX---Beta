/**
 * Shared helpers for Meta Ads draft HTTP APIs (PR W2.1).
 */

import type { NextApiResponse } from "next";
import type { MetaAdsDraftRow } from "@/database/models/MetaAdsDraft.dao";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";
import {
  isMetaAdsDraftStatus,
  type MetaAdsDraftStatus,
} from "@/lib/ads/meta/draft-status";
import { decideMetaAdsCreateAccess } from "@/lib/ads/meta/create-access";

export const META_ADS_DRAFT_MAX_BODY_BYTES = 64 * 1024;

/** Statuses where clients may edit configuration fields (not Meta ids). */
export const META_ADS_DRAFT_EDITABLE_STATUSES: ReadonlySet<MetaAdsDraftStatus> =
  new Set(["draft", "failed"]);

export class MetaAdsDraftApiError extends Error {
  readonly code: string;
  readonly httpStatus: number;

  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.name = "MetaAdsDraftApiError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function assertBodySize(req: { headers: Record<string, unknown> }): void {
  const raw = req.headers["content-length"];
  const n = raw != null ? Number(raw) : NaN;
  if (Number.isFinite(n) && n > META_ADS_DRAFT_MAX_BODY_BYTES) {
    throw new MetaAdsDraftApiError(
      "body_too_large",
      "Request body too large.",
      413
    );
  }
}

/** Require Meta Ads create entitlement (env gate). Does not use Analytics. */
export function assertMetaAdsCreateEntitled(userId: string): void {
  const access = decideMetaAdsCreateAccess(userId);
  if (!access.entitled) {
    throw new MetaAdsDraftApiError(
      "not_entitled",
      access.reason || "Not entitled to create Meta Ads.",
      403
    );
  }
}

/** Public JSON shape — never includes tokens. */
export function serializeMetaAdsDraft(row: MetaAdsDraftRow) {
  return {
    id: row.id,
    status: row.status,
    name: row.name,
    objective: row.objective,
    dailyBudgetMajor: row.dailyBudgetMajor,
    currency: row.currency,
    scheduleStart: row.scheduleStart,
    scheduleEnd: row.scheduleEnd,
    targeting: row.targeting,
    placements: row.placements,
    sourceImageId: row.sourceImageId,
    sourceImageUrl: row.sourceImageUrl,
    primaryText: row.primaryText,
    headline: row.headline,
    destinationUrl: row.destinationUrl,
    callToAction: row.callToAction,
    metaCampaignId: row.metaCampaignId,
    metaAdsetId: row.metaAdsetId,
    metaCreativeId: row.metaCreativeId,
    metaAdId: row.metaAdId,
    idempotencyKey: row.idempotencyKey,
    createAttemptId: row.createAttemptId,
    lastErrorCode: row.lastErrorCode,
    lastErrorMessage: row.lastErrorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdOnMetaAt: row.createdOnMetaAt,
    integrationId: row.integrationId,
    adAccountId: row.adAccountId,
    // Explicit: local draft is not proof of Meta delivery
    onMeta: row.status === "created_paused" && !!row.metaCampaignId,
  };
}

const FORBIDDEN_CLIENT_KEYS = [
  "userId",
  "user_id",
  "currency",
  "integrationId",
  "integration_id",
  "adAccountId",
  "ad_account_id",
  "status",
  "metaCampaignId",
  "meta_campaign_id",
  "metaAdsetId",
  "meta_adset_id",
  "metaCreativeId",
  "meta_creative_id",
  "metaAdId",
  "meta_ad_id",
  "createdOnMetaAt",
  "created_on_meta_at",
  "accessToken",
  "access_token",
  "pageAccessToken",
] as const;

export function assertNoForbiddenClientFields(body: Record<string, unknown>): void {
  for (const key of FORBIDDEN_CLIENT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined) {
      throw new MetaAdsDraftApiError(
        "meta_ids_not_allowed",
        `Field "${key}" cannot be set by the client.`,
        400
      );
    }
  }
}

export function pickDraftContentFields(body: Record<string, unknown>) {
  return {
    name: body.name as string | null | undefined,
    objective: body.objective as string | null | undefined,
    dailyBudgetMajor: body.dailyBudgetMajor as string | number | null | undefined,
    scheduleStart: body.scheduleStart as string | null | undefined,
    scheduleEnd: body.scheduleEnd as string | null | undefined,
    targeting: body.targeting as Record<string, unknown> | null | undefined,
    placements: body.placements as Record<string, unknown> | null | undefined,
    sourceImageId: body.sourceImageId as string | null | undefined,
    sourceImageUrl: body.sourceImageUrl as string | null | undefined,
    primaryText: body.primaryText as string | null | undefined,
    headline: body.headline as string | null | undefined,
    destinationUrl: body.destinationUrl as string | null | undefined,
    callToAction: body.callToAction as string | null | undefined,
    idempotencyKey: body.idempotencyKey as string | null | undefined,
    metadata: body.metadata as Record<string, unknown> | null | undefined,
  };
}

export function mapDraftErrorStatus(code: string): number {
  switch (code) {
    case "unauthenticated":
      return 401;
    case "not_entitled":
      return 403;
    case "body_too_large":
      return 413;
    case "invalid_status":
    case "invalid_status_transition":
    case "meta_ids_not_allowed":
    case "missing_currency":
    case "unverified_currency":
    case "invalid_budget":
    case "integration_account_mismatch":
    case "wrong_provider":
    case "account_not_selected":
    case "integration_owner_mismatch":
    case "invalid_objective":
    case "invalid_cta":
    case "invalid_targeting":
    case "invalid_placements":
    case "invalid_destination_url":
    case "invalid_schedule":
    case "creative_id_required":
    case "invalid_creative_id":
    case "creative_not_found":
    case "creative_not_image":
    case "creative_url_unavailable":
    case "creative_url_mismatch":
    case "creative_url_unsafe":
      return 400;
    default:
      return 400;
  }
}

export function assertDraftEditable(status: string): void {
  if (!isMetaAdsDraftStatus(status) || !META_ADS_DRAFT_EDITABLE_STATUSES.has(status)) {
    throw new MetaAdsDraftApiError(
      "invalid_status_transition",
      `Draft status "${status}" is not editable.`,
      400
    );
  }
}

/**
 * Safe JSON error for draft/preflight APIs — no stack, no DB internals, no tokens.
 */
export function sendMetaAdsDraftError(
  res: NextApiResponse,
  error: unknown
): void {
  if (error instanceof MetaAdsDraftApiError) {
    res.status(error.httpStatus).json({
      ok: false,
      error: error.code,
      message: error.message,
    });
    return;
  }
  if (error instanceof MetaAdsDraftValidationError) {
    res.status(mapDraftErrorStatus(error.code)).json({
      ok: false,
      error: error.code,
      message: error.message,
    });
    return;
  }
  console.error("[meta-ads-draft-api]", error);
  res.status(500).json({
    ok: false,
    error: "server_error",
    message: "Unexpected server error.",
  });
}
