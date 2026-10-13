/**
 * Meta Graph adapter for create-paused (PR W2.5 / W2.5.1).
 *
 * Separates confirmed success / confirmed rejection / uncertain outcomes.
 * Never auto-retries POSTs.
 *
 * W2.5.1: automatic GET reconciliation does **not** accept name+PAUSED matches.
 * No verified attempt-correlation fields are available; zero/one/many GET results
 * all leave the step uncertain for operator resolution.
 *
 * Image upload uses the W2.4 service; filename-based image reconciliation is
 * intentionally NOT treated as reliable.
 */

import {
  MetaGraphError,
  metaGraphGet,
  metaGraphGetAll,
  metaGraphPost,
  redactMetaSecrets,
} from "@/lib/ads/providers/meta/client";
import {
  uploadMetaAdsAdImage,
  MetaAdsAdImageUploadError,
  type MetaAdsAdImageUploadSuccess,
} from "@/lib/ads/meta/upload-ad-image";
import type {
  MetaTrafficAdParams,
  MetaTrafficAdSetParams,
  MetaTrafficCampaignParams,
  MetaTrafficCreativeParams,
} from "@/lib/ads/meta/create-paused-traffic-map";

export type MetaCreatePausedStep =
  | "campaign"
  | "adset"
  | "image"
  | "creative"
  | "ad";

export type MetaGraphWriteOutcome =
  | { kind: "confirmed"; id: string; raw?: unknown }
  | {
      kind: "rejected";
      code: string;
      message: string;
      httpStatus?: number;
      graphCode?: number;
    }
  | {
      kind: "uncertain";
      code: "outcome_uncertain";
      message: string;
      step: MetaCreatePausedStep;
    };

export type MetaReconcileProbeResult = {
  /** Always null in W2.5.1 — auto-accept disabled. */
  acceptedId: string | null;
  matchCount: number;
  reason:
    | "auto_accept_disabled"
    | "image_reconcile_disabled"
    | "probe_failed"
    | "zero_matches"
    | "multiple_matches"
    | "insufficient_correlation";
};

export type MetaCreatePausedGraphAdapter = {
  createCampaign: (
    actId: string,
    accessToken: string,
    params: MetaTrafficCampaignParams
  ) => Promise<MetaGraphWriteOutcome>;
  createAdSet: (
    actId: string,
    accessToken: string,
    params: MetaTrafficAdSetParams
  ) => Promise<MetaGraphWriteOutcome>;
  uploadImage: (opts: {
    authenticatedUserId: string;
    sourceImageId: string;
  }) => Promise<
    | { kind: "confirmed"; result: MetaAdsAdImageUploadSuccess }
    | {
        kind: "rejected";
        code: string;
        message: string;
      }
    | {
        kind: "uncertain";
        code: "outcome_uncertain";
        message: string;
      }
  >;
  createCreative: (
    actId: string,
    accessToken: string,
    params: MetaTrafficCreativeParams
  ) => Promise<MetaGraphWriteOutcome>;
  createAd: (
    actId: string,
    accessToken: string,
    params: MetaTrafficAdParams
  ) => Promise<MetaGraphWriteOutcome>;
  /**
   * Read-only probe after uncertain POST. W2.5.1 never returns an accepted id.
   * Zero matches do **not** prove the POST failed; callers must not re-POST.
   */
  reconcileUncertain: (opts: {
    step: MetaCreatePausedStep;
    actId: string;
    accessToken: string;
    objectName: string;
    attemptStartedAt: string;
  }) => Promise<MetaReconcileProbeResult>;
  /** Optional: verify an image hash exists on the ad account (operator resolve). */
  verifyAdImageHash?: (opts: {
    actId: string;
    accessToken: string;
    imageHash: string;
  }) => Promise<boolean>;
};

function mapPostError(
  e: unknown,
  step: MetaCreatePausedStep
): MetaGraphWriteOutcome {
  if (e instanceof MetaGraphError) {
    if (e.kind === "timeout" || e.kind === "network") {
      return {
        kind: "uncertain",
        code: "outcome_uncertain",
        message: redactMetaSecrets(
          `${e.message} Meta may have accepted the ${step} POST; do not retry without reconciliation.`
        ),
        step,
      };
    }
    return {
      kind: "rejected",
      code:
        e.code === 190 || e.type === "OAuthException"
          ? "meta_permission"
          : "meta_graph_error",
      message: redactMetaSecrets(e.message),
      httpStatus: e.httpStatus,
      graphCode: e.code,
    };
  }
  const msg =
    e instanceof Error ? redactMetaSecrets(e.message) : "Unknown Graph error";
  return {
    kind: "rejected",
    code: "meta_graph_error",
    message: msg,
  };
}

