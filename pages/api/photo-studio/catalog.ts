// pages/api/photo-studio/catalog.ts — shot library + brand colours + whether exact shots are available.
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { getUserBrand } from "@/lib/brand-kit/server";
import { photoCutoutProvider } from "@/lib/photo-studio/shoot";
import { SHOTS } from "@/lib/photo-studio/shots";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });
  const { snapshot } = await getUserBrand(userId).catch(() => ({ snapshot: null }));
  return res.status(200).json({
    ok: true,
    catalog: SHOTS,
    brandColors: (snapshot?.primaryColors || []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 5),
    exactAvailable: Boolean(photoCutoutProvider()),
  });
}
