/**
 * Thin commercial production route — Phase 6 + Phase 7 + Phase 8 QC.
 *
 * POST /api/commercial/generate
 *
 * Authenticated. Bills SkalX Video Credits (reserve → generate → consume/release).
 * Default generationMode = native_continuous (ONE 15s/30s Seedance generation).
 *
 * Body: {
 *   campaign | brief: CampaignBrief,
 *   generationVersion?,
 *   forceRegenerate?,
 *   generationMode?: "native_continuous" | "shot_based_fallback",
 *   availableAssets?,
 *   runCommercialQc?: boolean,
 *   recoverOnly?: boolean   // fetch a finished result for this version; never starts or bills
 * }
 *
 * A completed version is never generated or billed twice: repeats replay the stored result free.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import type { CampaignBrief } from "@/lib/creative-studio/commercial-production/campaign/types";
import {
  runCampaignProduction,
  CampaignOrchestratorError,
} from "@/lib/creative-studio/commercial-production/campaign-orchestrator";
import {
  produceFinalCommercial,
  CampaignExecutorError,
} from "@/lib/creative-studio/commercial-production/campaign-executor";
import type { CampaignGenerationMode } from "@/lib/creative-studio/commercial-production/campaign-compiler/types";
import {
  assertAndReserveVideoCredits,
  finalizeVideoReservation,
  VideoBillingError,
} from "@/lib/billing/video-billing";
import { isCampaignDurationSeconds } from "@/lib/creative-studio/commercial-production/campaign/campaign-duration";
import { GenerationLocksDAO } from "@/database/models/GenerationLocks.dao";
import type { CommercialBlueprintCore } from "@/lib/creative-studio/commercial-production/commercial-director/types";
import type { ShotPlan } from "@/lib/creative-studio/commercial-production/shot-planner/types";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
  // Pro plan: up to 800s (Hobby hard-caps at 300s). Seedance poll + QC often exceeds 5 min.
  maxDuration: 800,
};

const FUNCTION_MAX_DURATION_MS = 800_000;
/** Stop provider polling this long before the function limit — time for download, storage, TTS and QC. */
const POST_GENERATION_RESERVE_MS = 150_000;

function errorSummary(error: unknown): Record<string, unknown> {
  const details = (error as { details?: Record<string, unknown> })?.details;
  return {
    error: error instanceof Error ? error.message : String(error),
    // Kept so an accepted-but-unfinished provider job can be recovered by hand.
    providerJobId: typeof details?.providerJobId === "string" ? details.providerJobId : undefined,
  };
}

type StoredCommercialResult = {
  generationMode?: string;
  finalCommercial: { commercialQC?: unknown } & Record<string, unknown>;
};

function storedResult(summary: unknown): StoredCommercialResult | null {
  const s = summary as Partial<StoredCommercialResult> | null | undefined;
  return s?.finalCommercial && typeof s.finalCommercial === "object"
    ? (s as StoredCommercialResult)
    : null;
}

function replayResponse(stored: StoredCommercialResult, referenceId: string) {
  return {
    ok: true,
    replayed: true,
    referenceId,
    generationMode: stored.generationMode,
    finalCommercial: stored.finalCommercial,
    commercialQC: stored.finalCommercial.commercialQC,
    creditsCharged: 0,
  };
}

function isMissingLockTableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;
  return (
    code === "42P01" ||
    /generation_job_locks/i.test(msg) ||
    /relation .* does not exist/i.test(msg)
  );
}

type PendingProvider = {
  providerJobId: string;
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
  generationMode: CampaignGenerationMode;
  resumes?: number;
};

/** A resumed job may be handed over again this many times before we give up (~40 min total). */
const MAX_PROVIDER_RESUMES = 2;

function stillRunningHandover(
  error: unknown,
  generationMode: CampaignGenerationMode,
  previousResumes = 0
): PendingProvider | null {
  if (!(error instanceof CampaignExecutorError) || error.code !== "PROVIDER_STILL_RUNNING") return null;
  const d = error.details as Partial<PendingProvider> | undefined;
  if (!d?.providerJobId || !d.blueprint || !d.shotPlan) return null;
  if (previousResumes >= MAX_PROVIDER_RESUMES) return null;
  return {
    providerJobId: d.providerJobId,
    blueprint: d.blueprint,
    shotPlan: d.shotPlan,
    generationMode,
    resumes: previousResumes,
  };
}

/**
 * Finish a generation whose provider job outlived the request that started it:
 * wait for that same job, then run voiceover, end card and QC, and bill once.
 */
