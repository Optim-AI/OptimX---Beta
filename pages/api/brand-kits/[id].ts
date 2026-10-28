import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { BrandKitDAO } from "@/database/models/BrandKit.dao";
import { sanitizeBrandKitInput } from "@/lib/brand-kit/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET    /api/brand-kits/:id
 * PUT    /api/brand-kits/:id — replace the kit's contents (isDefault: true makes it the default)
 * DELETE /api/brand-kits/:id
 * All scoped to the signed-in user; other users' kits read as not found.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Please sign in." });

  const id = String(req.query.id || "");
  if (!UUID.test(id)) return res.status(404).json({ error: "Brand kit not found." });

  try {
    if (req.method === "GET") {
      const kit = await BrandKitDAO.getById(id, userId);
      return kit ? res.status(200).json({ kit }) : res.status(404).json({ error: "Brand kit not found." });
    }

    if (req.method === "PUT") {
      const parsed = sanitizeBrandKitInput(req.body);
      if (!parsed.ok) return res.status(400).json({ error: parsed.errors.join(" "), errors: parsed.errors });
      const kit = await BrandKitDAO.update(id, userId, parsed.value);
      return kit ? res.status(200).json({ kit }) : res.status(404).json({ error: "Brand kit not found." });
    }

    if (req.method === "DELETE") {
      const deleted = await BrandKitDAO.delete(id, userId);
      return deleted ? res.status(200).json({ ok: true }) : res.status(404).json({ error: "Brand kit not found." });
    }

    res.setHeader("Allow", "GET, PUT, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("[brand-kits/:id] error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
