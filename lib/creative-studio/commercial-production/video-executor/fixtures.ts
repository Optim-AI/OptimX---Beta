/**
 * Video executor fixtures + mock VideoProvider (no live Runway).
 */

import {
  makeProtein30sBlueprint,
  makeValidProtein30sShotPlan,
  makeValid15sShotPlan,
} from "../shot-planner/fixtures";
import { prepareShotForVideo } from "../reference-engine/prepare";
import type { KeyframeResult, PreparedShotForVideo } from "../reference-engine/types";
import type {
  CostEstimate,
  ProviderAvailability,
  ProviderCostEstimateInput,
  ProviderGenerateAccepted,
  ProviderGenerateRequest,
  ProviderJobStatus,
  VideoProvider,
  VideoProviderCapabilities,
} from "../video/providers/types";
import { VIDEO_EXECUTOR_MODEL, VIDEO_EXECUTOR_PROVIDER } from "./types";

export class MockVideoProvider implements VideoProvider {
  readonly id = VIDEO_EXECUTOR_PROVIDER;
  generateCalls: ProviderGenerateRequest[] = [];
  getJobCalls: string[] = [];
  failNextGenerate = false;
  failNextGeneratePermanent = false;
  timeoutOnce = false;
  jobDelayPolls = 1;
  private pollCounts = new Map<string, number>();
  private jobs = new Map<string, ProviderJobStatus>();

  getCapabilities(): VideoProviderCapabilities {
    return {
      id: VIDEO_EXECUTOR_PROVIDER,
      label: "Mock Runway",
      model: VIDEO_EXECUTOR_MODEL,
      supportedDurationsSeconds: Array.from({ length: 27 }, (_, i) => i + 4),
      minDurationSeconds: 4,
      maxDurationSeconds: 30,
      supportedAspectRatios: ["16:9", "9:16", "1:1", "4:5", "4:3", "3:4"],
      supportedResolutions: ["720p", "1080p"],
      textToVideo: true,
      imageToVideo: true,
      startFrame: true,
      endFrame: true,
      referenceImages: true,
      maxReferenceImages: 8,
      cameraControl: false,
      audioSupport: true,
      generationSpeed: "fast",
      estimatedCostPerSecondUsd: 0.05,
      integrationStatus: "ready",
    };
  }

  checkAvailability(): ProviderAvailability {
    return {
      id: VIDEO_EXECUTOR_PROVIDER,
      status: "available",
      credentialsConfigured: true,
      adapterImplemented: true,
      message: "mock runway available",
    };
  }

  estimateVideoCost(request: ProviderCostEstimateInput): CostEstimate {
    return {
      currency: "USD",
      durationSeconds: request.durationSeconds,
      estimatedCostUsd: Number((0.05 * request.durationSeconds).toFixed(4)),
      notes: "mock",
    };
  }

  async generateVideo(request: ProviderGenerateRequest): Promise<ProviderGenerateAccepted> {
    this.generateCalls.push(request);
    if (this.failNextGeneratePermanent) {
      this.failNextGeneratePermanent = false;
      throw new Error("invalid request: bad aspect ratio");
    }
    if (this.failNextGenerate) {
      this.failNextGenerate = false;
      throw new Error("503 temporary upstream failure");
    }
    const providerJobId = `mock-job-${this.generateCalls.length}-${request.shotId}`;
    this.jobs.set(providerJobId, {
      providerJobId,
      state: "pending",
    });
    this.pollCounts.set(providerJobId, 0);
    return {
      providerJobId,
      status: "submitted",
      provider: VIDEO_EXECUTOR_PROVIDER,
      model: VIDEO_EXECUTOR_MODEL,
    };
  }

  async getJob(providerJobId: string): Promise<ProviderJobStatus> {
    this.getJobCalls.push(providerJobId);
    if (this.timeoutOnce) {
      // Never succeed — let waitForVideoJob time out when maxWaitMs is tiny
      return { providerJobId, state: "running" };
    }
    const count = (this.pollCounts.get(providerJobId) || 0) + 1;
    this.pollCounts.set(providerJobId, count);
    if (count <= this.jobDelayPolls) {
      return { providerJobId, state: "running", progress: count * 40 };
    }
    const status: ProviderJobStatus = {
      providerJobId,
      state: "succeeded",
      assetUrl: `https://example.com/videos/${providerJobId}.mp4`,
      actualCostUsd: 0.2,
    };
    this.jobs.set(providerJobId, status);
    return status;
  }
}

export function makeApprovedKeyframe(shotId: string, campaignId: string): KeyframeResult {
  return {
    campaignId,
    shotId,
    keyframeId: `kf_${shotId}`,
    status: "approved",
    keyframeRequired: true,
    assetId: `asset_kf_${shotId}`,
    url: `https://example.com/keyframes/${shotId}.png`,
    provider: "mock_nano_banana",
    model: "mock-gemini",
    generationPrompt: "test keyframe",
    referenceAssetIds: ["product-1"],
    metadata: {
      aspectRatio: "9:16",
      attempt: 1,
      idempotencyKey: `${campaignId}:${shotId}:v1:a1`,
      visualInspectionAvailable: false,
    },
    attempts: [],
  };
}

export function getKeyframeFirstPrepared(): {
  blueprint: ReturnType<typeof makeProtein30sBlueprint>;
  prepared: PreparedShotForVideo;
} {
  const blueprint = makeProtein30sBlueprint();
  const plan = makeValidProtein30sShotPlan();
  const shot = plan.shots.find((s) => s.role === "product_hero")!;
  const keyframe = makeApprovedKeyframe(shot.id, blueprint.campaignId);
  const prepared = prepareShotForVideo({
    shot,
    keyframe,
    references: [
      {
        type: "product",
        assetId: "product-1",
        url: "https://example.com/product.png",
      },
    ],
  });
  return { blueprint, prepared };
}

export function getTextToVideoPrepared(): {
  blueprint: ReturnType<typeof makeProtein30sBlueprint>;
  prepared: PreparedShotForVideo;
} {
  const blueprint = makeProtein30sBlueprint();
  const plan = makeValidProtein30sShotPlan();
  const shot = plan.shots.find((s) => s.generationStrategy.id === "text-to-video")!;
  const prepared = prepareShotForVideo({ shot });
  return { blueprint, prepared };
}

export function getMotionGraphicsPrepared(): {
  blueprint: ReturnType<typeof makeProtein30sBlueprint>;
  prepared: PreparedShotForVideo;
} {
  const blueprint = makeProtein30sBlueprint();
  const plan = makeValid15sShotPlan();
  blueprint.campaignId = plan.campaignId;
  blueprint.campaignDuration = 15;
  const shot = plan.shots.find((s) => s.generationStrategy.id === "motion-graphics")!;
  const prepared = prepareShotForVideo({ shot });
  return { blueprint, prepared };
}

export function getImageToVideoMissingKeyframe(): {
  blueprint: ReturnType<typeof makeProtein30sBlueprint>;
  prepared: PreparedShotForVideo;
} {
  const { blueprint, prepared } = getKeyframeFirstPrepared();
  return {
    blueprint,
    prepared: {
      ...prepared,
      keyframe: undefined,
      readyForVideo: false,
      blockedReason: "Keyframe required but missing",
    },
  };
}
