/**
 * Commercial shot video executor — Phase 5.
 *
 * PreparedShotForVideo → VideoProvider (Runway) → Seedance 2.5 → ShotVideoResult
 *
 * Does NOT call runway-client directly.
 * Does NOT invent Veo / BytePlus Seedance paths.
 * Does NOT implement final compositor.
 */

import { getActiveVideoProvider } from "../video/providers/registry";
import { downloadRunwayProviderOutput } from "../video/providers/runway";
import { buildVideoExecutionRequest } from "./request-builder";
import { isRetryableProviderError, mapProviderError, waitForVideoJob } from "./job-manager";
import { runDeterministicVideoQc } from "./qc";
import {
  cacheCompletedShotVideo,
  clearShotVideoInFlight,
  getCachedCompletedShotVideo,
  getInFlightShotVideo,
  markShotVideoInFlight,
  storeShotVideoBuffer,
} from "./storage";
import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
  VideoExecutorError,
  type GenerateCommercialShotVideoInput,
  type ShotVideoResult,
  type VideoExecutionRequest,
  type VideoExecutorOptions,
} from "./types";

function defaultLog(event: string, payload: Record<string, unknown>): void {
  console.log(`[video-executor] ${event}`, payload);
}

function deferredResult(
  input: GenerateCommercialShotVideoInput,
  reason: string
): ShotVideoResult {
  const shot = input.prepared.shot;
  const generationVersion = input.generationVersion || "v1";
  return {
    campaignId: input.blueprint.campaignId,
    shotId: shot.id,
    status: "deferred",
    provider: VIDEO_EXECUTOR_PROVIDER,
    model: VIDEO_EXECUTOR_MODEL,
    generationMode: input.prepared.generationMode,
    prompt: "",
    references: (input.prepared.references || []).map((r) => r.assetId),
    creativeDurationSeconds: shot.durationSeconds,
    providerDurationSeconds: shot.durationSeconds,
    aspectRatio: input.blueprint.aspectRatio,
    artifactRisks: [
      shot.artifactRisk,
      ...(shot.artifactRisks || []).map((r) => r.risk),
    ].filter(Boolean),
    metadata: {
      generationVersion,
      attempt: 0,
      hasKeyframe: Boolean(input.prepared.keyframe),
      referenceCount: input.prepared.references?.length || 0,
      deferredReason: reason,
      handledByCompositor: true,
      idempotencyKey: `${input.blueprint.campaignId}:${shot.id}:${generationVersion}:deferred`,
    },
  };
}

