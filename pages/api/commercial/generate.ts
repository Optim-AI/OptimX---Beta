/**
 * Thin commercial production route — Phase 6 + Phase 7 + Phase 8 QC.
 *
 * POST /api/commercial/generate
 *
 * Default generationMode = native_continuous (ONE 15s/30s Seedance generation).
 * After generation, Commercial QC runs (deterministic; visual when configured).
 * Response includes finalCommercial.commercialQC (accept | regenerate | manual_review).
 *
 * Body: {
 *   campaign | brief: CampaignBrief,
 *   generationVersion?,
 *   forceRegenerate?,
 *   generationMode?: "native_continuous" | "shot_based_fallback",
 *   availableAssets?,
 *   runCommercialQc?: boolean  // default true
 * }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { CampaignBrief } from "@/lib/creative-studio/commercial-production/campaign/types";
import {
  runCampaignProduction,
  CampaignOrchestratorError,
} from "@/lib/creative-studio/commercial-production/campaign-orchestrator";
import {
  produceFinalCommercial,
  CampaignExecutorError,
} from "@/lib/creative-studio/commercial-production/campaign-executor";
import type { CampaignGenerationMode } from "@/lib/creative-studio/commercial-production/campaign-compiler/types";

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
    const brief = (body.campaign || body.brief) as CampaignBrief | undefined;
    if (!brief?.campaignId) {
      return res.status(400).json({
        ok: false,
        error: "campaign.campaignId is required",
        code: "INVALID_CAMPAIGN_INPUT",
      });
    }

    const generationVersion =
      typeof body.generationVersion === "string" ? body.generationVersion : "v1";
    const forceRegenerate = Boolean(body.forceRegenerate);
    const generationMode = (
      body.generationMode === "shot_based_fallback"
        ? "shot_based_fallback"
        : "native_continuous"
    ) as CampaignGenerationMode;

    // Phase 7 default: native continuous final commercial
    if (body.produceFinal !== false) {
      const finalCommercial = await produceFinalCommercial({
        brief,
        generationVersion,
        forceRegenerate,
        generationMode,
        availableAssets: body.availableAssets,
        skipDownload: Boolean(body.skipDownload),
        skipStorage: Boolean(body.skipStorage),
        concurrency: typeof body.concurrency === "number" ? body.concurrency : undefined,
        userId: typeof body.userId === "string" ? body.userId : undefined,
        runCommercialQc: body.runCommercialQc !== false,
      });

      return res.status(200).json({
        ok: true,
        generationMode,
        finalCommercial,
        commercialQC: finalCommercial.commercialQC,
      });
    }

    // Legacy Phase 6: production run / manifest only (shot pipeline)
    const run = await runCampaignProduction({
      brief,
      generationVersion,
      forceRegenerate,
      availableAssets: body.availableAssets,
      skipDownload: Boolean(body.skipDownload),
      skipStorage: Boolean(body.skipStorage),
      concurrency: typeof body.concurrency === "number" ? body.concurrency : undefined,
      userId: typeof body.userId === "string" ? body.userId : undefined,
    });

    return res.status(200).json({
      ok: true,
      run,
      manifest: run.manifest,
    });
  } catch (error: unknown) {
    if (error instanceof CampaignExecutorError) {
      return res.status(error.code === "INVALID_SPEC" ? 400 : 500).json({
        ok: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    if (error instanceof CampaignOrchestratorError) {
      const status =
        error.code === "INVALID_CAMPAIGN_INPUT" || error.code === "DURATION_MISMATCH"
          ? 400
          : 500;
      return res.status(status).json({
        ok: false,
        error: error.message,
        code: error.code,
        stage: error.stage,
        details: error.details,
      });
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/commercial/generate]", message);
    return res.status(500).json({
      ok: false,
      error: message || "Campaign production failed",
    });
  }
}
