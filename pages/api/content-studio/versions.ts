import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { ContentStudioVersionDAO } from "@/database/models/ContentStudioVersion.dao";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  if (req.method === "GET") {
    const { productName, id } = req.query;

    if (typeof id === "string") {
      const version = await ContentStudioVersionDAO.getById(id, userId);
      if (!version) {
        return res.status(404).json({ ok: false, error: "Version not found" });
      }
      return res.status(200).json({ ok: true, version });
    }

    if (typeof productName !== "string" || !productName.trim()) {
      return res.status(400).json({ ok: false, error: "productName query parameter required" });
    }

    const versions = await ContentStudioVersionDAO.listByUserAndProduct(userId, productName);
    return res.status(200).json({ ok: true, versions });
  }

  if (req.method === "POST") {
    const {
      scanId,
      productName,
      adAngles,
      campaignPlan,
      campaignStrategy,
      generatedPosters,
      campaign,
      productData,
    } = req.body;

    if (!productName || typeof productName !== "string") {
      return res.status(400).json({ ok: false, error: "productName required" });
    }

    try {
      const existingCount = await ContentStudioVersionDAO.countByUserAndProduct(userId, productName);
      const versionNumber = existingCount + 1;

      const version = await ContentStudioVersionDAO.create({
        userId,
        scanId: scanId || undefined,
        productName,
        versionNumber,
        adAngles,
        campaignPlan,
        campaignStrategy,
        generatedPosters,
        campaign,
        productData,
      });

      await ContentStudioVersionDAO.deleteOldest(userId, productName);

      return res.status(200).json({ ok: true, version });
    } catch (err: any) {
      console.error("Failed to save version:", err);
      return res.status(500).json({ ok: false, error: err.message || "Failed to save version" });
    }
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (typeof id !== "string") {
      return res.status(400).json({ ok: false, error: "id query parameter required" });
    }
    const deleted = await ContentStudioVersionDAO.delete(id, userId);
    return res.status(200).json({ ok: true, deleted });
  }

  return res.status(405).json({ ok: false, error: "Method not allowed" });
}