async function postForId(
  path: string,
  accessToken: string,
  params: Record<string, string | number | boolean | undefined | null>,
  step: MetaCreatePausedStep
): Promise<MetaGraphWriteOutcome> {
  try {
    const json = await metaGraphPost<{ id?: unknown }>(path, accessToken, params);
    const id =
      json && typeof json === "object" && typeof (json as any).id === "string"
        ? String((json as any).id).trim()
        : "";
    if (!id) {
      return {
        kind: "rejected",
        code: "malformed_response",
        message: `Meta ${step} response missing id.`,
      };
    }
    return { kind: "confirmed", id, raw: json };
  } catch (e) {
    return mapPostError(e, step);
  }
}

/**
 * Diagnostic-only name filter. **Not** sufficient for auto-accept (W2.5.1).
 * Kept for tests documenting why name+PAUSED is unsafe as attempt identity.
 */
export function pickUniquePausedMatch(
  items: Array<{
    id?: unknown;
    name?: unknown;
    status?: unknown;
    created_time?: unknown;
  }>,
  opts: { objectName: string; attemptStartedAt: string }
): { id: string } | null {
  const attemptMs = Date.parse(opts.attemptStartedAt);
  const matches = items.filter((it) => {
    if (typeof it.id !== "string" || !it.id.trim()) return false;
    if (typeof it.name !== "string" || it.name !== opts.objectName) return false;
    if (typeof it.status === "string" && it.status.toUpperCase() !== "PAUSED") {
      return false;
    }
    if (typeof it.created_time === "string" && Number.isFinite(attemptMs)) {
      const created = Date.parse(it.created_time);
      if (Number.isFinite(created) && created < attemptMs - 120_000) return false;
    }
    return true;
  });
  if (matches.length !== 1) return null;
  return { id: String(matches[0]!.id).trim() };
}

/**
 * Count name+PAUSED candidates for diagnostics. Never used to accept an id.
 */
export function countPausedNameMatches(
  items: Array<{
    id?: unknown;
    name?: unknown;
    status?: unknown;
    created_time?: unknown;
  }>,
  opts: { objectName: string; attemptStartedAt: string }
): number {
  const attemptMs = Date.parse(opts.attemptStartedAt);
  return items.filter((it) => {
    if (typeof it.id !== "string" || !it.id.trim()) return false;
    if (typeof it.name !== "string" || it.name !== opts.objectName) return false;
    if (typeof it.status === "string" && it.status.toUpperCase() !== "PAUSED") {
      return false;
    }
    if (typeof it.created_time === "string" && Number.isFinite(attemptMs)) {
      const created = Date.parse(it.created_time);
      if (Number.isFinite(created) && created < attemptMs - 120_000) return false;
    }
    return true;
  }).length;
}

export async function verifyMetaAdImageHashOnAccount(opts: {
  actId: string;
  accessToken: string;
  imageHash: string;
  getImpl?: typeof metaGraphGet;
}): Promise<boolean> {
  const hash = String(opts.imageHash || "").trim();
  if (!hash || hash.length < 8) return false;
  const get = opts.getImpl ?? metaGraphGet;
  try {
    // Secondary Marketing API pattern: GET act_*/adimages?hashes=["..."]
    // Unverified against official docs in this environment — gated by contract flag at caller.
    const json = await get<{
      data?: Array<{ hash?: string; id?: string }>;
      images?: Record<string, { hash?: string }>;
    }>(`${opts.actId}/adimages`, opts.accessToken, {
      hashes: JSON.stringify([hash]),
      fields: "hash,url,width,height",
    });
    if (Array.isArray(json?.data)) {
      return json.data.some(
        (row) => typeof row.hash === "string" && row.hash === hash
      );
    }
    if (json?.images && typeof json.images === "object") {
      return Object.values(json.images).some(
        (row) => row && typeof row.hash === "string" && row.hash === hash
      );
    }
    return false;
  } catch {
    return false;
  }
}