async function resumeProviderJob(params: {
  res: NextApiResponse;
  userId: string;
  brief: CampaignBrief;
  lockKey: string;
  reservationId: string | null;
  pending: PendingProvider;
  generationVersion: string;
  duration: number;
  availableAssets: unknown;
  runCommercialQc: boolean;
}) {
  const { res, userId, brief, lockKey, reservationId, pending, generationVersion, duration } = params;
  const startedAt = Date.now();
  console.log("[api/commercial/generate] resuming provider job", {
    userId,
    lockKey,
    providerJobId: pending.providerJobId,
    resumes: pending.resumes ?? 0,
  });
  try {
    const finalCommercial = await produceFinalCommercial(
      {
        brief,
        generationVersion,
        generationMode: pending.generationMode,
        availableAssets: params.availableAssets as never,
        blueprint: pending.blueprint,
        shotPlan: pending.shotPlan,
        skipDownload: false,
        skipStorage: false,
        userId,
        runCommercialQc: params.runCommercialQc,
      },
      {
        resumeProviderJobId: pending.providerJobId,
        productIsolator: null,
        deadlineAt: startedAt + FUNCTION_MAX_DURATION_MS - POST_GENERATION_RESERVE_MS,
      }
    );

    if (reservationId) {
      try {
        await finalizeVideoReservation({ userId, reservationId, success: true });
      } catch (billErr) {
        // The hold may have been released as stale meanwhile; the customer still gets the video.
        console.error("[api/commercial/generate] resume consume failed", billErr);
      }
    }
    await GenerationLocksDAO.markCompleted(lockKey, {
      generationVersion,
      duration,
      generationMode: pending.generationMode,
      finalCommercial,
    });
    return res.status(200).json({
      ok: true,
      referenceId: lockKey,
      generationMode: pending.generationMode,
      finalCommercial,
      commercialQC: finalCommercial.commercialQC,
    });
  } catch (error) {
    const again = stillRunningHandover(error, pending.generationMode, (pending.resumes ?? 0) + 1);
    if (again) {
      await GenerationLocksDAO.markWaitingOnProvider(lockKey, again);
      return res.status(202).json({ ok: false, pending: true, code: "GENERATION_STILL_RENDERING" });
    }
    if (reservationId) {
      try {
        await finalizeVideoReservation({ userId, reservationId, success: false });
      } catch (releaseErr) {
        console.error("[api/commercial/generate] resume release failed", releaseErr);
      }
    }
    await GenerationLocksDAO.markFailed(lockKey, errorSummary(error)).catch((e) =>
      console.error("[api/commercial/generate] resume markFailed", e)
    );
    const message =
      error instanceof CampaignExecutorError && error.code === "PROVIDER_STILL_RUNNING"
        ? "Our video partner is very slow right now and this video didn't finish. No Video Credits were used — please try again later."
        : error instanceof Error
          ? error.message
          : "Campaign production failed";
    return res.status(500).json({
      ok: false,
      error: message,
      code: error instanceof CampaignExecutorError ? error.code : undefined,
    });
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const startedAt = Date.now();
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({
      ok: false,
      error: "Authentication required",
      code: "AUTH_REQUIRED",
    });
  }

  let reservationId: string | null = null;
  let lockKey: string | null = null;
  let lockClaimed = false;

  try {
    const body = req.body || {};
    // Never trust client-supplied userId
    const brief = (body.campaign || body.brief) as CampaignBrief | undefined;
    if (!brief?.campaignId) {
      return res.status(400).json({
        ok: false,
        error: "campaign.campaignId is required",
        code: "INVALID_CAMPAIGN_INPUT",
      });
    }

    const duration = Number(brief.campaignDuration);
    if (!isCampaignDurationSeconds(duration)) {
      return res.status(400).json({
        ok: false,
        error: "Campaign duration must be 15 or 30 seconds",
        code: "INVALID_DURATION",
      });
    }

    const generationVersion =
      typeof body.generationVersion === "string" ? body.generationVersion : "v1";
    const forceRegenerate = Boolean(body.forceRegenerate);
    const generationMode = (
      body.generationMode === "shot_based_fallback"
        ? "shot_based_fallback"
        : "native_continuous"
    ) as CampaignGenerationMode;

    const referenceId = `commercial:${brief.campaignId}:${generationVersion}:${duration}`;

    // The browser lost a long response: hand back the finished video, or say it is still running.
    if (body.recoverOnly === true) {
      let existing: Awaited<ReturnType<typeof GenerationLocksDAO.getByKey>> = null;
      try {
        existing = await GenerationLocksDAO.getByKey(referenceId);
      } catch (lookupErr) {
        if (!isMissingLockTableError(lookupErr)) throw lookupErr;
      }
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ ok: false, error: "No generation found", code: "GENERATION_NOT_FOUND" });
      }
      if (existing.status === "in_progress") {
        const pending = (existing.resultSummary as { pendingProvider?: PendingProvider } | null)?.pendingProvider;
        if (pending?.providerJobId) {
          const takeover = await GenerationLocksDAO.claimProviderResume(referenceId, userId);
          if (takeover) {
            return resumeProviderJob({
              res,
              userId,
              brief,
              lockKey: referenceId,
              reservationId: existing.reservationId,
              pending,
              generationVersion,
              duration,
              availableAssets: body.availableAssets,
              runCommercialQc: body.runCommercialQc !== false,
            });
          }
        }
        return res.status(202).json({ ok: false, pending: true, code: "GENERATION_IN_PROGRESS" });
      }
      const replay = storedResult(existing.resultSummary);
      if (existing.status === "completed" && replay) {
        return res.status(200).json(replayResponse(replay, referenceId));
      }
      return res.status(404).json({ ok: false, error: "This generation did not finish", code: "GENERATION_NOT_FOUND" });
    }

    lockKey = referenceId;

    // Cross-instance job lock (before reserve) — prevents duplicate provider jobs.
    // Soft-degrades if migration not applied yet.
    try {
      const claim = await GenerationLocksDAO.tryClaim({ lockKey, userId });
      if (!claim.claimed) {
        // Already billed and finished — return that video again at no charge.
        const replay = claim.reason === "completed" ? storedResult(claim.lock.resultSummary) : null;
        if (replay) {
          return res.status(200).json(replayResponse(replay, referenceId));
        }
        const status =
          claim.reason === "in_progress" || claim.reason === "completed" ? 409 : 403;
        return res.status(status).json({
          ok: false,
          error:
            claim.reason === "in_progress"
              ? "A generation for this request is already in progress"
              : claim.reason === "completed"
                ? "This generation already completed. Use a new generationVersion to make another version."
                : "Generation lock belongs to another user",
          code:
            claim.reason === "in_progress"
              ? "GENERATION_IN_PROGRESS"
              : claim.reason === "completed"
                ? "GENERATION_ALREADY_COMPLETED"
                : "GENERATION_LOCK_FORBIDDEN",
          referenceId,
        });
      }
      lockClaimed = true;
    } catch (lockErr) {
      if (!isMissingLockTableError(lockErr)) throw lockErr;
      // Live schema includes generation_job_locks. Soft-degrade only outside production.
      if (process.env.NODE_ENV === 'production') {
        console.error(
          '[api/commercial/generate] generation_job_locks required in production — refusing soft-degrade'
        );
        return res.status(503).json({
          ok: false,
          error: 'Generation locking is unavailable. Please try again shortly.',
          code: 'GENERATION_LOCK_UNAVAILABLE',
        });
      }
      console.warn(
        "[api/commercial/generate] generation_job_locks missing — apply Phase 1 migration for cross-instance idempotency"
      );
    }

    const reserved = await assertAndReserveVideoCredits({
      userId,
      durationSeconds: duration,
      referenceId,
    });
    reservationId = reserved.reservationId;

    if (lockClaimed && lockKey) {
      try {
        await GenerationLocksDAO.attachReservation(lockKey, reservationId);
      } catch (attachErr) {
        if (!isMissingLockTableError(attachErr)) throw attachErr;
      }
    }

    // Phase 7 default: native continuous final commercial
    if (body.produceFinal !== false) {
      try {
        const finalCommercial = await produceFinalCommercial({
          brief,
          generationVersion,
          forceRegenerate,
          generationMode,
          availableAssets: body.availableAssets,
          // Server-pinned: customer videos are always downloaded and stored.
          skipDownload: false,
          skipStorage: false,
          userId,
          runCommercialQc: body.runCommercialQc !== false,
        }, {
          deadlineAt: startedAt + FUNCTION_MAX_DURATION_MS - POST_GENERATION_RESERVE_MS,
        });

        await finalizeVideoReservation({
          userId,
          reservationId,
          success: true,
        });
        reservationId = null;

        if (lockClaimed && lockKey) {
          try {
            await GenerationLocksDAO.markCompleted(lockKey, {
              generationVersion,
              duration,
              generationMode,
              // Kept so a repeat of this request replays the video instead of billing again.
              finalCommercial,
            });
          } catch (markErr) {
            if (!isMissingLockTableError(markErr)) throw markErr;
          }
        }

        return res.status(200).json({
          ok: true,
          // Identifies this finished video for "Fix a part".
          referenceId,
          generationMode,
          finalCommercial,
          commercialQC: finalCommercial.commercialQC,
          creditsCharged: reserved.requiredCredits,
          creditUsage: {
            fromSubscription: reserved.fromSubscription,
            fromAddon: reserved.fromAddon,
            requiredCredits: reserved.requiredCredits,
            creditType: 'video' as const,
          },
        });
      } catch (genError) {
        // Runway is still rendering at our time limit: keep the credits on hold and
        // let the browser's next check finish the same job (no second provider charge).
        const handover = lockClaimed && lockKey ? stillRunningHandover(genError, generationMode) : null;
        if (handover && lockKey) {
          try {
            await GenerationLocksDAO.markWaitingOnProvider(lockKey, handover);
            reservationId = null;
            console.warn("[api/commercial/generate] provider still rendering — handed over", {
              userId,
              lockKey,
              providerJobId: handover.providerJobId,
            });
            return res.status(202).json({
              ok: false,
              pending: true,
              code: "GENERATION_STILL_RENDERING",
              referenceId,
              error: (genError as Error).message,
            });
          } catch (handoverErr) {
            console.error("[api/commercial/generate] handover failed", handoverErr);
          }
        }
        await finalizeVideoReservation({
          userId,
          reservationId: reservationId!,
          success: false,
        });
        reservationId = null;
        if (lockClaimed && lockKey) {
          try {
            await GenerationLocksDAO.markFailed(lockKey, errorSummary(genError));
          } catch (markErr) {
            if (!isMissingLockTableError(markErr)) {
              console.error("[api/commercial/generate] lock markFailed", markErr);
            }
          }
        }
        throw genError;
      }
    }

    // Legacy Phase 6: production run / manifest only (shot pipeline) — still billed
    try {
      const run = await runCampaignProduction({
        brief,
        generationVersion,
        forceRegenerate,
        availableAssets: body.availableAssets,
        skipDownload: false,
        skipStorage: false,
        userId,
      });

      await finalizeVideoReservation({
        userId,
        reservationId,
        success: true,
      });
      reservationId = null;

      if (lockClaimed && lockKey) {
        try {
          await GenerationLocksDAO.markCompleted(lockKey, {
            generationVersion,
            duration,
            mode: "legacy_run",
          });
        } catch (markErr) {
          if (!isMissingLockTableError(markErr)) throw markErr;
        }
      }

      return res.status(200).json({
        ok: true,
        run,
        manifest: run.manifest,
        creditsCharged: reserved.requiredCredits,
        creditUsage: {
          fromSubscription: reserved.fromSubscription,
          fromAddon: reserved.fromAddon,
          requiredCredits: reserved.requiredCredits,
          creditType: 'video' as const,
        },
      });
    } catch (genError) {
      await finalizeVideoReservation({
        userId,
        reservationId: reservationId!,
        success: false,
      });
      reservationId = null;
      if (lockClaimed && lockKey) {
        try {
          await GenerationLocksDAO.markFailed(lockKey, errorSummary(genError));
        } catch (markErr) {
          if (!isMissingLockTableError(markErr)) {
            console.error("[api/commercial/generate] lock markFailed", markErr);
          }
        }
      }
      throw genError;
    }
  } catch (error: unknown) {
    if (reservationId) {
      try {
        await finalizeVideoReservation({ userId, reservationId, success: false });
      } catch (releaseErr) {
        console.error("[api/commercial/generate] failed to release reservation", releaseErr);
      }
    }
    if (lockClaimed && lockKey) {
      try {
        await GenerationLocksDAO.markFailed(lockKey, errorSummary(error));
      } catch (markErr) {
        if (!isMissingLockTableError(markErr)) {
          console.error("[api/commercial/generate] lock markFailed", markErr);
        }
      }
    }

    if (error instanceof VideoBillingError) {
      const status = error.code === "INSUFFICIENT_CREDITS" ? 402 : 400;
      return res.status(status).json({
        ok: false,
        error: error.message,
        code: error.code,
        requiredCredits: error.requiredCredits,
        availableCredits: error.availableCredits,
        durationSeconds: error.durationSeconds,
      });
    }
    if (error instanceof CampaignExecutorError) {
      return res.status(error.code === "INVALID_SPEC" ? 400 : 500).json({
        ok: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    if (error instanceof CampaignOrchestratorError) {
      const status =
        error.code === "INVALID_CAMPAIGN_INPUT" || error.code === "DURATION_MISMATCH"
          ? 400
          : 500;
      return res.status(status).json({
        ok: false,
        error: error.message,
        code: error.code,
        stage: error.stage,
        details: error.details,
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/commercial/generate]", message);
    return res.status(500).json({
      ok: false,
      error: message || "Campaign production failed",
    });
  }
}
