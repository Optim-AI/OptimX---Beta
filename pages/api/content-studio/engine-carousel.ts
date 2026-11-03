// pages/api/content-studio/engine-carousel.ts
// Ad Studio carousel plan items → the Brand Studio carousel engine. Plans the slide
// story only (no credits); the page then generates slides through the existing
// /api/creative-studio/poster/carousel/* endpoints.

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { AdStudioPosterError, planAdStudioCarousel } from "@/lib/content-studio/engine-posters";
import {
  isPosterSessionError,
  isPosterStrategyError,
} from "@/lib/creative-studio/poster-generation";
import { carouselErrorHttpStatus, isPosterCarouselError } from "@/lib/creative-studio/poster-generation/carousel";

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } },
  maxDuration: 180,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  const { product, angle, campaign, brand, slideCount } = req.body ?? {};
  if (!product || typeof product !== "object") {
    return res.status(400).json({ ok: false, error: "Product is required" });
  }

  try {
    const planned = await planAdStudioCarousel({
      userId,
      product,
      angle: angle && typeof angle === "object" && typeof angle.title === "string" ? angle : null,
      campaign: campaign && typeof campaign === "object" ? campaign : null,
      fallbackBrand: brand && typeof brand === "object" ? { name: brand.name, tone: brand.tone, industry: brand.industry, audience: brand.targetAudience } : null,
      slideCount: Number(slideCount) || 5,
    });
    return res.status(200).json({ ok: true, campaign: planned, creditsCharged: 0 });
  } catch (err: unknown) {
    if (err instanceof AdStudioPosterError) return res.status(err.status).json({ ok: false, error: err.message });
    if (isPosterCarouselError(err)) {
      return res.status(carouselErrorHttpStatus(err.code)).json({ ok: false, error: err.toPublicJSON().message, code: err.code });
    }
    if (isPosterSessionError(err) || isPosterStrategyError(err)) {
      return res.status(500).json({ ok: false, error: err.toPublicJSON().message, code: err.code });
    }
    console.error("[adStudioCarousel] error", err);
    return res.status(500).json({ ok: false, error: "Couldn't plan the carousel. Please try again." });
  }
}
