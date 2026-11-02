/**
 * POST /api/commercial/fix/timeline — thumbnails and shot cuts for the Edit screen.
 * Free; never edits.
 *
 * Body: { sourceKey?, sessionId?, videoId? }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { GenerationLocksDAO } from "@/database/models/GenerationLocks.dao";
import {
  fixSourceRefFromBody,
  loadSourceMedia,
  resolveFixSource,
} from "@/lib/creative-studio/commercial-production/fix/fix-source.server";
import { extractThumbnails } from "@/lib/creative-studio/commercial-production/fix/shots";
import { FREE_FIXES_PER_VIDEO } from "@/lib/creative-studio/commercial-production/fix/fix-pricing";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required", code: "AUTH_REQUIRED" });
  }

  try {
    const resolved = await resolveFixSource(userId, fixSourceRefFromBody(req.body || {}));
    if (!resolved.ok) {
      return res.status(resolved.status).json({ ok: false, error: resolved.error, code: resolved.code });
    }
    const media = await loadSourceMedia(resolved.source);
    const [thumbnails, freeFixesUsed] = await Promise.all([
      extractThumbnails(media.master, media.durationSeconds),
      GenerationLocksDAO.countFreeFixes(userId, resolved.source.rootKey),
    ]);
    return res.status(200).json({
      ok: true,
      durationSeconds: media.durationSeconds,
      cuts: media.cuts,
      thumbnails,
      freeFixesLeft: Math.max(0, FREE_FIXES_PER_VIDEO - freeFixesUsed),
    });
  } catch (error) {
    console.error("[api/commercial/fix/timeline]", error);
    return res.status(500).json({
      ok: false,
      error: "We couldn't open this video for editing. Please try again.",
      code: "FIX_TIMELINE_FAILED",
    });
  }
}
