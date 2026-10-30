// pages/api/content-studio/area-edit.ts
// Change only a boxed area of a generated poster. 1 image credit, charged only
// when an edited poster is delivered.

import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "crypto";
import { getUserIdFromRequest } from "@/auth/request";
import { CreditsDAO } from "@/database/models/Credits.dao";
import { editPosterArea, normalizeBox } from "@/lib/creative-studio/area-edit";
import { getDefaultPosterImageProvider } from "@/lib/creative-studio/poster-generation/generation/provider-router";
import { storePosterGeneratedImage } from "@/lib/creative-studio/poster-generation/generation/storage";

export const config = { api: { bodyParser: { sizeLimit: "15mb" } }, maxDuration: 120 };

const MAX_BYTES = 12 * 1024 * 1024;

/** Only posters we stored (or an image sent inline) — never an arbitrary URL. */
async function loadPoster(src: string): Promise<Buffer | null> {
  const data = /^data:image\/(png|jpe?g|webp);base64,(.+)$/i.exec(src);
  if (data) return Buffer.from(data[2], "base64");
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
  if (!base || !src.startsWith(`${base}/storage/v1/object/public/`)) return null;
  const res = await fetch(src, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length <= MAX_BYTES ? buf : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  const { image, box: rawBox, instruction } = req.body ?? {};
  const box = normalizeBox(rawBox);
  const text = typeof instruction === "string" ? instruction.trim().slice(0, 500) : "";
  if (typeof image !== "string" || !box || !text) {
    return res.status(400).json({ ok: false, error: "Select an area on the poster and say what to change." });
  }

  const balance = (await CreditsDAO.getFullBalance(userId).catch(() => null))?.imageCredits.total ?? 0;
  if (balance < 1) return res.status(402).json({ ok: false, error: "You need 1 image credit for this edit." });

  const poster = await loadPoster(image).catch(() => null);
  if (!poster) return res.status(400).json({ ok: false, error: "We couldn't open that poster. Try again." });

  try {
    const edited = await editPosterArea({ poster, box, instruction: text, provider: getDefaultPosterImageProvider(), userId });
    const stored = await storePosterGeneratedImage({ userId, sessionId: "area-edits", generationId: randomUUID(), buffer: edited, contentType: "image/png" });
    await CreditsDAO.deductImageCredits(userId, 1).catch((e) => console.error("[area-edit] credit deduction failed", (e as Error)?.message));
    return res.status(200).json({ ok: true, image: stored.publicUrl });
  } catch (e) {
    console.error("[area-edit] failed", { userId, error: (e as Error)?.message });
    return res.status(502).json({ ok: false, error: "The edit didn't come out. No credit was used — try again." });
  }
}
