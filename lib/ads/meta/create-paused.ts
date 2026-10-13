/**
 * Meta Ads create-paused orchestrator (PR W2.5 / W2.5.1).
 *
 * W2.5.1 hardening:
 * - Attempt-bound conditional progress writes
 * - Ownership touch before each Graph mutation
 * - Stale creating lease reclaim (never when uncertain)
 * - No automatic GET id acceptance
 * - Feature gates re-checked before each mutation
 *
 * All objects PAUSED; never ACTIVE. Graph POSTs are not assumed idempotent.
 */

import { randomUUID } from "crypto";
import {
  MetaAdsDraftDAO,
  type MetaAdsDraftRow,
} from "@/database/models/MetaAdsDraft.dao";
import { decideMetaAdsCreatePausedWriteAccess } from "@/lib/ads/meta/create-paused-gates";
import {
  assertTrafficCreatePausedDraft,
  buildTrafficAdParams,
  buildTrafficAdSetParams,
  buildTrafficCampaignParams,
  buildTrafficCreativeParams,
  MetaAdsCreatePausedMapError,
} from "@/lib/ads/meta/create-paused-traffic-map";
import {
  createDisabledMetaCreatePausedGraphAdapter,
  createLiveMetaCreatePausedGraphAdapter,
  type MetaCreatePausedGraphAdapter,
  type MetaCreatePausedStep,
} from "@/lib/ads/meta/create-paused-graph";
import {
  canReclaimStaleCreating,
  hasUnresolvedUncertainStep,
  leaseExpiresAtFromNow,
  mergeCreatePausedState,
  nextCreatePausedStep,
  readCreatePausedState,
} from "@/lib/ads/meta/create-paused-lease";
import {
  loadMetaAdsWriteContext,
  MetaAdsWriteAuthError,
} from "@/lib/ads/providers/meta/load-write-context";
import {
  assertMetaAdsPageBoundForCreative,
  MetaAdsWriteContextError,
  type ResolvedMetaAdsWriteContext,
} from "@/lib/ads/providers/meta/write-context";
import { redactMetaSecrets } from "@/lib/ads/providers/meta/client";

export type CreatePausedResultCode =
  | "created_paused"
  | "already_created"
  | "partial_failure"
  | "failed"
  | "conflict_creating"
  | "attempt_conflict"
  | "not_found"
  | "not_allowed"
  | "validation_failed"
  | "outcome_uncertain"
  | "blocked_uncertain";

export type CreatePausedResult = {
  ok: boolean;
  code: CreatePausedResultCode;
  message: string;
  draft: MetaAdsDraftRow | null;
  createAttemptId: string | null;
};

export type CreatePausedDeps = {
  findDraft: (
    id: string,
    userId: string
  ) => Promise<MetaAdsDraftRow | null>;
  claimDraft: (
    id: string,
    userId: string,
    createAttemptId: string
  ) => Promise<MetaAdsDraftRow | null>;
  reclaimStale: typeof MetaAdsDraftDAO.reclaimStaleCreatingAttempt;
  persistProgress: typeof MetaAdsDraftDAO.persistCreatePausedProgress;
  loadWriteContext: typeof loadMetaAdsWriteContext;
  graph: MetaCreatePausedGraphAdapter;
  decideWriteAccess: typeof decideMetaAdsCreatePausedWriteAccess;
  env?: Record<string, string | undefined>;
  nowMs?: () => number;
};

function safeMessage(message: string): string {
  return redactMetaSecrets(message).slice(0, 2000);
}

function specialAdCategoriesFromDraft(draft: MetaAdsDraftRow): unknown {
  const md =
    draft.metadata && typeof draft.metadata === "object"
      ? (draft.metadata as Record<string, unknown>)
      : {};
  return md.specialAdCategories;
}

function imageHashFromDraft(draft: MetaAdsDraftRow): string | null {
  const hash = readCreatePausedState(draft).metaImageHash;
  return typeof hash === "string" && hash.trim() ? hash.trim() : null;
}

class AttemptConflictError extends Error {
  constructor(message = "Create-paused attempt ownership lost.") {
    super(message);
    this.name = "AttemptConflictError";
  }
}

async function persistOrConflict(
  deps: CreatePausedDeps,
  draftId: string,
  userId: string,
  createAttemptId: string,
  patch: Omit<
    Parameters<typeof MetaAdsDraftDAO.persistCreatePausedProgress>[2],
    "createAttemptId"
  >
): Promise<MetaAdsDraftRow> {
  const row = await deps.persistProgress(draftId, userId, {
    ...patch,
    createAttemptId,
  });
  if (!row) {
    throw new AttemptConflictError();
  }
  return row;
}