export function createLiveMetaCreatePausedGraphAdapter(): MetaCreatePausedGraphAdapter {
  return {
    async createCampaign(actId, accessToken, params) {
      return postForId(`${actId}/campaigns`, accessToken, params as any, "campaign");
    },
    async createAdSet(actId, accessToken, params) {
      return postForId(`${actId}/adsets`, accessToken, params as any, "adset");
    },
    async uploadImage(opts) {
      try {
        const result = await uploadMetaAdsAdImage({
          authenticatedUserId: opts.authenticatedUserId,
          sourceImageId: opts.sourceImageId,
        });
        return { kind: "confirmed", result };
      } catch (e) {
        if (e instanceof MetaAdsAdImageUploadError) {
          if (e.outcomeUncertain || e.code === "upload_outcome_uncertain") {
            return {
              kind: "uncertain",
              code: "outcome_uncertain",
              message: e.message,
            };
          }
          return { kind: "rejected", code: e.code, message: e.message };
        }
        if (
          e instanceof MetaGraphError &&
          (e.kind === "timeout" || e.kind === "network")
        ) {
          return {
            kind: "uncertain",
            code: "outcome_uncertain",
            message: redactMetaSecrets(e.message),
          };
        }
        return {
          kind: "rejected",
          code: "image_upload_failed",
          message:
            e instanceof Error
              ? redactMetaSecrets(e.message)
              : "Image upload failed",
        };
      }
    },
    async createCreative(actId, accessToken, params) {
      return postForId(
        `${actId}/adcreatives`,
        accessToken,
        params as any,
        "creative"
      );
    },
    async createAd(actId, accessToken, params) {
      return postForId(`${actId}/ads`, accessToken, params as any, "ad");
    },
    async reconcileUncertain(opts) {
      if (opts.step === "image") {
        return {
          acceptedId: null,
          matchCount: 0,
          reason: "image_reconcile_disabled",
        };
      }

      let path: string;
      if (opts.step === "campaign") path = `${opts.actId}/campaigns`;
      else if (opts.step === "adset") path = `${opts.actId}/adsets`;
      else if (opts.step === "creative") path = `${opts.actId}/adcreatives`;
      else if (opts.step === "ad") path = `${opts.actId}/ads`;
      else {
        return {
          acceptedId: null,
          matchCount: 0,
          reason: "insufficient_correlation",
        };
      }

      try {
        const items = await metaGraphGetAll<{
          id?: string;
          name?: string;
          status?: string;
          created_time?: string;
        }>(path, opts.accessToken, { fields: "id,name,status,created_time", limit: 50 }, 3);
        const matchCount = countPausedNameMatches(items, {
          objectName: opts.objectName,
          attemptStartedAt: opts.attemptStartedAt,
        });
        // W2.5.1: never auto-accept. Name+PAUSED (+ time) is not attempt identity.
        // Limited pagination cannot prove global uniqueness.
        // Zero matches do not prove POST failure (delayed visibility).
        if (matchCount === 0) {
          return { acceptedId: null, matchCount: 0, reason: "zero_matches" };
        }
        if (matchCount > 1) {
          return {
            acceptedId: null,
            matchCount,
            reason: "multiple_matches",
          };
        }
        return {
          acceptedId: null,
          matchCount: 1,
          reason: "auto_accept_disabled",
        };
      } catch {
        return { acceptedId: null, matchCount: 0, reason: "probe_failed" };
      }
    },
    verifyAdImageHash: (opts) => verifyMetaAdImageHashOnAccount(opts),
  };
}

export function createDisabledMetaCreatePausedGraphAdapter(
  reason = "Create-paused Graph writes are disabled"
): MetaCreatePausedGraphAdapter {
  const reject = async (): Promise<MetaGraphWriteOutcome> => ({
    kind: "rejected",
    code: "graph_writes_disabled",
    message: reason,
  });
  return {
    createCampaign: reject,
    createAdSet: reject,
    createCreative: reject,
    createAd: reject,
    uploadImage: async () => ({
      kind: "rejected",
      code: "graph_writes_disabled",
      message: reason,
    }),
    reconcileUncertain: async () => ({
      acceptedId: null,
      matchCount: 0,
      reason: "auto_accept_disabled",
    }),
    verifyAdImageHash: async () => false,
  };
}

export async function metaGraphGetObjectById(
  id: string,
  accessToken: string,
  fields = "id,name,status"
): Promise<unknown> {
  return metaGraphGet(id, accessToken, { fields });
}
