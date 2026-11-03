/**
 * POST /api/commercial/end-card-preview
 *
 * Authenticated. Renders the brand end card as a transparent PNG with the same
 * renderer the finished commercial uses, so the studio can show it live over
 * the product photo. Free — no model calls.
 *
 * Body: { aspectRatio?: "9:16" | "16:9", brandName, offer?, cta?, contact?, accentColor?, logoUrl? }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { loadEndCardFonts, renderEndCardPng } from "@/lib/creative-studio/commercial-production/finishing/end-card";
import { loadImageInline } from "@/lib/creative-studio/commercial-production/product-understanding/analyze-product";

export const config = {
  api: { bodyParser: { sizeLimit: "4mb" } },
  maxDuration: 30,
};

const clip = (value: unknown, max = 80): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required", code: "AUTH_REQUIRED" });
  }

  const body = req.body || {};
  const landscape = body.aspectRatio === "16:9";
  const [width, height] = landscape ? [960, 540] : [540, 960];

  try {
    let logo: Buffer | undefined;
    const logoUrl = clip(body.logoUrl, 4_000_000);
    if (logoUrl) {
      const inline = await loadImageInline({ url: logoUrl } as Parameters<typeof loadImageInline>[0]).catch(() => null);
      if (inline) logo = Buffer.from(inline.data, "base64");
    }

    const { png, skipped } = await renderEndCardPng({
      width,
      height,
      fonts: await loadEndCardFonts(),
      content: {
        brandName: clip(body.brandName) || "Your brand",
        offer: clip(body.offer),
        cta: clip(body.cta),
        contact: clip(body.contact),
        accentColor: clip(body.accentColor, 7),
        logo,
      },
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "private, max-age=60");
    if (skipped.length) res.setHeader("X-End-Card-Skipped", skipped.join(","));
    return res.status(200).send(png);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/commercial/end-card-preview] failed", { userId, message });
    return res.status(500).json({ ok: false, error: "Could not draw the end card preview" });
  }
}
