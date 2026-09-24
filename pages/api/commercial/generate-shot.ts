/**
 * Thin Phase 5 orchestration route.
 *
 * POST /api/commercial/generate-shot
 *
 * NOT for normal Studio UI (use /api/commercial/generate).
 * Requires authentication. Does not accept client userId.
 *
 * Intentionally refused: this path does not bill Video Credits.
 * All customer commercial generation must go through /api/commercial/generate
 * (single reserve → generate → consume for 15s/30s).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
  maxDuration: 30,
};

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

  return res.status(403).json({
    ok: false,
    error:
      "Per-shot generation is not billed separately. Use /api/commercial/generate for a full commercial (15s or 30s Video Credits).",
    code: "USE_BILLED_COMMERCIAL_GENERATE",
  });
}
