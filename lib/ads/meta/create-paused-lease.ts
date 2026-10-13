/**
 * Create-paused attempt lease helpers (PR W2.5.1).
 *
 * Uses existing `metadata.createPaused` + `updated_at` — no schema migration.
 * Lease expiry alone never authorizes repeating an uncertain Graph POST.
 */

import type { MetaAdsDraftRow } from "@/database/models/MetaAdsDraft.dao";
import type { MetaCreatePausedStep } from "@/lib/ads/meta/create-paused-graph";

/** Active attempt lease duration. Renewed on every successful progress write. */
export const META_ADS_CREATE_PAUSED_LEASE_MS = 10 * 60 * 1000;

export type CreatePausedMetaState = {
  attemptStartedAt?: string;
  leaseExpiresAt?: string;
  lastStep?: string | null;
  outcomeUncertain?: boolean;
  uncertainStep?: MetaCreatePausedStep | null;
  campaignName?: string;
  adsetName?: string;
  creativeName?: string;
  adName?: string;
  metaImageHash?: string;
  uploadFilename?: string;
  contentSha256?: string;
  recoveredFromUncertain?: boolean;
  operatorImageResolution?: {
    resolvedAt: string;
    resolvedByUserId: string;
    imageHash: string;
    verification: "graph_adimages_hashes";
    previousAttemptId: string | null;
  };
  [key: string]: unknown;
};

export function readCreatePausedState(
  draft: MetaAdsDraftRow | { metadata?: unknown }
): CreatePausedMetaState {
  const md =
    draft.metadata &&
    typeof draft.metadata === "object" &&
    !Array.isArray(draft.metadata)
      ? (draft.metadata as Record<string, unknown>)
      : {};
  const cp =
    md.createPaused &&
    typeof md.createPaused === "object" &&
    !Array.isArray(md.createPaused)
      ? (md.createPaused as CreatePausedMetaState)
      : {};
  return { ...cp };
}

export function mergeCreatePausedState(
  draft: MetaAdsDraftRow | { metadata?: unknown },
  patch: CreatePausedMetaState
): Record<string, unknown> {
  const md =
    draft.metadata &&
    typeof draft.metadata === "object" &&
    !Array.isArray(draft.metadata)
      ? { ...(draft.metadata as Record<string, unknown>) }
      : {};
  const prev = readCreatePausedState(draft);
  return {
    ...md,
    createPaused: {
      ...prev,
      ...patch,
    },
  };
}

export function leaseExpiresAtFromNow(
  nowMs: number = Date.now(),
  leaseMs: number = META_ADS_CREATE_PAUSED_LEASE_MS
): string {
  return new Date(nowMs + leaseMs).toISOString();
}

/**
 * Lease is active when leaseExpiresAt is in the future.
 * Falls back to updated_at + leaseMs when leaseExpiresAt is missing (legacy rows).
 */
export function isCreatePausedLeaseActive(
  draft: MetaAdsDraftRow,
  nowMs: number = Date.now(),
  leaseMs: number = META_ADS_CREATE_PAUSED_LEASE_MS
): boolean {
  const state = readCreatePausedState(draft);
  if (typeof state.leaseExpiresAt === "string" && state.leaseExpiresAt.trim()) {
    const exp = Date.parse(state.leaseExpiresAt);
    if (Number.isFinite(exp)) return exp > nowMs;
  }
  const updated = Date.parse(String(draft.updatedAt || ""));
  if (Number.isFinite(updated)) {
    return updated + leaseMs > nowMs;
  }
  // Unknown timestamps → treat as active (fail closed against takeover).
  return true;
}

/** True when createPaused marks an uncertain Graph step that must not be blindly retried. */
export function hasUnresolvedUncertainStep(
  draft: MetaAdsDraftRow | { metadata?: unknown; lastErrorCode?: string | null }
): boolean {
  const state = readCreatePausedState(draft);
  if (state.outcomeUncertain === true) return true;
  const row = draft as { lastErrorCode?: string | null };
  return row.lastErrorCode === "outcome_uncertain";
}

/**
 * Whether an expired `creating` attempt may be taken over by a new attempt.
 * Never when outcome is uncertain (needs reconcile/operator — not another POST).
 */
export function canReclaimStaleCreating(
  draft: MetaAdsDraftRow,
  nowMs: number = Date.now()
): { ok: true } | { ok: false; reason: string } {
  if (draft.status !== "creating") {
    return { ok: false, reason: "not_creating" };
  }
  if (isCreatePausedLeaseActive(draft, nowMs)) {
    return { ok: false, reason: "lease_active" };
  }
  if (hasUnresolvedUncertainStep(draft)) {
    return {
      ok: false,
      reason: "uncertain_step_blocks_reclaim",
    };
  }
  return { ok: true };
}

/**
 * Next Graph step for resume. Confirmed Meta ids / image hash skip completed steps.
 * If outcomeUncertain on a step without persisted id/hash, next action is blocked.
 */
export function nextCreatePausedStep(
  draft: MetaAdsDraftRow
): {
  step: MetaCreatePausedStep | "done" | "blocked_uncertain";
  uncertainStep?: MetaCreatePausedStep | null;
} {
  const state = readCreatePausedState(draft);
  if (hasUnresolvedUncertainStep(draft)) {
    const us =
      (state.uncertainStep as MetaCreatePausedStep | null | undefined) ||
      (typeof state.lastStep === "string" &&
      ["campaign", "adset", "image", "creative", "ad"].includes(state.lastStep)
        ? (state.lastStep as MetaCreatePausedStep)
        : null);
    // If uncertain but the artifact was somehow persisted, treat as resolved for that step.
    if (us === "campaign" && draft.metaCampaignId) {
      /* fall through */
    } else if (us === "adset" && draft.metaAdsetId) {
      /* fall through */
    } else if (us === "image" && state.metaImageHash) {
      /* fall through */
    } else if (us === "creative" && draft.metaCreativeId) {
      /* fall through */
    } else if (us === "ad" && draft.metaAdId) {
      /* fall through */
    } else {
      return { step: "blocked_uncertain", uncertainStep: us };
    }
  }

  if (!draft.metaCampaignId) return { step: "campaign" };
  if (!draft.metaAdsetId) return { step: "adset" };
  if (!state.metaImageHash) return { step: "image" };
  if (!draft.metaCreativeId) return { step: "creative" };
  if (!draft.metaAdId) return { step: "ad" };
  return { step: "done" };
}
