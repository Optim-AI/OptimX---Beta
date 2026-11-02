/**
 * POST /api/commercial/write-direction
 *
 * Authenticated. "Help me write it": turns the owner's tap-only answers and the
 * product photo into a short plain-language ad description for the
 * "In your own words" box. One Gemini text call; does not bill credits.
 *
 * Body: { campaign | brief: CampaignBrief }  — same brief as /api/commercial/generate
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import type { CampaignBrief } from "@/lib/creative-studio/commercial-production/campaign/types";
import { writeAdDirection } from "@/lib/creative-studio/commercial-production/concepts/write-direction";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
  maxDuration: 60,
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
    const text = await writeAdDirection(brief);
    console.log("[api/commercial/write-direction] ok", {
      userId,
      campaignId: brief.campaignId,
      chars: text.length,
      hasDirection: Boolean(brief.adDirection),
    });
    return res.status(200).json({ ok: true, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/commercial/write-direction] failed", { userId, message });
    return res.status(500).json({ ok: false, error: message || "Could not write the description" });
  }
}
