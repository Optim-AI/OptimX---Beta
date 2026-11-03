/**
 * POST /api/commercial/concepts
 *
 * Authenticated. Returns three plain-language ad ideas, each with a 3-panel
 * storyboard image, for the user to pick BEFORE spending Video Credits.
 * Does not bill credits (one text call + three image calls).
 *
 * Body: { campaign | brief: CampaignBrief }  — same brief as /api/commercial/generate
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import type { CampaignBrief } from "@/lib/creative-studio/commercial-production/campaign/types";
import { generateConceptCards } from "@/lib/creative-studio/commercial-production/concepts/generate-concepts";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
  maxDuration: 120,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required", code: "AUTH_REQUIRED" });
  }

  const body = req.body || {};
  const brief = (body.campaign || body.brief) as CampaignBrief | undefined;
  if (!brief?.campaignId || !brief.brand?.name || !brief.product?.name) {
    return res.status(400).json({
      ok: false,
      error: "A campaign brief with brand and product is required",
      code: "INVALID_CAMPAIGN_INPUT",
    });
  }

  try {
    const concepts = await generateConceptCards(brief);
    console.log("[api/commercial/concepts] ok", {
      userId,
      campaignId: brief.campaignId,
      count: concepts.length,
      storyboards: concepts.filter((c) => c.storyboardImage).length,
    });
    return res.status(200).json({ ok: true, concepts });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/commercial/concepts] failed", { userId, message });
    return res.status(500).json({ ok: false, error: message || "Could not create ideas" });
  }
}