async function assertMutationAllowed(
  deps: CreatePausedDeps,
  userId: string,
  draft: MetaAdsDraftRow,
  createAttemptId: string
): Promise<MetaAdsDraftRow> {
  const access = deps.decideWriteAccess(userId, deps.env ?? process.env);
  if (!access.allowed) {
    throw new AttemptConflictError(
      access.reason || "Create-paused writes no longer allowed."
    );
  }
  // Touch lease + verify attempt ownership before any external mutation.
  return persistOrConflict(deps, draft.id, userId, createAttemptId, {
    metadata: mergeCreatePausedState(draft, {
      leaseExpiresAt: leaseExpiresAtFromNow(deps.nowMs?.() ?? Date.now()),
    }),
  });
}

async function markFailure(
  deps: CreatePausedDeps,
  draft: MetaAdsDraftRow,
  userId: string,
  createAttemptId: string,
  opts: {
    status: "failed" | "partial_failure";
    code: string;
    message: string;
    step?: MetaCreatePausedStep;
    outcomeUncertain?: boolean;
    createPausedPatch?: Record<string, unknown>;
  }
): Promise<MetaAdsDraftRow | null> {
  try {
    return await persistOrConflict(deps, draft.id, userId, createAttemptId, {
      status: opts.status,
      lastErrorCode: opts.code,
      lastErrorMessage: safeMessage(opts.message),
      metadata: mergeCreatePausedState(draft, {
        lastStep: opts.step ?? null,
        outcomeUncertain: Boolean(opts.outcomeUncertain),
        uncertainStep: opts.outcomeUncertain ? opts.step ?? null : null,
        leaseExpiresAt: leaseExpiresAtFromNow(deps.nowMs?.() ?? Date.now()),
        ...(opts.createPausedPatch || {}),
      }),
    });
  } catch (e) {
    if (e instanceof AttemptConflictError) return null;
    throw e;
  }
}

/**
 * After uncertain POST: probe only. Never auto-accept an id. Never re-POST.
 */
async function probeUncertainNoAccept(
  deps: CreatePausedDeps,
  opts: {
    step: MetaCreatePausedStep;
    actId: string;
    accessToken: string;
    objectName: string;
    attemptStartedAt: string;
  }
): Promise<void> {
  await deps.graph.reconcileUncertain(opts);
}

