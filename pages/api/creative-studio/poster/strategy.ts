// pages/api/creative-studio/poster/strategy.ts
// Phase 4: Marketing Strategist — 0 image credits

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  isPosterSessionError,
  isPosterStrategyError,
  runMarketingStrategyForSession,
} from "@/lib/creative-studio/poster-generation";
import { readJsonBody, readStringField } from "@/lib/creative-studio/poster-generation/read-json-body";

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" },
  },
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const body = readJsonBody(req);
  const sessionId =
    readStringField(body, "sessionId") ||
    (typeof req.query.sessionId === "string" ? req.query.sessionId.trim() : null);
  if (!sessionId) {
    console.warn("[posterStrategy] missing sessionId", {
      bodyType: typeof req.body,
      keys: Object.keys(body).slice(0, 20),
      query: req.query.sessionId,
    });
    return res.status(400).json({ ok: false, error: "sessionId is required" });
  }

  const forceRegenerate = body.forceRegenerate === true;

  try {
    const result = await runMarketingStrategyForSession({
      sessionId,
      userId,
      forceRegenerate,
    });

    console.log("[posterStrategy] success", {
      userId,
      sessionId,
      reused: result.reused,
      objective: result.strategy.objective,
      briefId: result.strategy.briefId,
    });

    return res.status(200).json({
      ok: true,
      reused: result.reused,
      strategy: result.strategy,
      session: {
        id: result.session.id,
        status: result.session.status,
        version: result.session.version,
      },
      creditsCharged: 0,
    });
  } catch (err: unknown) {
    if (isPosterStrategyError(err) || isPosterSessionError(err)) {
      const status =
        err.code === "NOT_FOUND" || err.code === "MISSING_BRIEF"
          ? 404
          : err.code === "VALIDATION" || err.code === "MALFORMED_MODEL_OUTPUT"
            ? 400
            : err.code === "CONFLICT"
              ? 409
              : 500;
      return res.status(status).json({
        ok: false,
        error: err.toPublicJSON(),
        creditsCharged: 0,
      });
    }
    console.error("[posterStrategy] error", err);
    return res.status(500).json({
      ok: false,
      error: {
        code: "INTERNAL",
        message: "Failed to generate marketing strategy",
        retryable: true,
      },
      creditsCharged: 0,
    });
  }
}
