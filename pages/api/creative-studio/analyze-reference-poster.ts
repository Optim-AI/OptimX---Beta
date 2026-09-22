// pages/api/creative-studio/analyze-reference-poster.ts
// Reference Poster Analyzer — design grammar only. No image credits.

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  analyzeReferencePoster,
  hashReferenceImagePayload,
} from "@/lib/creative-studio/poster-engine";

export const config = {
  api: {
    bodyParser: { sizeLimit: "12mb" },
  },
  maxDuration: 45,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
    if (!dataUrl.startsWith("data:")) {
      return res.status(400).json({
        ok: false,
        error: "Provide a reference poster as a data URL",
      });
    }

    const contentHash =
      (typeof req.body?.contentHash === "string" && req.body.contentHash) ||
      hashReferenceImagePayload(dataUrl);

    const result = await analyzeReferencePoster({ dataUrl, contentHash });

    console.log("[analyzeReferencePoster]", {
      userId,
      cached: result.cached,
      hash: result.contentHash.slice(0, 16),
      suggestedTheme: result.analysis.suggestedTheme,
    });

    return res.status(200).json({
      ok: true,
      analysis: result.analysis,
      contentHash: result.contentHash,
      cached: result.cached,
      model: result.model,
      creditsCharged: 0,
    });
  } catch (err: any) {
    console.error("[analyzeReferencePoster] error", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to analyze reference poster",
    });
  }
}
