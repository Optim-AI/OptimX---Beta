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
import {
  updateStrategyCopyForSession,
  type StrategyCopyEdits,
} from "@/lib/creative-studio/poster-generation/strategy/copy-edits";

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" },
  },
  maxDuration: 60,
};

/**
 * POST  — run the strategist for the session.
 * PATCH — save the user's headline / supporting line / CTA edits on the same
 *         strategy (concepts stay valid). 0 image credits either way.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST" && req.method !== "PATCH") {
    res.setHeader("Allow", "POST, PATCH");
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

  if (req.method === "PATCH") {
    const edits: StrategyCopyEdits = {};
    for (const key of ["headline", "supporting", "cta"] as const) {
      if (key in body) edits[key] = typeof body[key] === "string" ? (body[key] as string) : null;
    }
    try {
      const strategy = await updateStrategyCopyForSession({ sessionId, userId, edits });
      return res.status(200).json({ ok: true, strategy, creditsCharged: 0 });
    } catch (err: unknown) {
      if (isPosterStrategyError(err) || isPosterSessionError(err)) {
        const status = err.code === "NOT_FOUND" || err.code === "MISSING_BRIEF" ? 404 : err.code === "VALIDATION" ? 400 : 500;
        return res.status(status).json({ ok: false, error: err.toPublicJSON(), creditsCharged: 0 });
      }
      console.error("[posterStrategy] copy edit error", err);
      return res.status(500).json({
        ok: false,
        error: { code: "INTERNAL", message: "Failed to save your edits", retryable: true },
        creditsCharged: 0,
      });
    }
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
