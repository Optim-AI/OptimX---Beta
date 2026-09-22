/**
 * Shot-based fallback assembly (minimal — no giant FFmpeg framework).
 *
 * Uses Phase 6 runCampaignProduction for per-shot videos, builds a timeline,
 * and returns FinalCommercial. Multi-shot FFmpeg stitch remains Phase 8.
 */

import { runCampaignProduction } from "../campaign-orchestrator";
import type { CampaignBrief } from "../campaign/types";
import type { AvailableCampaignAssets } from "../reference-engine/types";
import type { CommercialTimeline } from "../timeline/types";
import type { CampaignExecutorOptions, FinalCommercial } from "./types";
import { CampaignExecutorError } from "./types";
import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
} from "../video-executor/types";

export async function produceShotBasedFallback(input: {
  brief: CampaignBrief;
  generationVersion: string;
  forceRegenerate?: boolean;
  availableAssets?: AvailableCampaignAssets;
  skipDownload?: boolean;
  skipStorage?: boolean;
  concurrency?: number;
  userId?: string;
}, options: CampaignExecutorOptions = {}): Promise<FinalCommercial> {
  const run = await runCampaignProduction(
    {
      brief: input.brief,
      generationVersion: input.generationVersion,
      forceRegenerate: input.forceRegenerate,
      availableAssets: input.availableAssets,
      skipDownload: input.skipDownload,
      skipStorage: input.skipStorage,
      concurrency: input.concurrency,
      userId: input.userId,
    },
    {
      director: options.director,
      shotPlanner: options.shotPlanner,
      imageProvider: options.imageProvider,
      videoProvider: options.videoProvider,
      log: options.log,
    }
  );

  if (!run.manifest || run.manifest.productionStatus !== "ready_for_composition") {
    throw new CampaignExecutorError(
      "FALLBACK_FAILED",
      `Shot-based production incomplete: status=${run.status} productionStatus=${run.manifest?.productionStatus}`,
      { runStatus: run.status, errors: run.errors }
    );
  }

  const blueprint = run.blueprint!;
  const shotVideos = run.shots
    .map((s) => s.video)
    .filter((v): v is NonNullable<typeof v> => Boolean(v && v.status === "completed"));

  const timeline: CommercialTimeline = {
    campaignId: run.campaignId,
    duration: blueprint.campaignDuration,
    aspectRatio: blueprint.aspectRatio,
    tracks: [
      {
        id: "video-main",
        kind: "video",
        clips: shotVideos.map((v, i) => ({
          id: `clip-${v.shotId}`,
          trackId: "video-main",
          shotId: v.shotId,
          asset: v.videoAsset
            ? {
                id: v.videoAsset.assetId,
                kind: "shot_video" as const,
                url: v.videoAsset.url,
                mimeType: v.videoAsset.mimeType || "video/mp4",
                durationSeconds: v.videoAsset.durationSeconds,
              }
            : undefined,
          startSeconds: shotVideos
            .slice(0, i)
            .reduce((sum, x) => sum + (x.creativeDurationSeconds || 0), 0),
          durationSeconds: v.creativeDurationSeconds,
        })),
      },
    ],
    clips: [],
    transitions: [],
    overlays: [],
    soundEffects: [],
    textLayers: [],
  };
  timeline.clips = timeline.tracks[0].clips;

  // Single completed video → use directly. Multiple → timeline_ready (FFmpeg deferred).
  const completedVideoShots = shotVideos.filter((v) => v.videoAsset?.url);
  let videoUrl = "";
  let videoAssetId = "";
  let compositionStatus: FinalCommercial["compositionStatus"] = "pending_ffmpeg";

  if (completedVideoShots.length === 1) {
    videoUrl = completedVideoShots[0].videoAsset!.url;
    videoAssetId = completedVideoShots[0].videoAsset!.assetId;
    compositionStatus = "completed";
  } else if (completedVideoShots.length > 1) {
    // Honest: timeline assembled; true stitch not implemented in Phase 7
    videoUrl = completedVideoShots[0].videoAsset!.url;
    videoAssetId = `timeline_${run.campaignId}_${input.generationVersion}`;
    compositionStatus = "timeline_ready";
  } else {
    // Only deferred motion-graphics shots?
    const deferredOk = run.shots.every((s) => s.status === "deferred" || s.status === "video_ready");
    if (!deferredOk || completedVideoShots.length === 0) {
      throw new CampaignExecutorError(
        "FALLBACK_FAILED",
        "No completed shot videos available for fallback composition"
      );
    }
  }

  return {
    campaignId: run.campaignId,
    generationVersion: input.generationVersion,
    duration: blueprint.campaignDuration,
    aspectRatio: blueprint.aspectRatio,
    productionMode: "shot_based_composed",
    videoAssetId,
    videoUrl,
    provider: VIDEO_EXECUTOR_PROVIDER,
    model: VIDEO_EXECUTOR_MODEL,
    qc: {
      passed: compositionStatus === "completed" || compositionStatus === "timeline_ready",
      issues: [
        {
          check: "composition",
          severity: compositionStatus === "timeline_ready" ? "warning" : "info",
          message:
            compositionStatus === "timeline_ready"
              ? "Timeline ready; FFmpeg multi-clip stitch deferred to Phase 8"
              : "Shot-based fallback composition complete",
        },
        {
          check: "requires_visual_qc",
          severity: "info",
          message: "visualInspectionAvailable: false",
        },
      ],
      checksPerformed: ["shot_videos", "timeline", "manifest"],
      visualInspectionAvailable: false,
      durationToleranceSeconds: 2,
    },
    compositionStatus,
    timeline,
    shotVideos,
    audioTracks: [],
    manifest: run.manifest,
    createdAt: new Date().toISOString(),
  };
}