export async function runMetaAdsCreatePaused(opts: {
  authenticatedUserId: string;
  draftId: string;
  deps?: Partial<CreatePausedDeps>;
}): Promise<CreatePausedResult> {
  const userId = String(opts.authenticatedUserId || "").trim();
  const draftId = String(opts.draftId || "").trim();
  if (!userId) {
    return {
      ok: false,
      code: "not_allowed",
      message: "Authentication required.",
      draft: null,
      createAttemptId: null,
    };
  }
  if (!draftId) {
    return {
      ok: false,
      code: "not_found",
      message: "Draft id required.",
      draft: null,
      createAttemptId: null,
    };
  }

  const env = opts.deps?.env ?? process.env;
  const decide =
    opts.deps?.decideWriteAccess ?? decideMetaAdsCreatePausedWriteAccess;
  const writeAccess = decide(userId, env);
  const nowMs = opts.deps?.nowMs ?? (() => Date.now());

  if (!writeAccess.allowed) {
    return {
      ok: false,
      code: "not_allowed",
      message: writeAccess.reason || "Create-paused not allowed.",
      draft: null,
      createAttemptId: null,
    };
  }

  const deps: CreatePausedDeps = {
    findDraft: (id, uid) => MetaAdsDraftDAO.findByIdForUser(id, uid),
    claimDraft: (id, uid, attemptId) =>
      MetaAdsDraftDAO.claimForCreatePaused(id, uid, {}, attemptId),
    reclaimStale: (id, uid, prev, next, metadata) =>
      MetaAdsDraftDAO.reclaimStaleCreatingAttempt(id, uid, prev, next, metadata),
    persistProgress: (id, uid, patch) =>
      MetaAdsDraftDAO.persistCreatePausedProgress(id, uid, patch),
    loadWriteContext: loadMetaAdsWriteContext,
    decideWriteAccess: decide,
    graph: createLiveMetaCreatePausedGraphAdapter(),
    env,
    nowMs,
    ...opts.deps,
  };

  let existing = await deps.findDraft(draftId, userId);
  if (!existing) {
    return {
      ok: false,
      code: "not_found",
      message: "Draft not found.",
      draft: null,
      createAttemptId: null,
    };
  }

  if (existing.status === "created_paused" && existing.metaCampaignId) {
    return {
      ok: true,
      code: "already_created",
      message: "Draft already created on Meta (paused).",
      draft: existing,
      createAttemptId: existing.createAttemptId,
    };
  }

  // Blocked uncertain (partial_failure or creating) — no automatic POST retry.
  if (
    hasUnresolvedUncertainStep(existing) &&
    nextCreatePausedStep(existing).step === "blocked_uncertain"
  ) {
    return {
      ok: false,
      code: "blocked_uncertain",
      message:
        "A previous Meta write has an uncertain outcome. Do not retry create-paused until operator resolution (or confirmed Meta ids / image hash are recorded).",
      draft: existing,
      createAttemptId: existing.createAttemptId,
    };
  }

  let createAttemptId = randomUUID();
  const attemptStartedAt = new Date(nowMs()).toISOString();

  if (existing.status === "creating") {
    const reclaim = canReclaimStaleCreating(existing, nowMs());
    if (!reclaim.ok) {
      return {
        ok: false,
        code:
          reclaim.reason === "uncertain_step_blocks_reclaim"
            ? "blocked_uncertain"
            : "conflict_creating",
        message:
          reclaim.reason === "lease_active"
            ? "Create-paused is already in progress for this draft (active lease)."
            : reclaim.reason === "uncertain_step_blocks_reclaim"
              ? "Stale creating attempt has an uncertain Meta step; operator resolution required before reclaim."
              : "Create-paused is already in progress for this draft.",
        draft: existing,
        createAttemptId: existing.createAttemptId,
      };
    }
    const prevAttempt = String(existing.createAttemptId || "");
    if (!prevAttempt) {
      return {
        ok: false,
        code: "conflict_creating",
        message: "Creating draft has no attempt id; cannot reclaim safely.",
        draft: existing,
        createAttemptId: null,
      };
    }
    // Only reclaim when next step is known safe (confirmed progress, no uncertain).
    const next = nextCreatePausedStep(existing);
    if (next.step === "blocked_uncertain") {
      return {
        ok: false,
        code: "blocked_uncertain",
        message:
          "Cannot reclaim: next Meta step may have been accepted without a persisted id.",
        draft: existing,
        createAttemptId: existing.createAttemptId,
      };
    }
    const reclaimed = await deps.reclaimStale(
      draftId,
      userId,
      prevAttempt,
      createAttemptId,
      mergeCreatePausedState(existing, {
        attemptStartedAt,
        leaseExpiresAt: leaseExpiresAtFromNow(nowMs()),
        outcomeUncertain: false,
        uncertainStep: null,
        lastStep: "reclaimed",
        previousAttemptId: prevAttempt,
      })
    );
    if (!reclaimed) {
      return {
        ok: false,
        code: "conflict_creating",
        message: "Failed to reclaim stale creating attempt (concurrent reclaim).",
        draft: await deps.findDraft(draftId, userId),
        createAttemptId: null,
      };
    }
    existing = reclaimed;
  } else {
    // Fresh claim from draft|failed|partial_failure
    const claimed = await deps.claimDraft(draftId, userId, createAttemptId);
    if (!claimed) {
      const again = await deps.findDraft(draftId, userId);
      return {
        ok: false,
        code: "conflict_creating",
        message:
          "Could not claim draft for create-paused (concurrent attempt or ineligible status).",
        draft: again,
        createAttemptId: again?.createAttemptId ?? null,
      };
    }
    existing = claimed;
  }

  let writeCtx: ResolvedMetaAdsWriteContext;
  try {
    writeCtx = await deps.loadWriteContext(userId);
    assertMetaAdsPageBoundForCreative(writeCtx);
  } catch (e) {
    const message =
      e instanceof MetaAdsWriteAuthError ||
      e instanceof MetaAdsWriteContextError
        ? e.message
        : "Write context unavailable.";
    const failed = await markFailure(deps, existing, userId, createAttemptId, {
      status: "failed",
      code: "validation_failed",
      message,
    });
    return {
      ok: false,
      code: "validation_failed",
      message,
      draft: failed ?? existing,
      createAttemptId,
    };
  }

  if (
    String(writeCtx.integrationId) !== String(existing.integrationId) ||
    (writeCtx.adAccountRowId &&
      String(writeCtx.adAccountRowId) !== String(existing.adAccountId))
  ) {
    const failed = await markFailure(deps, existing, userId, createAttemptId, {
      status: "failed",
      code: "validation_failed",
      message:
        "Draft account binding no longer matches the selected Meta Ads account.",
    });
    return {
      ok: false,
      code: "validation_failed",
      message:
        "Draft account binding no longer matches the selected Meta Ads account.",
      draft: failed ?? existing,
      createAttemptId,
    };
  }

  let mapped: ReturnType<typeof assertTrafficCreatePausedDraft>;
  try {
    mapped = assertTrafficCreatePausedDraft({
      name: existing.name,
      objective: existing.objective,
      dailyBudgetMajor: existing.dailyBudgetMajor,
      currency: existing.currency,
      accountCurrency: writeCtx.currency,
      targeting: existing.targeting,
      placements: existing.placements,
      destinationUrl: existing.destinationUrl,
      callToAction: existing.callToAction,
      primaryText: existing.primaryText,
      headline: existing.headline,
      scheduleStart: existing.scheduleStart,
      scheduleEnd: existing.scheduleEnd,
      specialAdCategories: specialAdCategoriesFromDraft(existing),
    });
  } catch (e) {
    const message =
      e instanceof MetaAdsCreatePausedMapError
        ? e.message
        : "Draft failed Traffic create-paused validation.";
    const failed = await markFailure(deps, existing, userId, createAttemptId, {
      status: "failed",
      code: "validation_failed",
      message,
    });
    return {
      ok: false,
      code: "validation_failed",
      message,
      draft: failed ?? existing,
      createAttemptId,
    };
  }

  if (!existing.sourceImageId) {
    const failed = await markFailure(deps, existing, userId, createAttemptId, {
      status: "failed",
      code: "validation_failed",
      message: "Owned creative sourceImageId is required before create-paused.",
    });
    return {
      ok: false,
      code: "validation_failed",
      message: "Owned creative sourceImageId is required before create-paused.",
      draft: failed ?? existing,
      createAttemptId,
    };
  }

  let draft: MetaAdsDraftRow;
  try {
    draft = await persistOrConflict(deps, existing.id, userId, createAttemptId, {
      metadata: mergeCreatePausedState(existing, {
        attemptStartedAt,
        leaseExpiresAt: leaseExpiresAtFromNow(nowMs()),
        lastStep: "claimed",
        outcomeUncertain: false,
        uncertainStep: null,
      }),
    });
  } catch (e) {
    if (e instanceof AttemptConflictError) {
      return {
        ok: false,
        code: "attempt_conflict",
        message: e.message,
        draft: await deps.findDraft(draftId, userId),
        createAttemptId,
      };
    }
    throw e;
  }

  const actId = writeCtx.actId;
  const token = writeCtx.userAccessToken;
  const pageId = writeCtx.pageId!;

  try {
    // --- Campaign ---
    let campaignId = draft.metaCampaignId;
    if (!campaignId) {
      draft = await assertMutationAllowed(deps, userId, draft, createAttemptId);
      const campaignParams = buildTrafficCampaignParams(mapped);
      const outcome = await deps.graph.createCampaign(
        actId,
        token,
        campaignParams
      );
      if (outcome.kind === "confirmed") {
        campaignId = outcome.id;
        draft = await persistOrConflict(
          deps,
          draft.id,
          userId,
          createAttemptId,
          {
            metaCampaignId: campaignId,
            metadata: mergeCreatePausedState(draft, {
              lastStep: "campaign",
              campaignName: campaignParams.name,
              leaseExpiresAt: leaseExpiresAtFromNow(nowMs()),
              outcomeUncertain: false,
              uncertainStep: null,
            }),
          }
        );
      } else if (outcome.kind === "uncertain") {
        await probeUncertainNoAccept(deps, {
          step: "campaign",
          actId,
          accessToken: token,
          objectName: campaignParams.name,
          attemptStartedAt,
        });
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: "partial_failure",
          code: "outcome_uncertain",
          message: outcome.message,
          step: "campaign",
          outcomeUncertain: true,
          createPausedPatch: { campaignName: campaignParams.name },
        });
        return {
          ok: false,
          code: "outcome_uncertain",
          message: safeMessage(outcome.message),
          draft: failed,
          createAttemptId,
        };
      } else {
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: draft.metaCampaignId ? "partial_failure" : "failed",
          code: outcome.code,
          message: outcome.message,
          step: "campaign",
        });
        return {
          ok: false,
          code: draft.metaCampaignId ? "partial_failure" : "failed",
          message: safeMessage(outcome.message),
          draft: failed,
          createAttemptId,
        };
      }
    }

    // --- Ad set ---
    let adsetId = draft.metaAdsetId;
    if (!adsetId) {
      draft = await assertMutationAllowed(deps, userId, draft, createAttemptId);
      const adsetParams = buildTrafficAdSetParams(mapped, campaignId!);
      const outcome = await deps.graph.createAdSet(actId, token, adsetParams);
      if (outcome.kind === "confirmed") {
        adsetId = outcome.id;
        draft = await persistOrConflict(
          deps,
          draft.id,
          userId,
          createAttemptId,
          {
            metaAdsetId: adsetId,
            metadata: mergeCreatePausedState(draft, {
              lastStep: "adset",
              adsetName: adsetParams.name,
              leaseExpiresAt: leaseExpiresAtFromNow(nowMs()),
              outcomeUncertain: false,
              uncertainStep: null,
            }),
          }
        );
      } else if (outcome.kind === "uncertain") {
        await probeUncertainNoAccept(deps, {
          step: "adset",
          actId,
          accessToken: token,
          objectName: adsetParams.name,
          attemptStartedAt,
        });
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: "partial_failure",
          code: "outcome_uncertain",
          message: outcome.message,
          step: "adset",
          outcomeUncertain: true,
          createPausedPatch: { adsetName: adsetParams.name },
        });
        return {
          ok: false,
          code: "outcome_uncertain",
          message: safeMessage(outcome.message),
          draft: failed,
          createAttemptId,
        };
      } else {
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: "partial_failure",
          code: outcome.code,
          message: outcome.message,
          step: "adset",
        });
        return {
          ok: false,
          code: "partial_failure",
          message: safeMessage(outcome.message),
          draft: failed,
          createAttemptId,
        };
      }
    }

    // --- Image ---
    let imageHash = imageHashFromDraft(draft);
    if (!imageHash) {
      draft = await assertMutationAllowed(deps, userId, draft, createAttemptId);
      // Re-check adimages contract specifically at upload boundary.
      const access = deps.decideWriteAccess(userId, deps.env ?? process.env);
      if (!access.adimagesContractApproved || !access.graphWritesEnabled) {
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: "partial_failure",
          code: access.code,
          message: access.reason || "Image upload gates failed.",
          step: "image",
        });
        return {
          ok: false,
          code: "not_allowed",
          message: access.reason || "Image upload gates failed.",
          draft: failed,
          createAttemptId,
        };
      }
      const outcome = await deps.graph.uploadImage({
        authenticatedUserId: userId,
        sourceImageId: existing.sourceImageId!,
      });
      if (outcome.kind === "confirmed") {
        imageHash = outcome.result.imageHash;
        draft = await persistOrConflict(
          deps,
          draft.id,
          userId,
          createAttemptId,
          {
            metadata: mergeCreatePausedState(draft, {
              lastStep: "image",
              metaImageHash: imageHash,
              uploadFilename: outcome.result.uploadFilename,
              contentSha256: outcome.result.contentSha256,
              leaseExpiresAt: leaseExpiresAtFromNow(nowMs()),
              outcomeUncertain: false,
              uncertainStep: null,
            }),
          }
        );
      } else if (outcome.kind === "uncertain") {
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: "partial_failure",
          code: "outcome_uncertain",
          message: outcome.message,
          step: "image",
          outcomeUncertain: true,
        });
        return {
          ok: false,
          code: "outcome_uncertain",
          message: safeMessage(outcome.message),
          draft: failed,
          createAttemptId,
        };
      } else {
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: "partial_failure",
          code: outcome.code,
          message: outcome.message,
          step: "image",
        });
        return {
          ok: false,
          code: "partial_failure",
          message: safeMessage(outcome.message),
          draft: failed,
          createAttemptId,
        };
      }
    }

    // --- Creative ---
    let creativeId = draft.metaCreativeId;
    if (!creativeId) {
      draft = await assertMutationAllowed(deps, userId, draft, createAttemptId);
      const creativeParams = buildTrafficCreativeParams({
        name: mapped.name,
        pageId,
        destinationUrl: mapped.destinationUrl,
        imageHash: imageHash!,
        primaryText: mapped.primaryText,
        headline: mapped.headline,
        callToAction: mapped.callToAction,
      });
      const outcome = await deps.graph.createCreative(
        actId,
        token,
        creativeParams
      );
      if (outcome.kind === "confirmed") {
        creativeId = outcome.id;
        draft = await persistOrConflict(
          deps,
          draft.id,
          userId,
          createAttemptId,
          {
            metaCreativeId: creativeId,
            metadata: mergeCreatePausedState(draft, {
              lastStep: "creative",
              creativeName: creativeParams.name,
              leaseExpiresAt: leaseExpiresAtFromNow(nowMs()),
              outcomeUncertain: false,
              uncertainStep: null,
            }),
          }
        );
      } else if (outcome.kind === "uncertain") {
        await probeUncertainNoAccept(deps, {
          step: "creative",
          actId,
          accessToken: token,
          objectName: creativeParams.name,
          attemptStartedAt,
        });
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: "partial_failure",
          code: "outcome_uncertain",
          message: outcome.message,
          step: "creative",
          outcomeUncertain: true,
          createPausedPatch: { creativeName: creativeParams.name },
        });
        return {
          ok: false,
          code: "outcome_uncertain",
          message: safeMessage(outcome.message),
          draft: failed,
          createAttemptId,
        };
      } else {
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: "partial_failure",
          code: outcome.code,
          message: outcome.message,
          step: "creative",
        });
        return {
          ok: false,
          code: "partial_failure",
          message: safeMessage(outcome.message),
          draft: failed,
          createAttemptId,
        };
      }
    }

    // --- Ad ---
    let adId = draft.metaAdId;
    if (!adId) {
      draft = await assertMutationAllowed(deps, userId, draft, createAttemptId);
      const adParams = buildTrafficAdParams({
        name: mapped.name,
        adsetId: adsetId!,
        creativeId: creativeId!,
      });
      const outcome = await deps.graph.createAd(actId, token, adParams);
      if (outcome.kind === "confirmed") {
        adId = outcome.id;
        draft = await persistOrConflict(
          deps,
          draft.id,
          userId,
          createAttemptId,
          {
            metaAdId: adId,
            status: "created_paused",
            createdOnMetaAt: new Date(nowMs()).toISOString(),
            lastErrorCode: null,
            lastErrorMessage: null,
            metadata: mergeCreatePausedState(draft, {
              lastStep: "done",
              outcomeUncertain: false,
              uncertainStep: null,
              adName: adParams.name,
              leaseExpiresAt: leaseExpiresAtFromNow(nowMs()),
            }),
          }
        );
      } else if (outcome.kind === "uncertain") {
        await probeUncertainNoAccept(deps, {
          step: "ad",
          actId,
          accessToken: token,
          objectName: adParams.name,
          attemptStartedAt,
        });
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: "partial_failure",
          code: "outcome_uncertain",
          message: outcome.message,
          step: "ad",
          outcomeUncertain: true,
          createPausedPatch: { adName: adParams.name },
        });
        return {
          ok: false,
          code: "outcome_uncertain",
          message: safeMessage(outcome.message),
          draft: failed,
          createAttemptId,
        };
      } else {
        const failed = await markFailure(deps, draft, userId, createAttemptId, {
          status: "partial_failure",
          code: outcome.code,
          message: outcome.message,
          step: "ad",
        });
        return {
          ok: false,
          code: "partial_failure",
          message: safeMessage(outcome.message),
          draft: failed,
          createAttemptId,
        };
      }
    } else if (draft.status !== "created_paused") {
      draft = await persistOrConflict(deps, draft.id, userId, createAttemptId, {
        status: "created_paused",
        createdOnMetaAt:
          draft.createdOnMetaAt || new Date(nowMs()).toISOString(),
        lastErrorCode: null,
        lastErrorMessage: null,
        metadata: mergeCreatePausedState(draft, {
          lastStep: "done",
          outcomeUncertain: false,
          uncertainStep: null,
          leaseExpiresAt: leaseExpiresAtFromNow(nowMs()),
        }),
      });
    }

    return {
      ok: true,
      code: "created_paused",
      message: "Meta campaign stack created in PAUSED status.",
      draft,
      createAttemptId,
    };
  } catch (e) {
    if (e instanceof AttemptConflictError) {
      return {
        ok: false,
        code: "attempt_conflict",
        message: safeMessage(e.message),
        draft: await deps.findDraft(draftId, userId),
        createAttemptId,
      };
    }
    throw e;
  }
}

export { createDisabledMetaCreatePausedGraphAdapter };
