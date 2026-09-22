// pages/api/creative-studio/generate-video.ts
// Active path: VideoProvider (Runway) → Seedance 2.5. Does not call runway-client.
import type { NextApiRequest, NextApiResponse } from "next";
import { generateCommercialVideoFromRequest } from "@/lib/creative-studio/commercial-production/video/generation/generate-commercial-video";
import { RUNWAY_API_KEY_SETUP_MESSAGE } from "@/lib/creative-studio/commercial-production/video/providers/runway";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
  maxDuration: 300,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const result = await generateCommercialVideoFromRequest(req.body || {});
    if (!result.ok) {
      return res.status(result.status).json({
        ok: false,
        error: result.error,
        code: result.code,
        details: result.details,
      });
    }
    return res.status(200).json(result);
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    console.error("❌ Video generation error:", errorMessage);

    if (errorMessage.includes("RUNWAY_API_KEY")) {
      return res.status(503).json({
        ok: false,
        error: RUNWAY_API_KEY_SETUP_MESSAGE,
        code: "RUNWAY_API_KEY_MISSING",
      });
    }

    if (/timed out/i.test(errorMessage)) {
      return res.status(408).json({
        ok: false,
        error:
          "Video generation timed out. 15s and 30s Seedance commercials can take several minutes — please try again.",
      });
    }

    return res.status(500).json({
      ok: false,
      error: errorMessage || "Failed to generate video",
    });
  }
}
