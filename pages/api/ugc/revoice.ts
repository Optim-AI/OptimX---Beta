/**
 * POST /api/ugc/revoice
 *
 * Authenticated. Re-voices a finished UGC voice-over video into another
 * language WITHOUT generating the video again: takes the stored pre-voice
 * video, writes a new script, adds Gemini TTS and the end card.
 * No Video Credits are billed (text + speech calls only).
 *
 * Body: { campaign: CampaignBrief (language set to the new one), baseVideoUrl }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import type { CampaignBrief } from "@/lib/creative-studio/commercial-production/campaign/types";
import { isCampaignDurationSeconds } from "@/lib/creative-studio/commercial-production/campaign/campaign-duration";
import { revoiceUgcVideo } from "@/lib/creative-studio/commercial-production/ugc/revoice";

export const config = {
  api: { bodyParser: { sizeLimit: "8mb" } },
  maxDuration: 300,
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
  const baseVideoUrl = typeof body.baseVideoUrl === "string" ? body.baseVideoUrl : "";
  if (!brief?.campaignId || !brief.brand?.name || !brief.product?.name || !isCampaignDurationSeconds(brief.campaignDuration)) {
    return res.status(400).json({ ok: false, error: "A campaign brief is required", code: "INVALID_CAMPAIGN_INPUT" });
  }

  try {
    const result = await revoiceUgcVideo({ brief: { ...brief, userId }, baseVideoUrl });
    console.log("[api/ugc/revoice] ok", { userId, campaignId: brief.campaignId, language: result.language });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/ugc/revoice] failed", { userId, message });
    // Our own checks have plain messages; anything else stays in the log.
    if (/not allowed|voice-over/i.test(message)) {
      return res.status(400).json({ ok: false, error: message });
    }
    return res.status(500).json({ ok: false, error: "We couldn't make that language right now. Please try again in a minute." });
  }
}
