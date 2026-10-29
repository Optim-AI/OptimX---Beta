// pages/api/photo-studio/shoot.ts
// Shoot one shot of a saved Photo Studio session (1 image credit per photo kept).

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { CreativeStudioSessionDAO } from "@/database/models/CreativeStudioSession.dao";
import { getShot } from "@/lib/photo-studio/shots";
import { getShootSession, PhotoStudioError, shootShot } from "@/lib/photo-studio/shoot";
import type { LightingMood, PhotoAspect, ShootSettings } from "@/lib/photo-studio/types";

export const config = { maxDuration: 300 };

const ASPECTS: PhotoAspect[] = ["1:1", "4:5", "9:16"];
const LIGHTS: LightingMood[] = ["studio_soft", "natural_daylight", "golden_hour", "dramatic"];

function cleanSettings(raw: any, fallback: ShootSettings): ShootSettings {
  const model = raw?.model && typeof raw.model === "object" ? raw.model : fallback.model || {};
  return {
    aspect: ASPECTS.includes(raw?.aspect) ? raw.aspect : fallback.aspect,
    lighting: LIGHTS.includes(raw?.lighting) ? raw.lighting : fallback.lighting,
    backdrop: /^#[0-9a-f]{6}$/i.test(raw?.backdrop || "") ? raw.backdrop : fallback.backdrop,
    model: {
      gender: ["any", "woman", "man"].includes(model.gender) ? model.gender : "any",
      age: ["any", "18-25", "25-40", "40+"].includes(model.age) ? model.age : "any",
      look: typeof model.look === "string" ? model.look.slice(0, 80) : undefined,
    },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId : "";
  const shotId = typeof req.body?.shotId === "string" ? req.body.shotId : "";
  if (!sessionId || !getShot(shotId)) return res.status(400).json({ ok: false, error: "sessionId and a valid shotId are required" });

  try {
    const state = await getShootSession(userId, sessionId);
    if (!state) return res.status(404).json({ ok: false, error: "Shoot not found" });
    const settings = cleanSettings(req.body?.settings, state.settings);
    if (JSON.stringify(settings) !== JSON.stringify(state.settings)) {
      const s = await CreativeStudioSessionDAO.getByIdAndUserId(sessionId, userId);
      await CreativeStudioSessionDAO.updateByIdAndUserId(sessionId, userId, { config: { ...((s?.config as any) || {}), settings } } as any);
    }
    const results = await shootShot({
      userId,
      sessionId,
      shotId,
      variations: Number(req.body?.variations) || 1,
      aspect: settings.aspect,
      state: { ...state, settings },
    });
    return res.status(200).json({ ok: true, results, creditsCharged: results.length });
  } catch (e) {
    if (e instanceof PhotoStudioError) return res.status(e.status).json({ ok: false, error: e.message, code: e.code });
    console.error("[photoStudio] shoot failed", { userId, sessionId, shotId, error: (e as Error)?.message });
    return res.status(500).json({ ok: false, error: "This shot didn't come out. No credits were charged — try again." });
  }
}
