/**
 * Native continuous campaign video generation via VideoProvider (Runway → Seedance 2.5).
 *
 * Submits ONE job for the full campaign duration (15 or 30). Does not split into clips.
 */

import { getActiveVideoProvider } from "../video/providers/registry";
import { downloadRunwayProviderOutput } from "../video/providers/runway";
import type { CompiledPrompt } from "../video/prompt/types";
import type { StoredAssetRef } from "../assets";
import { waitForVideoJob, mapProviderError, isRetryableProviderError } from "../video-executor/job-manager";
import { runDeterministicCampaignVideoQc } from "./qc";
import {
  cacheCompletedCampaignVideo,
  campaignVideoIdempotencyKey,
  clearCampaignVideoInFlight,
  getCachedCampaignVideo,
  getInFlightCampaignVideo,
  markCampaignVideoInFlight,
} from "./storage";
import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
} from "../video-executor/types";
import {
  CampaignExecutorError,
  type CampaignExecutorOptions,
  type CampaignVideoResult,
  type GenerateCampaignVideoInput,
} from "./types";

function defaultLog(event: string, payload: Record<string, unknown>): void {
  console.log(`[campaign-executor] ${event}`, payload);
}

function toCompiledPrompt(promptText: string, negative?: string): CompiledPrompt {
  return {
    subject: "campaign commercial",
    action: "continuous narrative",
    environment: "",
    composition: "",
    camera: "",
    lighting: "",
    motion: "",
    visualTreatment: "",
    continuity: "",
    productRequirements: "",
    negativeConstraints: negative || "",
    promptText,
    negativePrompt: negative,
  };
}

