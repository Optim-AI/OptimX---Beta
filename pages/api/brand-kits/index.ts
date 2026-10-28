import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { BrandKitDAO } from "@/database/models/BrandKit.dao";
import { sanitizeBrandKitInput } from "@/lib/brand-kit/types";

const MAX_KITS_PER_USER = 25;

/**
 * GET  /api/brand-kits — the signed-in user's kits (default first)
 * POST /api/brand-kits — create a kit; the user's first kit becomes the default
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Please sign in." });

  try {
    if (req.method === "GET") {
      return res.status(200).json({ kits: await BrandKitDAO.listByUser(userId) });
    }

    if (req.method === "POST") {
      const parsed = sanitizeBrandKitInput(req.body);
      if (!parsed.ok) return res.status(400).json({ error: parsed.errors.join(" "), errors: parsed.errors });
      const existing = await BrandKitDAO.listByUser(userId);
      if (existing.length >= MAX_KITS_PER_USER) {
        return res.status(400).json({ error: `You can keep up to ${MAX_KITS_PER_USER} brand kits.` });
      }
      const kit = await BrandKitDAO.create(userId, parsed.value);
      return res.status(201).json({ kit });
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[brand-kits] error:", err);
    return res.status(500).json({ error: "Could not save the brand kit. Please try again." });
  }
}
