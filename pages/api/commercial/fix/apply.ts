/**
 * POST /api/commercial/fix/apply — make a fix the user approved in the preview.
 *
 * Body: { sourceKey? | sessionId + videoId, fixId, selectedStart, selectedEnd,
 *         motionPrompt, userSummary?, fixedFrame (image data URL from the preview), recoverOnly? }
 *
 * The redone window and the price are recomputed here from the user's selection
 * (never trusted from the client): the first FREE_FIXES_PER_VIDEO fixes of a video,
 * up to FREE_FIX_MAX_SECONDS picked, are free; others reserve Video Credits, consumed
 * on success and released on failure. The same fixId never runs or bills twice.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import sharp from "sharp";
import { getUserIdFromRequest } from "@/auth/request";
import { GenerationLocksDAO } from "@/database/models/GenerationLocks.dao";
import {
  assertAndReserveFixCredits,
  finalizeVideoReservation,
  VideoBillingError,
} from "@/lib/billing/video-billing";
import { runFix } from "@/lib/creative-studio/commercial-production/fix/edit-segment";
import {
  fixSourceRefFromBody,
  loadSourceMedia,
  resolveFixSource,
} from "@/lib/creative-studio/commercial-production/fix/fix-source.server";
import { snapToShots } from "@/lib/creative-studio/commercial-production/fix/shots";
import { FREE_FIXES_PER_VIDEO, priceFix } from "@/lib/creative-studio/commercial-production/fix/fix-pricing";

export const config = {
  api: {
    bodyParser: { sizeLimit: "8mb" },
  },
  maxDuration: 800,
};

const FUNCTION_MAX_DURATION_MS = 800_000;
/** Time kept for splicing, end card and storage after the clip is animated. */
const POST_ANIMATE_RESERVE_MS = 120_000;

type StoredFix = {
  free: boolean;
  credits: number;
  finalCommercial: Record<string, unknown>;
};

function storedFix(summary: unknown): StoredFix | null {
  const s = summary as Partial<StoredFix> | null | undefined;
  return s?.finalCommercial && typeof s.finalCommercial === "object" ? (s as StoredFix) : null;
}

