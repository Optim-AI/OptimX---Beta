/**
 * POST /api/commercial/fix/plan — free preview of a fix.
 *
 * The user picked seconds on the timeline and said what should change. We snap the
 * pick to the shot it sits in, have Gemini write the fix, and correct the shot's
 * first frame — so the user sees a before/after picture before anything is
 * animated or charged.
 *
 * Body: { sourceKey? | sessionId + videoId, selectedStart, selectedEnd, request, productName? }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import sharp from "sharp";
import { getUserIdFromRequest } from "@/auth/request";
import { GenerationLocksDAO } from "@/database/models/GenerationLocks.dao";
import { previewFix } from "@/lib/creative-studio/commercial-production/fix/edit-segment";
import {
  fixSourceRefFromBody,
  loadSourceMedia,
  resolveFixSource,
} from "@/lib/creative-studio/commercial-production/fix/fix-source.server";
import { snapToShots } from "@/lib/creative-studio/commercial-production/fix/shots";
import {
  describeFixPrice,
  fixBillableSeconds,
  FREE_FIXES_PER_VIDEO,
  priceFix,
} from "@/lib/creative-studio/commercial-production/fix/fix-pricing";

export const config = {
  maxDuration: 180,
};

const jpegDataUrl = async (png: Buffer, quality = 88) =>
  `data:image/jpeg;base64,${(await sharp(png).jpeg({ quality }).toBuffer()).toString("base64")}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required", code: "AUTH_REQUIRED" });
  }

  const body = req.body || {};
  const request = typeof body.request === "string" ? body.request.trim() : "";
  const selectedStart = Number(body.selectedStart);
  const selectedEnd = Number(body.selectedEnd);
  if (!request) {
    return res.status(400).json({ ok: false, error: "Tell us what should change.", code: "EMPTY_REQUEST" });
  }
  if (!Number.isFinite(selectedStart) || !Number.isFinite(selectedEnd)) {
    return res.status(400).json({ ok: false, error: "Pick the part to change on the timeline.", code: "NO_SELECTION" });
  }

  try {
    const resolved = await resolveFixSource(userId, fixSourceRefFromBody(body));
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, code: resolved.code });
    }
    const media = await loadSourceMedia(resolved.source);
    const window = snapToShots(selectedStart, selectedEnd, media.cuts, media.durationSeconds);

    const result = await previewFix({
      master: media.master,
      startSeconds: window.startSeconds,
      endSeconds: window.endSeconds,
      durationSeconds: media.durationSeconds,
      width: media.width,
      height: media.height,
      request,
      productName: typeof body.productName === "string" ? body.productName.slice(0, 200) : undefined,
    });
    if (!result.ok) {
      return res.status(422).json({ ok: false, error: result.reason, code: "NOT_FIXABLE_HERE" });
    }

    const freeFixesUsed = await GenerationLocksDAO.countFreeFixes(userId, resolved.source.rootKey);
    // Charged on what the user picked; widening to the whole shot is our choice for a smooth join.
    const price = priceFix({ startSeconds: window.selectedStart, endSeconds: window.selectedEnd, freeFixesUsed });
    const seconds = fixBillableSeconds(window.selectedStart, window.selectedEnd);
    return res.status(200).json({
      ok: true,
      window,
      instructions: result.preview.instructions,
      beforeFrame: await jpegDataUrl(result.preview.beforeFrame, 80),
      afterFrame: await jpegDataUrl(result.preview.afterFrame, 92),
      seconds,
      price,
      priceLabel: describeFixPrice(price, seconds),
      freeFixesLeft: Math.max(0, FREE_FIXES_PER_VIDEO - freeFixesUsed),
    });
  } catch (error) {
    console.error("[api/commercial/fix/plan]", error);
    return res.status(500).json({
      ok: false,
      error: "We couldn't prepare that fix right now. Please try again.",
      code: "FIX_PLAN_FAILED",
    });
  }
}
