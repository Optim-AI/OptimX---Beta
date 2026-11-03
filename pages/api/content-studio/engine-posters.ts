// pages/api/content-studio/engine-posters.ts
// Ad Studio "Generate Poster": the Brand Studio poster engine, driven by the ad angle
// and campaign strategy (lib/content-studio/engine-posters.ts). Charges normal credits.

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  AdStudioPosterError,
  generateAdStudioPosters,
} from "@/lib/content-studio/engine-posters";
import {
  isPosterGenerationError,
  isPosterSessionError,
  isPosterStrategyError,
} from "@/lib/creative-studio/poster-generation";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
  maxDuration: 300,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  const { product, angle, campaign, brand } = req.body ?? {};
  if (!product || typeof product !== "object") {
    return res.status(400).json({ ok: false, error: "Product is required" });
  }

  try {
    const result = await generateAdStudioPosters({
      userId,
      product,
      angle: angle && typeof angle === "object" && typeof angle.title === "string" ? angle : null,
      campaign: campaign && typeof campaign === "object" ? campaign : null,
      fallbackBrand: brand && typeof brand === "object" ? { name: brand.name, tone: brand.tone, industry: brand.industry, audience: brand.targetAudience } : null,
    });
    console.log("[adStudioPosters] done", { userId, sessionId: result.sessionId, images: result.images.length, failed: result.failed });
    if (!result.images.length) {
      return res.status(502).json({ ok: false, error: "Poster generation failed. No credits were charged for failed posters." });
    }
    return res.status(200).json({ ok: true, images: result.images, sessionId: result.sessionId, creditsCharged: result.creditsCharged });
  } catch (err: unknown) {
    if (err instanceof AdStudioPosterError) return res.status(err.status).json({ ok: false, error: err.message });
    if (isPosterGenerationError(err) || isPosterSessionError(err) || isPosterStrategyError(err)) {
      const code = (err as { code?: string }).code;
      const status = code === "INSUFFICIENT_CREDITS" ? 402 : code === "CONFLICT" ? 409 : 500;
      const pub = (err as { toPublicJSON?: () => { message?: string } }).toPublicJSON?.();
      return res.status(status).json({ ok: false, error: pub?.message || "Poster generation failed", code });
    }
    console.error("[adStudioPosters] error", err);
    return res.status(500).json({ ok: false, error: "Poster generation failed" });
  }
}