/** The approved frame, as PNG; rejects anything that is not an image. */
async function decodeFixedFrame(value: unknown): Promise<Buffer | null> {
  if (typeof value !== "string") return null;
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
  if (!match) return null;
  try {
    return await sharp(Buffer.from(match[2], "base64")).png().toBuffer();
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const startedAt = Date.now();
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required", code: "AUTH_REQUIRED" });
  }

  const body = req.body || {};
  const fixId = typeof body.fixId === "string" ? body.fixId : "";
  if (!/^[A-Za-z0-9-]{8,64}$/.test(fixId)) {
    return res.status(400).json({ ok: false, error: "Invalid fix request", code: "INVALID_FIX_ID" });
  }

  let lockKey: string | null = null;
  let lockClaimed = false;
  let reservationId: string | null = null;

  try {
    const resolved = await resolveFixSource(userId, fixSourceRefFromBody(body));
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, code: resolved.code });
    }
    const { source } = resolved;
    lockKey = `${GenerationLocksDAO.fixKeyPrefix(source.rootKey)}${fixId}`;

    const replay = (lock: { resultSummary: unknown }) => {
      const stored = storedFix(lock.resultSummary);
      return stored
        ? res.status(200).json({
            ok: true,
            replayed: true,
            referenceId: lockKey,
            finalCommercial: stored.finalCommercial,
            free: stored.free,
            creditsCharged: 0,
          })
        : null;
    };

    // The browser lost the response: return the finished fix or say it is still running.
    if (body.recoverOnly === true) {
      const existing = await GenerationLocksDAO.getByKey(lockKey);
      if (existing?.userId === userId && existing.status === "in_progress") {
        return res.status(202).json({ ok: false, pending: true, code: "FIX_IN_PROGRESS" });
      }
      if (existing?.userId === userId && existing.status === "completed") {
        const replayed = replay(existing);
        if (replayed) return replayed;
      }
      return res.status(404).json({ ok: false, error: "This fix did not finish", code: "FIX_NOT_FOUND" });
    }

    const motionPrompt = typeof body.motionPrompt === "string" ? body.motionPrompt.trim().slice(0, 1200) : "";
    const fixedFrame = await decodeFixedFrame(body.fixedFrame);
    const selectedStart = Number(body.selectedStart);
    const selectedEnd = Number(body.selectedEnd);
    if (!motionPrompt || !fixedFrame || !Number.isFinite(selectedStart) || !Number.isFinite(selectedEnd)) {
      return res.status(400).json({ ok: false, error: "Preview the fix first", code: "INVALID_PLAN" });
    }

    const existing = await GenerationLocksDAO.getByKey(lockKey);
    if (existing?.userId === userId && existing.status === "completed") {
      const replayed = replay(existing);
      if (replayed) return replayed;
    }
    // One fix per video at a time keeps the free-fix count exact.
    if (await GenerationLocksDAO.hasActiveFix(userId, source.rootKey)) {
      return res.status(409).json({
        ok: false,
        error: "A fix for this video is already running. Please wait for it to finish.",
        code: "FIX_IN_PROGRESS",
      });
    }

    const media = await loadSourceMedia(source);
    const window = snapToShots(selectedStart, selectedEnd, media.cuts, media.durationSeconds);

    const claim = await GenerationLocksDAO.tryClaim({ lockKey, userId });
    if (!claim.claimed) {
      const replayed = claim.reason === "completed" ? replay(claim.lock) : null;
      if (replayed) return replayed;
      return res.status(409).json({ ok: false, error: "This fix is already running.", code: "FIX_IN_PROGRESS" });
    }
    lockClaimed = true;

    const freeFixesUsed = await GenerationLocksDAO.countFreeFixes(userId, source.rootKey);
    const price = priceFix({ startSeconds: window.selectedStart, endSeconds: window.selectedEnd, freeFixesUsed });
    if (!price.free) {
      reservationId = (
        await assertAndReserveFixCredits({ userId, credits: price.credits, referenceId: lockKey })
      ).reservationId;
      await GenerationLocksDAO.attachReservation(lockKey, reservationId);
    }

    const fixed = await runFix({
      master: media.master,
      finishing: source.finishing,
      startSeconds: window.startSeconds,
      endSeconds: window.endSeconds,
      fixedFrame,
      motionPrompt,
      deadlineAt: startedAt + FUNCTION_MAX_DURATION_MS - POST_ANIMATE_RESERVE_MS,
    });

    if (reservationId) {
      await finalizeVideoReservation({ userId, reservationId, success: true });
      reservationId = null;
    }

    const finalCommercial = {
      ...source.finalCommercial,
      videoUrl: fixed.videoUrl,
      masterVideoUrl: fixed.masterVideoUrl,
      finishing: source.finishing,
      generationVersion: `${source.finalCommercial.generationVersion || "v1"}-fix`,
      fix: {
        startSeconds: window.startSeconds,
        endSeconds: window.endSeconds,
        summary: typeof body.userSummary === "string" ? body.userSummary.slice(0, 300) : undefined,
        fixedFrom: source.sourceKey,
      },
      createdAt: new Date().toISOString(),
    };
    await GenerationLocksDAO.markCompleted(lockKey, {
      kind: "fix",
      rootKey: source.rootKey,
      sourceKey: source.sourceKey,
      free: price.free,
      credits: price.free ? 0 : price.credits,
      finalCommercial,
    });

    return res.status(200).json({
      ok: true,
      referenceId: lockKey,
      finalCommercial,
      free: price.free,
      creditsCharged: price.free ? 0 : price.credits,
      freeFixesLeft: Math.max(0, FREE_FIXES_PER_VIDEO - freeFixesUsed - (price.free ? 1 : 0)),
    });
  } catch (error) {
    if (reservationId) {
      try {
        await finalizeVideoReservation({ userId, reservationId, success: false });
      } catch (releaseErr) {
        console.error("[api/commercial/fix/apply] failed to release reservation", releaseErr);
      }
    }
    if (lockClaimed && lockKey) {
      await GenerationLocksDAO.markFailed(lockKey, {
        error: error instanceof Error ? error.message : String(error),
      }).catch((markErr) => console.error("[api/commercial/fix/apply] markFailed", markErr));
    }
    if (error instanceof VideoBillingError) {
      return res.status(error.code === "INSUFFICIENT_CREDITS" ? 402 : 400).json({
        ok: false,
        error: error.message,
        code: error.code,
        requiredCredits: error.requiredCredits,
        availableCredits: error.availableCredits,
      });
    }
    console.error("[api/commercial/fix/apply]", error);
    return res.status(500).json({
      ok: false,
      error: "The fix didn't work this time. Nothing was charged — please try again.",
      code: "FIX_FAILED",
    });
  }
}
