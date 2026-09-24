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
 *   runCommercialQc?: boolean
 * }
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

function isMissingLockTableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code;
  return (
    code === "42P01" ||
    /generation_job_locks/i.test(msg) ||
    /relation .* does not exist/i.test(msg)
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

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
    lockKey = referenceId;

    // Cross-instance job lock (before reserve) — prevents duplicate provider jobs.
    // Soft-degrades if migration not applied yet.
    try {
      const claim = await GenerationLocksDAO.tryClaim({
        lockKey,
        userId,
        force: forceRegenerate,
      });
      if (!claim.claimed) {
        const status =
          claim.reason === "in_progress" || claim.reason === "completed" ? 409 : 403;
        return res.status(status).json({
          ok: false,
          error:
            claim.reason === "in_progress"
              ? "A generation for this request is already in progress"
              : claim.reason === "completed"
                ? "This generation already completed. Use forceRegenerate with a new generationVersion to bill a new run."
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
          skipDownload: Boolean(body.skipDownload),
          skipStorage: Boolean(body.skipStorage),
          concurrency: typeof body.concurrency === "number" ? body.concurrency : undefined,
          userId,
          runCommercialQc: body.runCommercialQc !== false,
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
            });
          } catch (markErr) {
            if (!isMissingLockTableError(markErr)) throw markErr;
          }
        }

        return res.status(200).json({
          ok: true,
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
        await finalizeVideoReservation({
          userId,
          reservationId: reservationId!,
          success: false,
        });
        reservationId = null;
        if (lockClaimed && lockKey) {
          try {
            await GenerationLocksDAO.markFailed(lockKey, {
              error: genError instanceof Error ? genError.message : String(genError),
            });
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
        skipDownload: Boolean(body.skipDownload),
        skipStorage: Boolean(body.skipStorage),
        concurrency: typeof body.concurrency === "number" ? body.concurrency : undefined,
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
          await GenerationLocksDAO.markFailed(lockKey, {
            error: genError instanceof Error ? genError.message : String(genError),
          });
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
        await GenerationLocksDAO.markFailed(lockKey, {
          error: error instanceof Error ? error.message : String(error),
        });
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
