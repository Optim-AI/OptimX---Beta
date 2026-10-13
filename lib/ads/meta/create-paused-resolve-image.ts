/**
 * Operator resolution for uncertain Meta Ad image uploads (PR W2.5.1).
 *
 * Does not trust a browser-supplied hash alone. The server verifies the
 * hash exists on the selected ad account via read-only Graph GET
 * act_{id}/adimages?hashes=... (secondary docs; gated by adimages contract).
 *
 * Filename-based reconciliation is never used.
 *
 * After success: draft stays `partial_failure` with metaImageHash set and
 * outcomeUncertain cleared so a subsequent create-paused can claim and resume
 * at the creative step without re-uploading.
 */

import {
  MetaAdsDraftDAO,
  type MetaAdsDraftRow,
} from "@/database/models/MetaAdsDraft.dao";
import { decideMetaAdsCreatePausedWriteAccess } from "@/lib/ads/meta/create-paused-gates";
import {
  createLiveMetaCreatePausedGraphAdapter,
  type MetaCreatePausedGraphAdapter,
} from "@/lib/ads/meta/create-paused-graph";
import {
  hasUnresolvedUncertainStep,
  mergeCreatePausedState,
  readCreatePausedState,
} from "@/lib/ads/meta/create-paused-lease";
import {
  loadMetaAdsWriteContext,
  MetaAdsWriteAuthError,
} from "@/lib/ads/providers/meta/load-write-context";
import { redactMetaSecrets } from "@/lib/ads/providers/meta/client";

export type ResolveUncertainImageResult = {
  ok: boolean;
  code: string;
  message: string;
  draft: MetaAdsDraftRow | null;
};

export type ResolveUncertainImageDeps = {
  findDraft: typeof MetaAdsDraftDAO.findByIdForUser;
  persistResolution: typeof MetaAdsDraftDAO.persistPartialFailureResolution;
  loadWriteContext: typeof loadMetaAdsWriteContext;
  decideWriteAccess: typeof decideMetaAdsCreatePausedWriteAccess;
  graph: MetaCreatePausedGraphAdapter;
  env?: Record<string, string | undefined>;
};

const HASH_RE = /^[a-f0-9]{16,128}$/i;

