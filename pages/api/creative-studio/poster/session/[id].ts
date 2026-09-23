// pages/api/creative-studio/poster/session/[id].ts
// Phase 2 + Phase 9: get / patch — browser may only update brief / select / cancel

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  createPosterGenerationSessionService,
  isPosterSessionError,
} from "@/lib/creative-studio/poster-generation";
import {
  isPosterEngineDebugEnabled,
  sanitizeSessionForClient,
} from "@/lib/creative-studio/poster-generation/production-safety";

export const config = {
  api: {
    // Product / reference images may be embedded as data URLs in the brief
    bodyParser: { sizeLimit: "25mb" },
  },
};

/** Actions the browser is allowed to call. Everything else is server-internal. */
const CLIENT_PATCH_ACTIONS = new Set([
  "updateBrief",
  "selectConcept",
  "cancel",
]);

/** Next sometimes leaves oversized JSON bodies as a raw string (char-indexed). */
function readJsonBody(req: NextApiRequest): Record<string, unknown> {
  const raw = req.body;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) {
    try {
      const parsed = JSON.parse(raw.toString("utf8"));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    // Detect string-as-object: only numeric keys
    const keys = Object.keys(raw);
    if (
      keys.length > 100 &&
      keys.slice(0, 20).every((k) => /^\d+$/.test(k)) &&
      !("action" in raw)
    ) {
      try {
        const asString = keys
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => (raw as Record<string, string>)[k])
          .join("");
        const parsed = JSON.parse(asString);
        return parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    return raw as Record<string, unknown>;
  }
  return {};
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const id = typeof req.query.id === "string" ? req.query.id : null;
  if (!id) {
    return res.status(400).json({ ok: false, error: "Missing session id" });
  }

  const service = createPosterGenerationSessionService();

  try {
    if (req.method === "GET") {
      const session = await service.getSession(id, userId);
      const payload = isPosterEngineDebugEnabled(req)
        ? session
        : sanitizeSessionForClient(session);
      return res.status(200).json({ ok: true, session: payload });
    }

    if (req.method === "PATCH") {
      const body = readJsonBody(req);
      const action = String(body.action || "");

      if (!CLIENT_PATCH_ACTIONS.has(action)) {
        console.warn("[posterGenerationSession] blocked client patch", {
          action: action || "(empty)",
          bodyType: typeof req.body,
          bodyKeysSample: Object.keys(body || {}).slice(0, 12),
        });
        return res.status(403).json({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: action
              ? "This session action is not available from the client. Use the dedicated poster APIs."
              : "Session update was empty or too large. Try again with fewer/smaller product images.",
          },
        });
      }

      let session;
      switch (action) {
        case "updateBrief":
          session = await service.updateBrief(
            id,
            userId,
            body.brief as Parameters<typeof service.updateBrief>[2]
          );
          break;
        case "selectConcept":
          session = await service.selectConcept(
            id,
            userId,
            (body.conceptIds || body.conceptId) as string | string[]
          );
          break;
        case "cancel":
          session = await service.cancelSession(id, userId);
          break;
        default:
          return res.status(400).json({
            ok: false,
            error: `Unknown action: ${action || "(empty)"}`,
          });
      }

      return res.status(200).json({
        ok: true,
        session: sanitizeSessionForClient(session),
      });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err: unknown) {
    if (isPosterSessionError(err)) {
      const status =
        err.code === "NOT_FOUND"
          ? 404
          : err.code === "FORBIDDEN"
            ? 403
            : err.code === "CONFLICT"
              ? 409
              : err.code === "VALIDATION" || err.code === "MALFORMED_PERSISTED_DATA"
                ? 400
                : 500;
      return res.status(status).json({ ok: false, error: err.toPublicJSON() });
    }
    console.error("[posterGenerationSession] api.error", err);
    return res.status(500).json({
      ok: false,
      error: { code: "INTERNAL", message: "Internal server error", retryable: true },
    });
  }
}
