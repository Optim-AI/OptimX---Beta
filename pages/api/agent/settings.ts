// GET /api/agent/settings → { settings, brand: {name}, usage: {today, cap} }
// PUT /api/agent/settings { instructions?, tagline? }
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { getUserBrand } from "@/lib/brand-kit/server";
import { DAILY_MESSAGE_CAP, getSettings, messagesSentToday, saveSettings } from "@/lib/agent/store";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });
  try {
    if (req.method === "GET") {
      const [settings, brand, today] = await Promise.all([
        getSettings(userId),
        getUserBrand(userId).catch(() => ({ kit: null, snapshot: null })),
        messagesSentToday(userId).catch(() => 0),
      ]);
      const name = brand.kit?.name || (brand.snapshot as any)?.brand_name || (brand.snapshot as any)?.name || "";
      return res.status(200).json({ ok: true, settings, brand: { name, hasKit: !!brand.kit }, usage: { today, cap: DAILY_MESSAGE_CAP } });
    }
    if (req.method === "PUT") {
      const b = (req.body ?? {}) as Record<string, unknown>;
      const settings = await saveSettings(userId, {
        ...(typeof b.instructions === "string" ? { instructions: b.instructions } : {}),
        ...(b.tagline === null || typeof b.tagline === "string" ? { tagline: (b.tagline as string | null)?.trim() || null } : {}),
      });
      return res.status(200).json({ ok: true, settings });
    }
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("[agent/settings] failed", { userId, message: (e as Error)?.message?.slice(0, 200) });
    return res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
}
