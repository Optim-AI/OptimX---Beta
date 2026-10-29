// pages/api/photo-studio/start.ts
// Photo Studio step 1: upload a product photo → product read, a clean master packshot
// (the product alone, recreated and fidelity-checked) and its cut-out, recommended
// shot list, saved shoot session. No credits.

import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { getUserIdFromRequest } from "@/auth/request";
import { getUserBrand } from "@/lib/brand-kit/server";
import { getProductCutout } from "@/lib/creative-studio/product-cutouts";
import { getDefaultPosterImageProvider } from "@/lib/creative-studio/poster-generation/generation/provider-router";
import { storePosterGeneratedImage } from "@/lib/creative-studio/poster-generation/generation/storage";
import { analyzeProduct } from "@/lib/photo-studio/analyze";
import { refineCutout } from "@/lib/photo-studio/cutout-refine";
import { prepareMaster } from "@/lib/photo-studio/master";
import { geminiFidelityChecker } from "@/lib/photo-studio/render";
import { recommendShots, SHOTS } from "@/lib/photo-studio/shots";
import { createShootSession, photoCutoutProvider } from "@/lib/photo-studio/shoot";
import type { ShootSettings } from "@/lib/photo-studio/types";

export const config = {
  api: { bodyParser: { sizeLimit: "12mb" } },
  maxDuration: 180,
};

const MAX_BYTES = 10 * 1024 * 1024;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  const image = typeof req.body?.image === "string" ? req.body.image : "";
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(image);
  if (!m) return res.status(400).json({ ok: false, error: "Upload a PNG, JPG or WebP product photo." });
  const raw = Buffer.from(m[2], "base64");
  if (raw.length > MAX_BYTES) return res.status(400).json({ ok: false, error: "That photo is over 10 MB." });

  try {
    // Normalise (orientation, max 2400px) so every later step works from the same image.
    const buffer = await sharp(raw).rotate().resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
    const meta = await sharp(buffer).metadata();
    if ((meta.width || 0) < 300 || (meta.height || 0) < 300) {
      return res.status(400).json({ ok: false, error: "That photo is too small — use at least 300 × 300 pixels." });
    }
    const cutoutProvider = photoCutoutProvider();
    const [profile, stored, brand] = await Promise.all([
      analyzeProduct({ base64: buffer.toString("base64"), mimeType: "image/png" }),
      storePosterGeneratedImage({ userId, sessionId: "photo-sources", generationId: randomUUID(), buffer, contentType: "image/png" }),
      getUserBrand(userId).catch(() => ({ snapshot: null })),
    ]);
    const snapshot = brand.snapshot;
    const backdrop = snapshot?.primaryColors?.find((c) => /^#[0-9a-f]{6}$/i.test(c)) || "#EDE7DF";
    const settings: ShootSettings = { aspect: "4:5", lighting: "studio_soft", backdrop, model: { gender: "any", age: "any" } };
    const shots = recommendShots(profile);

    // The product alone, studio-clean: every shot is built from this, never from a hand-held snap.
    const master = await prepareMaster({
      source: { buffer, mimeType: "image/png" },
      profile,
      provider: getDefaultPosterImageProvider(),
      checkFidelity: geminiFidelityChecker,
      cutout: async (image) => {
        if (!cutoutProvider) return null;
        const c = await getProductCutout({ userId, source: `data:image/png;base64,${image.toString("base64")}` }, { provider: cutoutProvider }).catch(() => null);
        return c?.ok && c.png ? refineCutout(c.png) : null;
      },
      userId,
      sessionId: "photo-sources",
    });
    const save = (b: Buffer) =>
      storePosterGeneratedImage({ userId, sessionId: "photo-sources", generationId: randomUUID(), buffer: b, contentType: "image/png" }).then((r) => r.publicUrl);
    const [masterUrl, cutoutUrl] = await Promise.all([
      master.packshot ? save(master.packshot) : Promise.resolve(null),
      master.cutout ? save(master.cutout) : Promise.resolve(null),
    ]);
    console.info("[photoStudio] master", { via: master.via, fidelity: master.fidelity, obstructed: profile.obstructed === true });
    const sessionId = await createShootSession(
      userId,
      { sourceUrl: stored.publicUrl, masterUrl, cutoutUrl, prepared: true, profile, settings, shots },
      snapshot
    );

    return res.status(200).json({
      ok: true,
      sessionId,
      sourceUrl: stored.publicUrl,
      masterUrl,
      profile,
      settings,
      recommended: shots,
      catalog: SHOTS,
      brandColors: (snapshot?.primaryColors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 5),
      exactAvailable: Boolean(cutoutUrl),
    });
  } catch (e) {
    console.error("[photoStudio] start failed", { userId, error: (e as Error)?.message });
    return res.status(500).json({ ok: false, error: "We couldn't read that photo. Try another one." });
  }
}
