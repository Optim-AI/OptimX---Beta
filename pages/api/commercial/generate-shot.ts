/**
 * Thin Phase 5 orchestration route.
 *
 * POST /api/commercial/generate-shot
 *
 * Accepts a PreparedShotForVideo payload (+ blueprint) and invokes the library
 * Video Executor. Does not embed Runway/Seedance logic.
 *
 * Limitation: no durable job queue / ShotPlan persistence yet — this route
 * polls the provider to completion (same pattern as Brand Studio generate-video).
 * Async job-id-only responses belong to a future worker phase.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { generateCommercialShotVideo } from "@/lib/creative-studio/commercial-production/video-executor";
import type { CommercialBlueprintCore } from "@/lib/creative-studio/commercial-production/commercial-director/types";
import type { PreparedShotForVideo } from "@/lib/creative-studio/commercial-production/reference-engine/types";
import { VideoExecutorError } from "@/lib/creative-studio/commercial-production/video-executor";
import { RUNWAY_API_KEY_SETUP_MESSAGE } from "@/lib/creative-studio/commercial-production/video/providers/runway";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: "8mb",
    },
  },
  maxDuration: 300,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const blueprint = body.blueprint as CommercialBlueprintCore | undefined;
    const prepared = body.prepared as PreparedShotForVideo | undefined;

    if (!blueprint?.campaignId || !prepared?.shot?.id) {
      return res.status(400).json({
        ok: false,
        error: "blueprint.campaignId and prepared.shot.id are required",
        code: "VIDEO_REQUEST_INVALID",
      });
    }

    const result = await generateCommercialShotVideo({
      blueprint,
      prepared,
      generationVersion: typeof body.generationVersion === "string" ? body.generationVersion : "v1",
      forceRegenerate: Boolean(body.forceRegenerate),
      skipDownload: Boolean(body.skipDownload),
      skipStorage: Boolean(body.skipStorage),
      userId: typeof body.userId === "string" ? body.userId : undefined,
    });

    return res.status(200).json({ ok: true, result });
  } catch (error: unknown) {
    if (error instanceof VideoExecutorError) {
      const status =
        error.code === "VIDEO_PROVIDER_UNAVAILABLE"
          ? 503
          : error.code === "KEYFRAME_REQUIRED" ||
              error.code === "KEYFRAME_INVALID" ||
              error.code === "VIDEO_REQUEST_INVALID" ||
              error.code === "REFERENCE_MISSING"
            ? 400
            : error.code === "VIDEO_JOB_TIMEOUT"
              ? 408
              : 500;
      return res.status(status).json({
        ok: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/commercial/generate-shot]", message);

    if (message.includes("RUNWAY_API_KEY")) {
      return res.status(503).json({
        ok: false,
        error: RUNWAY_API_KEY_SETUP_MESSAGE,
        code: "VIDEO_PROVIDER_UNAVAILABLE",
      });
    }

    return res.status(500).json({
      ok: false,
      error: message || "Failed to generate commercial shot video",
    });
  }
}