function baseResultFromRequest(
  request: VideoExecutionRequest,
  overrides: Partial<ShotVideoResult> = {}
): ShotVideoResult {
  return {
    campaignId: request.campaignId,
    shotId: request.shotId,
    status: "queued",
    provider: VIDEO_EXECUTOR_PROVIDER,
    model: VIDEO_EXECUTOR_MODEL,
    generationMode: request.generationMode,
    prompt: request.prompt.promptText,
    compiledPrompt: request.prompt,
    references: request.references.map((r) => r.assetId),
    creativeDurationSeconds: request.creativeDurationSeconds,
    providerDurationSeconds: request.providerDurationSeconds,
    aspectRatio: request.aspectRatio,
    sourceKeyframeAssetId: request.startFrame?.id || request.keyframe?.assetId || request.keyframe?.keyframeId,
    artifactRisks: [
      request.shot.artifactRisk,
      ...(request.shot.artifactRisks || []).map((r) => r.risk),
    ].filter(Boolean),
    metadata: {
      generationVersion: request.generationVersion,
      attempt: request.attempt,
      hasKeyframe: Boolean(request.keyframe),
      referenceCount: request.references.length,
      idempotencyKey: request.idempotencyKey,
      startedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

async function submitAndAwait(
  request: VideoExecutionRequest,
  options: VideoExecutorOptions,
  input: GenerateCommercialShotVideoInput
): Promise<ShotVideoResult> {
  const log = options.log ?? defaultLog;
  const provider = options.videoProvider ?? getActiveVideoProvider();
  const maxRetries = options.maxRetries ?? 2;

  const availabilityResult = provider.checkAvailability();
  const avail =
    availabilityResult instanceof Promise ? await availabilityResult : availabilityResult;

  if (
    !avail.credentialsConfigured ||
    avail.status === "credentials_missing" ||
    avail.status === "unavailable" ||
    avail.status === "adapter_not_implemented"
  ) {
    throw new VideoExecutorError(
      "VIDEO_PROVIDER_UNAVAILABLE",
      avail.message || "Video provider unavailable",
      { status: avail.status }
    );
  }

  const caps = provider.getCapabilities();
  if (caps.model && caps.model !== VIDEO_EXECUTOR_MODEL && !String(caps.model).includes("seedance")) {
    throw new VideoExecutorError(
      "VIDEO_MODEL_UNAVAILABLE",
      `Active provider model is ${caps.model}, expected ${VIDEO_EXECUTOR_MODEL}`
    );
  }

  const estimatedCost = provider.estimateVideoCost({
    durationSeconds: request.providerDurationSeconds,
    mode: request.providerMode,
    referenceImageCount: request.referenceImages?.length || 0,
  });

  let lastError: VideoExecutorError | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const attemptRequest =
      attempt === 0
        ? request
        : {
            ...request,
            attempt: request.attempt + attempt,
            jobId: `${request.jobId}_r${attempt}`,
            idempotencyKey: `${request.idempotencyKey}_r${attempt}`,
          };

    const started = Date.now();
    // Mark in-flight before provider submit to prevent duplicate expensive jobs.
    const processingPlaceholder = baseResultFromRequest(attemptRequest, {
      status: "processing",
      jobId: attemptRequest.jobId,
      estimatedCost,
    });
    markShotVideoInFlight(processingPlaceholder);

    try {
      log("video.submit", {
        campaignId: attemptRequest.campaignId,
        shotId: attemptRequest.shotId,
        generationVersion: attemptRequest.generationVersion,
        generationAttempt: attemptRequest.attempt,
        generationMode: attemptRequest.generationMode,
        provider: provider.id,
        model: VIDEO_EXECUTOR_MODEL,
        duration: attemptRequest.providerDurationSeconds,
        creativeDuration: attemptRequest.creativeDurationSeconds,
        aspectRatio: attemptRequest.aspectRatio,
        hasKeyframe: Boolean(attemptRequest.startFrame),
        referenceCount: attemptRequest.references.length,
        estimatedCost: estimatedCost.estimatedCostUsd,
      });

      const accepted = await provider.generateVideo({
        jobId: attemptRequest.jobId,
        campaignId: attemptRequest.campaignId,
        shotId: attemptRequest.shotId,
        mode: attemptRequest.providerMode,
        prompt: attemptRequest.prompt,
        durationSeconds: attemptRequest.providerDurationSeconds,
        aspectRatio: attemptRequest.aspectRatio,
        startFrame: attemptRequest.startFrame,
        productReferences: attemptRequest.productReferences,
        referenceImages: attemptRequest.referenceImages,
      });

      const processing = baseResultFromRequest(attemptRequest, {
        status: "processing",
        jobId: attemptRequest.jobId,
        providerJobId: accepted.providerJobId,
        model: accepted.model || VIDEO_EXECUTOR_MODEL,
        estimatedCost,
      });
      markShotVideoInFlight(processing);

      const completed = await waitForVideoJob({
        provider,
        providerJobId: accepted.providerJobId,
        pollIntervalMs: options.pollIntervalMs ?? input.pollIntervalMs,
        maxWaitMs: options.maxWaitMs,
        onPoll: (status) => {
          log("video.poll", {
            campaignId: attemptRequest.campaignId,
            shotId: attemptRequest.shotId,
            providerJobId: accepted.providerJobId,
            state: status.state,
            progress: status.progress,
          });
        },
      });

      if (!completed.assetUrl) {
        throw new VideoExecutorError(
          "VIDEO_DOWNLOAD_FAILED",
          "Provider job succeeded but returned no asset URL",
          { providerJobId: accepted.providerJobId }
        );
      }

      let videoUrl = completed.assetUrl;
      let delivery: "storage" | "inline" | "provider_url" = "provider_url";
      let bytes: number | undefined;
      let storagePath: string | undefined;

      if (!input.skipDownload) {
        try {
          const buf = await downloadRunwayProviderOutput(completed.assetUrl);
          bytes = buf.length;
          if (!input.skipStorage) {
            const stored = await storeShotVideoBuffer({
              buffer: buf,
              campaignId: attemptRequest.campaignId,
              shotId: attemptRequest.shotId,
              generationVersion: attemptRequest.generationVersion,
              attempt: attemptRequest.attempt,
            });
            if (stored) {
              videoUrl = stored.url;
              delivery = stored.delivery;
              bytes = stored.bytes;
            } else {
              // Keep provider URL when storage fails — do not invent fake success with empty asset
              delivery = "provider_url";
            }
          } else {
            videoUrl = `data:video/mp4;base64,${buf.toString("base64")}`;
            delivery = "inline";
          }
        } catch (e) {
          throw new VideoExecutorError(
            "VIDEO_DOWNLOAD_FAILED",
            e instanceof Error ? e.message : String(e),
            { providerJobId: accepted.providerJobId },
            true
          );
        }
      }

      const result: ShotVideoResult = baseResultFromRequest(attemptRequest, {
        status: "completed",
        jobId: attemptRequest.jobId,
        providerJobId: accepted.providerJobId,
        model: accepted.model || VIDEO_EXECUTOR_MODEL,
        estimatedCost,
        actualCostUsd: completed.actualCostUsd,
        videoAsset: {
          assetId: `sv_${attemptRequest.campaignId}_${attemptRequest.shotId}_${attemptRequest.generationVersion}_a${attemptRequest.attempt}`,
          url: videoUrl,
          durationSeconds: attemptRequest.providerDurationSeconds,
          mimeType: "video/mp4",
          bytes,
          delivery,
          storagePath,
        },
        metadata: {
          generationVersion: attemptRequest.generationVersion,
          attempt: attemptRequest.attempt,
          hasKeyframe: Boolean(attemptRequest.startFrame),
          referenceCount: attemptRequest.references.length,
          idempotencyKey: attemptRequest.idempotencyKey,
          startedAt: processing.metadata.startedAt,
          completedAt: new Date().toISOString(),
          elapsedMs: Date.now() - started,
        },
      });

      const qc = runDeterministicVideoQc({
        shot: attemptRequest.shot,
        request: attemptRequest,
        result,
      });
      result.qc = qc;

      if (!qc.passed) {
        result.status = "failed";
        result.error = {
          code: "VIDEO_QC_FAILED",
          message: qc.issues
            .filter((i) => i.severity === "error")
            .map((i) => i.message)
            .join("; "),
        };
        clearShotVideoInFlight(
          result.campaignId,
          result.shotId,
          result.metadata.generationVersion
        );
        throw new VideoExecutorError("VIDEO_QC_FAILED", result.error.message, {
          issues: qc.issues,
        });
      }

      cacheCompletedShotVideo(result);
      log("video.completed", {
        campaignId: result.campaignId,
        shotId: result.shotId,
        providerJobId: result.providerJobId,
        status: result.status,
        elapsedMs: result.metadata.elapsedMs,
        estimatedCost: estimatedCost.estimatedCostUsd,
        actualCost: result.actualCostUsd,
      });
      return result;
    } catch (e) {
      clearShotVideoInFlight(
        attemptRequest.campaignId,
        attemptRequest.shotId,
        attemptRequest.generationVersion
      );
      const mapped = mapProviderError(e);
      lastError = mapped;
      log("video.attempt_failed", {
        campaignId: attemptRequest.campaignId,
        shotId: attemptRequest.shotId,
        attempt,
        code: mapped.code,
        retryable: isRetryableProviderError(mapped),
        message: mapped.message,
      });

      if (!isRetryableProviderError(mapped) || attempt >= maxRetries) {
        break;
      }
    }
  }

  const failed = baseResultFromRequest(request, {
    status: "failed",
    estimatedCost,
    error: {
      code: lastError?.code || "VIDEO_JOB_FAILED",
      message: lastError?.message || "Video generation failed",
    },
    metadata: {
      generationVersion: request.generationVersion,
      attempt: request.attempt,
      hasKeyframe: Boolean(request.keyframe),
      referenceCount: request.references.length,
      idempotencyKey: request.idempotencyKey,
      completedAt: new Date().toISOString(),
    },
  });
  return failed;
}

/**
 * Generate one commercial shot video from a Phase 4 PreparedShotForVideo.
 */
export async function generateCommercialShotVideo(
  input: GenerateCommercialShotVideoInput,
  options: VideoExecutorOptions = {}
): Promise<ShotVideoResult> {
  const log = options.log ?? defaultLog;
  const mode = input.prepared.generationMode;
  const generationVersion = input.generationVersion || "v1";
  const shot = input.prepared.shot;

  if (mode === "motion_graphics" || mode === "composited") {
    log("video.deferred", {
      campaignId: input.blueprint.campaignId,
      shotId: shot.id,
      mode,
    });
    return deferredResult(input, "handled_by_compositor");
  }

  if (!input.forceRegenerate) {
    const cached = getCachedCompletedShotVideo(
      input.blueprint.campaignId,
      shot.id,
      generationVersion
    );
    if (cached) {
      log("video.idempotent_reuse", {
        campaignId: cached.campaignId,
        shotId: cached.shotId,
        generationVersion,
        providerJobId: cached.providerJobId,
      });
      return cached;
    }

    const inFlight = getInFlightShotVideo(
      input.blueprint.campaignId,
      shot.id,
      generationVersion
    );
    if (inFlight) {
      log("video.existing_job", {
        campaignId: inFlight.campaignId,
        shotId: inFlight.shotId,
        providerJobId: inFlight.providerJobId,
        status: inFlight.status,
      });
      return inFlight;
    }
  }

  const provider = options.videoProvider ?? getActiveVideoProvider();
  const capabilities = provider.getCapabilities();
  const request = buildVideoExecutionRequest({
    blueprint: input.blueprint,
    prepared: input.prepared,
    generationVersion,
    attempt: 0,
    capabilities,
  });

  return submitAndAwait(request, options, input);
}
