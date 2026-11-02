// pages/api/creative-studio/generate-video.ts
// Retired: this route ran Runway Seedance jobs without auth or Video Credit billing.
// All commercial video generation goes through POST /api/commercial/generate
// (authenticated, reserve → generate → consume). Never call a provider from here.
import type { NextApiRequest, NextApiResponse } from "next";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "1mb",
    },
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  return res.status(410).json({
    ok: false,
    error:
      "This endpoint has been retired. Use /api/commercial/generate to create a 15s or 30s commercial (Video Credits).",
    code: "USE_BILLED_COMMERCIAL_GENERATE",
  });
}