export async function resolveMetaAdsUncertainImageHash(opts: {
  authenticatedUserId: string;
  draftId: string;
  /** Candidate hash from Ads Manager / operator — verified server-side on act_*. */
  imageHash: string;
  /**
   * Must match the draft's create_attempt_id that produced the uncertain image
   * step (binds resolution to that attempt).
   */
  createAttemptId: string;
  deps?: Partial<ResolveUncertainImageDeps>;
}): Promise<ResolveUncertainImageResult> {
  const userId = String(opts.authenticatedUserId || "").trim();
  const draftId = String(opts.draftId || "").trim();
  const imageHash = String(opts.imageHash || "").trim();
  const createAttemptId = String(opts.createAttemptId || "").trim();

  if (!userId) {
    return {
      ok: false,
      code: "unauthenticated",
      message: "Authentication required.",
      draft: null,
    };
  }
  if (!draftId) {
    return {
      ok: false,
      code: "not_found",
      message: "Draft id required.",
      draft: null,
    };
  }
  if (!createAttemptId) {
    return {
      ok: false,
      code: "attempt_required",
      message: "createAttemptId is required to resolve an uncertain image upload.",
      draft: null,
    };
  }
  if (!HASH_RE.test(imageHash)) {
    return {
      ok: false,
      code: "invalid_image_hash",
      message: "imageHash format is invalid.",
      draft: null,
    };
  }

  const env = opts.deps?.env ?? process.env;
  const decide =
    opts.deps?.decideWriteAccess ?? decideMetaAdsCreatePausedWriteAccess;
  const access = decide(userId, env);
  if (!access.allowed) {
    return {
      ok: false,
      code: access.code,
      message: access.reason || "Not allowed.",
      draft: null,
    };
  }

  const deps: ResolveUncertainImageDeps = {
    findDraft: (id, uid) => MetaAdsDraftDAO.findByIdForUser(id, uid),
    persistResolution: (id, uid, patch) =>
      MetaAdsDraftDAO.persistPartialFailureResolution(id, uid, patch),
    loadWriteContext: loadMetaAdsWriteContext,
    decideWriteAccess: decide,
    graph: createLiveMetaCreatePausedGraphAdapter(),
    env,
    ...opts.deps,
  };

  const draft = await deps.findDraft(draftId, userId);
  if (!draft) {
    return {
      ok: false,
      code: "not_found",
      message: "Draft not found.",
      draft: null,
    };
  }

  if (draft.status !== "partial_failure") {
    return {
      ok: false,
      code: "invalid_status",
      message:
        "Uncertain image resolution requires status partial_failure.",
      draft,
    };
  }

  if (String(draft.createAttemptId || "") !== createAttemptId) {
    return {
      ok: false,
      code: "attempt_conflict",
      message: "createAttemptId does not match the draft's create attempt.",
      draft,
    };
  }

  const state = readCreatePausedState(draft);
  if (
    !hasUnresolvedUncertainStep(draft) ||
    state.uncertainStep !== "image"
  ) {
    return {
      ok: false,
      code: "not_uncertain_image",
      message:
        "Draft is not blocked on an uncertain image-upload step.",
      draft,
    };
  }

  if (state.metaImageHash) {
    return {
      ok: false,
      code: "already_resolved",
      message: "Image hash is already recorded on this draft.",
      draft,
    };
  }

  let writeCtx;
  try {
    writeCtx = await deps.loadWriteContext(userId);
  } catch (e) {
    return {
      ok: false,
      code: "write_context_unavailable",
      message:
        e instanceof MetaAdsWriteAuthError
          ? e.message
          : "Write context unavailable.",
      draft,
    };
  }

  if (
    String(writeCtx.integrationId) !== String(draft.integrationId) ||
    (writeCtx.adAccountRowId &&
      String(writeCtx.adAccountRowId) !== String(draft.adAccountId))
  ) {
    return {
      ok: false,
      code: "account_mismatch",
      message: "Draft account binding no longer matches the selected account.",
      draft,
    };
  }

  const verify = deps.graph.verifyAdImageHash;
  if (!verify) {
    return {
      ok: false,
      code: "verification_unavailable",
      message: "Ad image hash verification is not available.",
      draft,
    };
  }

  const okHash = await verify({
    actId: writeCtx.actId,
    accessToken: writeCtx.userAccessToken,
    imageHash,
  });
  if (!okHash) {
    return {
      ok: false,
      code: "hash_not_on_account",
      message: redactMetaSecrets(
        "Image hash was not found on the selected Meta ad account. Confirm the hash in Ads Manager for this account, then retry."
      ),
      draft,
    };
  }

  const metadata = mergeCreatePausedState(draft, {
    metaImageHash: imageHash,
    outcomeUncertain: false,
    uncertainStep: null,
    lastStep: "image",
    operatorImageResolution: {
      resolvedAt: new Date().toISOString(),
      resolvedByUserId: userId,
      imageHash,
      verification: "graph_adimages_hashes",
      previousAttemptId: createAttemptId,
    },
  });

  const updated = await deps.persistResolution(draftId, userId, {
    status: "partial_failure",
    lastErrorCode: null,
    lastErrorMessage: null,
    metadata,
  });

  if (!updated) {
    return {
      ok: false,
      code: "persist_conflict",
      message: "Could not persist image hash resolution.",
      draft,
    };
  }

  return {
    ok: true,
    code: "image_resolved",
    message:
      "Image hash verified on the selected ad account and recorded. Re-run create-paused to continue from the creative step.",
    draft: updated,
  };
}

/**
 * Manual recovery when Graph hash verification cannot be used:
 * 1. In Meta Ads Manager / Marketing API, locate the uploaded image hash for the account.
 * 2. Confirm it belongs to this attempt's upload (time/account).
 * 3. Call POST .../resolve-image with that hash + the draft createAttemptId
 *    (server re-verifies via GET adimages hashes), OR wait until contract
 *    approval and use this endpoint.
 * 4. Do not re-POST create-paused image upload while outcome_uncertain remains.
 * 5. Never paste hashes into DB without ownership + account verification.
 */
export const META_ADS_UNCERTAIN_IMAGE_MANUAL_RECOVERY = [
  "Do not blindly retry image upload after timeout.",
  "Confirm hash on the selected ad account in Ads Manager.",
  "Use resolve-image API (server verifies hash on act_*) when gates allow.",
  "Then re-run create-paused to resume at creative.",
] as const;