export async function generateCampaignVideo(
  input: GenerateCampaignVideoInput,
  options: CampaignExecutorOptions = {}
): Promise<CampaignVideoResult> {
  const log = options.log ?? defaultLog;
  const spec = input.spec;

  if (spec.generationMode !== "native_continuous") {
    throw new CampaignExecutorError(
      "UNSUPPORTED_MODE",
      `generateCampaignVideo requires native_continuous (got ${spec.generationMode})`
    );
  }
  if (spec.duration !== 15 && spec.duration !== 30) {
    throw new CampaignExecutorError(
      "INVALID_SPEC",
      `Native campaign duration must be 15 or 30 (got ${spec.duration})`
    );
  }

  const idempotencyKey = campaignVideoIdempotencyKey({
    campaignId: spec.campaignId,
    generationVersion: spec.generationVersion,
    duration: spec.duration,
    generationMode: spec.generationMode,
  });

  if (!input.forceRegenerate) {
    const cached = getCachedCampaignVideo(idempotencyKey);
    if (cached) {
      log("native.idempotent_reuse", { idempotencyKey, providerJobId: cached.providerJobId });
      return cached;
    }
    const inflight = getInFlightCampaignVideo(idempotencyKey);
    if (inflight) {
      log("native.existing_job", { idempotencyKey, status: inflight.status });
      return inflight;
    }
  }

  const provider = options.videoProvider ?? getActiveVideoProvider();
  const availabilityResult = provider.checkAvailability();
  const avail =
    availabilityResult instanceof Promise ? await availabilityResult : availabilityResult;
  if (
    !avail.credentialsConfigured ||
    avail.status === "credentials_missing" ||
    avail.status === "unavailable"
  ) {
    throw new CampaignExecutorError(
      "PROVIDER_UNAVAILABLE",
      avail.message || "Video provider unavailable"
    );
  }

  const caps = provider.getCapabilities();
  if (spec.duration < caps.minDurationSeconds || spec.duration > caps.maxDurationSeconds) {
    throw new CampaignExecutorError(
      "INVALID_SPEC",
      `Provider cannot generate ${spec.duration}s (supports ${caps.minDurationSeconds}–${caps.maxDurationSeconds})`,
      { min: caps.minDurationSeconds, max: caps.maxDurationSeconds }
    );
  }

  const productReferences: StoredAssetRef[] = [];
  const referenceImages: StoredAssetRef[] = [];
  for (const ref of spec.referenceAssets) {
    const asset: StoredAssetRef = {
      id: ref.assetId,
      kind: ref.purpose === "product" ? "product_image" : "creative_reference",
      url: ref.url,
      mimeType: ref.mimeType || "image/jpeg",
      campaignId: spec.campaignId,
    };
    if (ref.purpose === "product") productReferences.push(asset);
    else referenceImages.push(asset);
  }

  const estimatedCost = provider.estimateVideoCost({
    durationSeconds: spec.duration,
    mode: "text-to-video",
    referenceImageCount: spec.referenceAssets.length,
  });

  const placeholder: CampaignVideoResult = {
    campaignId: spec.campaignId,
    generationVersion: spec.generationVersion,
    provider: VIDEO_EXECUTOR_PROVIDER,
    model: VIDEO_EXECUTOR_MODEL,
    generationMode: "native_continuous",
    duration: spec.duration,
    aspectRatio: spec.aspectRatio,
    videoAssetId: "",
    videoUrl: "",
    providerJobId: "",
    status: "processing",
    prompt: spec.campaignPrompt,
    referenceAssetIds: spec.referenceAssets.map((r) => r.assetId),
    estimatedCostUsd: estimatedCost.estimatedCostUsd,
    qc: {
      passed: false,
      issues: [],
      checksPerformed: [],
      visualInspectionAvailable: false,
      durationToleranceSeconds: 2,
    },
    metadata: {
      idempotencyKey,
      startedAt: new Date().toISOString(),
    },
  };
  markCampaignVideoInFlight(idempotencyKey, placeholder);

  const maxRetries = options.maxRetries ?? 2;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const started = Date.now();
    try {
      log("native.submit", {
        campaignId: spec.campaignId,
        generationVersion: spec.generationVersion,
        duration: spec.duration,
        aspectRatio: spec.aspectRatio,
        provider: provider.id,
        model: VIDEO_EXECUTOR_MODEL,
        referenceCount: spec.referenceAssets.length,
        attempt,
        note: "ONE native continuous generation — not split into shot clips",
      });

      const accepted = await provider.generateVideo({
        jobId: `camp_${spec.campaignId}_${spec.generationVersion}_a${attempt}`,
        campaignId: spec.campaignId,
        shotId: `campaign_${spec.duration}s`,
        mode: "text-to-video",
        prompt: toCompiledPrompt(spec.campaignPrompt, spec.negativePrompt),
        durationSeconds: spec.duration,
        aspectRatio: spec.aspectRatio,
        productReferences: productReferences.length ? productReferences : undefined,
        referenceImages: referenceImages.length ? referenceImages : undefined,
      });

      placeholder.providerJobId = accepted.providerJobId;
      placeholder.model = accepted.model || VIDEO_EXECUTOR_MODEL;
      markCampaignVideoInFlight(idempotencyKey, placeholder);

      const completed = await waitForVideoJob({
        provider,
        providerJobId: accepted.providerJobId,
        pollIntervalMs: options.pollIntervalMs,
        maxWaitMs: options.maxWaitMs,
        onPoll: (status) => {
          log("native.poll", {
            campaignId: spec.campaignId,
            providerJobId: accepted.providerJobId,
            state: status.state,
          });
        },
      });

      if (!completed.assetUrl) {
        throw new CampaignExecutorError(
          "DOWNLOAD_FAILED",
          "Provider succeeded without asset URL",
          { providerJobId: accepted.providerJobId }
        );
      }

      let videoUrl = completed.assetUrl;
      let bytes: number | undefined;

      if (!input.skipDownload) {
        let buf: Buffer;
        try {
          console.log("[campaign-executor] output.download.start", {
            campaignId: spec.campaignId,
            providerJobId: accepted.providerJobId,
            hasOutputUrl: Boolean(completed.assetUrl),
          });
          buf = await downloadRunwayProviderOutput(completed.assetUrl);
          bytes = buf.length;
          console.log("[campaign-executor] output.download.completed", {
            campaignId: spec.campaignId,
            providerJobId: accepted.providerJobId,
            downloadedBytes: bytes,
            downloadedMB: Number((bytes / (1024 * 1024)).toFixed(3)),
            contentType: "video/mp4",
          });
        } catch (e) {
          // Download failed after Runway succeeded — do NOT regenerate.
          throw new CampaignExecutorError(
            "DOWNLOAD_FAILED",
            e instanceof Error ? e.message : String(e),
            { providerJobId: accepted.providerJobId, phase: "OUTPUT_DOWNLOAD" },
            false
          );
        }

        if (!input.skipStorage) {
          try {
            const { uploadVideoBuffer } = await import("@/lib/creative-studio/video-delivery");
            videoUrl = await uploadVideoBuffer(buf);
          } catch (e) {
            // Storage failed after Runway succeeded — NEVER spend more Runway credits.
            throw new CampaignExecutorError(
              "STORAGE_FAILED",
              e instanceof Error ? e.message : String(e),
              {
                providerJobId: accepted.providerJobId,
                phase: "STORAGE_UPLOAD",
                downloadedBytes: bytes,
                downloadedMB: bytes != null ? Number((bytes / (1024 * 1024)).toFixed(3)) : undefined,
              },
              false
            );
          }
        } else {
          videoUrl = `data:video/mp4;base64,${buf.toString("base64")}`;
        }
      }

      const result: CampaignVideoResult = {
        campaignId: spec.campaignId,
        generationVersion: spec.generationVersion,
        provider: VIDEO_EXECUTOR_PROVIDER,
        model: accepted.model || VIDEO_EXECUTOR_MODEL,
        generationMode: "native_continuous",
        duration: spec.duration,
        aspectRatio: spec.aspectRatio,
        videoAssetId: `cv_${spec.campaignId}_${spec.generationVersion}_${spec.duration}s`,
        videoUrl,
        providerJobId: accepted.providerJobId,
        status: "completed",
        prompt: spec.campaignPrompt,
        referenceAssetIds: spec.referenceAssets.map((r) => r.assetId),
        estimatedCostUsd: estimatedCost.estimatedCostUsd,
        actualCostUsd: completed.actualCostUsd,
        qc: {
          passed: false,
          issues: [],
          checksPerformed: [],
          visualInspectionAvailable: false,
          durationToleranceSeconds: 2,
        },
        metadata: {
          idempotencyKey,
          startedAt: placeholder.metadata.startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs: Date.now() - started,
        },
      };

      result.qc = runDeterministicCampaignVideoQc({
        spec,
        result,
        reportedDurationSeconds: spec.duration,
      });

      if (!result.qc.passed) {
        result.status = "failed";
        result.error = {
          code: "QC_FAILED",
          message: result.qc.issues
            .filter((i) => i.severity === "error")
            .map((i) => i.message)
            .join("; "),
        };
        clearCampaignVideoInFlight(idempotencyKey);
        throw new CampaignExecutorError("QC_FAILED", result.error.message, {
          issues: result.qc.issues,
        });
      }

      cacheCompletedCampaignVideo(idempotencyKey, result);
      log("native.completed", {
        campaignId: result.campaignId,
        providerJobId: result.providerJobId,
        duration: result.duration,
        elapsedMs: result.metadata.elapsedMs,
        bytes,
      });
      return result;
    } catch (e) {
      clearCampaignVideoInFlight(idempotencyKey);
      if (e instanceof CampaignExecutorError) {
        lastError = e;
        log("native.attempt_failed", {
          campaignId: spec.campaignId,
          attempt,
          code: e.code,
          message: e.message,
          details: e.details,
        });
        // STORAGE_FAILED / non-retryable DOWNLOAD_FAILED must never re-submit Runway.
        break;
      }
      const mapped = mapProviderError(e);
      lastError = mapped;
      log("native.attempt_failed", {
        campaignId: spec.campaignId,
        attempt,
        code: mapped.code,
        message: mapped.message,
      });
      if (!isRetryableProviderError(mapped) || attempt >= maxRetries) break;
    }
  }

  const failed: CampaignVideoResult = {
    ...placeholder,
    status: "failed",
    error: {
      code: lastError instanceof CampaignExecutorError ? lastError.code : "NATIVE_GENERATION_FAILED",
      message: lastError?.message || "Native campaign generation failed",
    },
    metadata: {
      ...placeholder.metadata,
      completedAt: new Date().toISOString(),
    },
  };
  return failed;
}
