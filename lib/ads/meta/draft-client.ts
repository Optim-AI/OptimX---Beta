/**
 * Browser helpers for Meta Ads draft APIs (PR W2.2). No Graph writes.
 */

import { authFetch } from "@/lib/utils";
import type { MetaAdsPreflightResult } from "@/lib/ads/meta/preflight";

export type MetaAdsDraftDto = {
  id: string;
  status: string;
  name: string | null;
  objective: string | null;
  dailyBudgetMajor: string | null;
  currency: string;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  targeting: Record<string, unknown> | null;
  placements: Record<string, unknown> | null;
  sourceImageId: string | null;
  sourceImageUrl: string | null;
  primaryText: string | null;
  headline: string | null;
  destinationUrl: string | null;
  callToAction: string | null;
  metaCampaignId: string | null;
  metaAdsetId: string | null;
  metaCreativeId: string | null;
  metaAdId: string | null;
  idempotencyKey: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  createdOnMetaAt: string | null;
  integrationId: string;
  adAccountId: string;
  onMeta: boolean;
};

export type MetaAdsDraftApiError = {
  ok: false;
  error: string;
  message?: string;
  status: number;
};

export type DraftContentPayload = {
  name?: string | null;
  objective?: string | null;
  dailyBudgetMajor?: number | string | null;
  scheduleStart?: string | null;
  scheduleEnd?: string | null;
  targeting?: Record<string, unknown> | null;
  placements?: Record<string, unknown> | null;
  sourceImageId?: string | null;
  sourceImageUrl?: string | null;
  primaryText?: string | null;
  headline?: string | null;
  destinationUrl?: string | null;
  callToAction?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
};

async function parseJson(res: Response): Promise<any> {
  return res.json().catch(() => ({}));
}

export async function fetchMetaAdsPreflight(): Promise<
  MetaAdsPreflightResult | MetaAdsDraftApiError
> {
  const res = await authFetch("/api/ads/meta/preflight");
  const json = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: json.error || "preflight_failed",
      message: json.message,
      status: res.status,
    };
  }
  return json as MetaAdsPreflightResult;
}

export async function listMetaAdsDrafts(limit = 50): Promise<
  { ok: true; drafts: MetaAdsDraftDto[] } | MetaAdsDraftApiError
> {
  const res = await authFetch(`/api/ads/meta/drafts?limit=${limit}`);
  const json = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: json.error || "list_failed",
      message: json.message,
      status: res.status,
    };
  }
  return { ok: true, drafts: (json.drafts || []) as MetaAdsDraftDto[] };
}

export async function getMetaAdsDraft(
  id: string
): Promise<{ ok: true; draft: MetaAdsDraftDto } | MetaAdsDraftApiError> {
  const res = await authFetch(`/api/ads/meta/drafts/${encodeURIComponent(id)}`);
  const json = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: json.error || "read_failed",
      message: json.message,
      status: res.status,
    };
  }
  return { ok: true, draft: json.draft as MetaAdsDraftDto };
}

export async function createMetaAdsDraft(
  payload: DraftContentPayload
): Promise<
  | { ok: true; draft: MetaAdsDraftDto; created: boolean }
  | MetaAdsDraftApiError
> {
  const res = await authFetch("/api/ads/meta/drafts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: json.error || "create_failed",
      message: json.message,
      status: res.status,
    };
  }
  return {
    ok: true,
    draft: json.draft as MetaAdsDraftDto,
    created: Boolean(json.created),
  };
}

export async function updateMetaAdsDraft(
  id: string,
  payload: DraftContentPayload
): Promise<{ ok: true; draft: MetaAdsDraftDto } | MetaAdsDraftApiError> {
  const res = await authFetch(`/api/ads/meta/drafts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const json = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: json.error || "update_failed",
      message: json.message,
      status: res.status,
    };
  }
  return { ok: true, draft: json.draft as MetaAdsDraftDto };
}

export async function archiveMetaAdsDraft(
  id: string
): Promise<{ ok: true; draft: MetaAdsDraftDto } | MetaAdsDraftApiError> {
  const res = await authFetch(
    `/api/ads/meta/drafts/${encodeURIComponent(id)}/archive`,
    { method: "POST" }
  );
  const json = await parseJson(res);
  if (!res.ok) {
    return {
      ok: false,
      error: json.error || "archive_failed",
      message: json.message,
      status: res.status,
    };
  }
  return { ok: true, draft: json.draft as MetaAdsDraftDto };
}

export function humanizeMetaAdsDraftError(
  err: MetaAdsDraftApiError
): string {
  if (err.status === 401 || err.error === "unauthenticated") {
    return "Please sign in to continue.";
  }
  if (err.error === "not_entitled") {
    return (
      err.message ||
      "Meta Ads draft creation is not enabled for your account yet."
    );
  }
  if (err.error === "not_found") {
    return "Draft not found.";
  }
  switch (err.error) {
    case "creative_not_found":
      return (
        err.message ||
        "That image is missing or not yours. Reselect from Generated Contents."
      );
    case "creative_not_image":
      return "Choose an image (videos are not supported for Meta Ads drafts yet).";
    case "creative_id_required":
    case "invalid_creative_id":
    case "creative_url_mismatch":
    case "creative_url_unavailable":
    case "creative_url_unsafe":
      return (
        err.message ||
        "This creative cannot be used. Reselect an image from Generated Contents."
      );
    default:
      break;
  }
  return err.message || err.error || "Something went wrong. Try again.";
}
