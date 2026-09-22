/**
 * Provider registry and capability-based selection.
 *
 * Selection is deterministic. It never picks a provider at random.
 * Only providers with createProvider() are considered live/implemented.
 *
 * Active commercial video path:
 *   provider = runway
 *   model    = seedance2_5 (Seedance 2.5)
 */

import type { GenerationStrategyId } from "../../generation/types";
import type {
  ProviderSelectionInput,
  ProviderSelectionResult,
  VideoProvider,
  VideoProviderCapabilities,
  VideoProviderRegistration,
} from "./types";
import type { VideoProviderId } from "./ids";
import {
  checkRunwayAvailability,
  createRunwayProvider,
  getRunwayCapabilities,
} from "./runway";
import { checkSeedanceAvailability, getSeedanceCapabilities } from "./seedance";
import { checkVeoAvailability, getVeoCapabilities } from "./veo";

const registrations: VideoProviderRegistration[] = [
  {
    id: "runway",
    capabilities: getRunwayCapabilities(),
    checkAvailability: checkRunwayAvailability,
    createProvider: createRunwayProvider,
  },
  {
    // Future direct BytePlus/ModelArk Seedance path — NOT the active commercial path.
    // Active Seedance 2.5 runs as a model under the Runway provider.
    id: "seedance",
    capabilities: getSeedanceCapabilities(),
    checkAvailability: checkSeedanceAvailability,
  },
  {
    // Legacy capability declaration only. Not used by the Commercial Production Engine.
    id: "veo",
    capabilities: getVeoCapabilities(),
    checkAvailability: checkVeoAvailability,
  },
];

export function listProviderRegistrations(): VideoProviderRegistration[] {
  return registrations.slice();
}

export function getProviderRegistration(id: VideoProviderId): VideoProviderRegistration | undefined {
  return registrations.find((entry) => entry.id === id);
}

export function getProviderCapabilities(id: VideoProviderId): VideoProviderCapabilities | undefined {
  return getProviderRegistration(id)?.capabilities;
}

/**
 * Returns a live provider only when createProvider is registered.
 * Active commercial provider: getLiveProvider("runway").
 */
export function getLiveProvider(id: VideoProviderId): VideoProvider | undefined {
  return getProviderRegistration(id)?.createProvider?.();
}

/** Active commercial video provider (Runway + Seedance 2.5 model). */
export function getActiveVideoProvider(): VideoProvider {
  const provider = getLiveProvider("runway");
  if (!provider) {
    throw new Error("Runway VideoProvider is not registered.");
  }
  return provider;
}

export function strategyNeedsImageInput(strategy: GenerationStrategyId): boolean {
  return (
    strategy === "image-to-video" ||
    strategy === "keyframe-first" ||
    strategy === "product-reference-first" ||
    strategy === "existing-asset-ai-motion"
  );
}

export function strategyNeedsReferences(strategy: GenerationStrategyId): boolean {
  return strategy === "product-reference-first" || strategy === "keyframe-first";
}

function durationScore(caps: VideoProviderCapabilities, durationSeconds: number): number {
  if (durationSeconds >= caps.minDurationSeconds && durationSeconds <= caps.maxDurationSeconds) {
    return 1;
  }
  if (durationSeconds < caps.minDurationSeconds) {
    return 0.25;
  }
  if (durationSeconds > caps.maxDurationSeconds) {
    return 0.35;
  }
  return 0;
}

function scoreProvider(
  registration: VideoProviderRegistration,
  input: ProviderSelectionInput
): ProviderSelectionResult | null {
  const caps = registration.capabilities;
  const availability = registration.checkAvailability();
  const reasons: string[] = [];
  let score = 0;
  const implemented = Boolean(registration.createProvider);

  if (input.requireLive) {
    if (!implemented) return null;
    if (availability.status !== "available") return null;
  }

  if (input.requiresStartFrame && !caps.startFrame && !caps.imageToVideo) {
    return null;
  }
  if (input.requiresEndFrame && !caps.endFrame) {
    return null;
  }
  if (input.requiresReferenceImages && !caps.referenceImages) {
    return null;
  }
  if (strategyNeedsImageInput(input.strategy) && !caps.imageToVideo) {
    return null;
  }
  if (input.strategy === "text-to-video" && !caps.textToVideo) {
    return null;
  }

  const dScore = durationScore(caps, input.durationSeconds);
  score += dScore * 40;
  if (dScore === 1) reasons.push(`duration ${input.durationSeconds}s is in range`);
  else
    reasons.push(
      `duration ${input.durationSeconds}s is outside native range ${caps.minDurationSeconds}-${caps.maxDurationSeconds}s`
    );

  if (caps.supportedAspectRatios.includes(input.aspectRatio)) {
    score += 20;
    reasons.push(`supports ${input.aspectRatio}`);
  } else {
    score += 5;
    reasons.push(`will need aspect conversion for ${input.aspectRatio}`);
  }

  if (input.requiresStartFrame && caps.startFrame) {
    score += 12;
    reasons.push("native start frame");
  } else if (input.requiresStartFrame && caps.imageToVideo) {
    score += 4;
    reasons.push("image-to-video without explicit start-frame control");
  }

  if (input.requiresEndFrame && caps.endFrame) {
    score += 10;
    reasons.push("native end frame");
  }

  if (input.requiresAudio && caps.audioSupport) {
    score += 10;
    reasons.push("native audio");
  } else if (input.requiresAudio && !caps.audioSupport) {
    reasons.push("no native audio — timeline can add music later");
  }

  if (input.requiresReferenceImages || strategyNeedsReferences(input.strategy)) {
    const refScore = Math.min(20, caps.maxReferenceImages);
    score += refScore;
    reasons.push(`reference images (max ${caps.maxReferenceImages})`);
  }

  if (input.preferredProviderId === caps.id) {
    score += 8;
    reasons.push("preferred provider");
  }

  if (input.requireLive && availability.credentialsConfigured) {
    score += 5;
  }

  if (implemented && caps.integrationStatus === "ready") {
    score += 10;
    reasons.push("live adapter ready");
  }

  return {
    providerId: caps.id,
    score,
    reasons,
    capabilities: caps,
  };
}

export function rankProviders(input: ProviderSelectionInput): ProviderSelectionResult[] {
  return registrations
    .map((registration) => scoreProvider(registration, input))
    .filter((result): result is ProviderSelectionResult => result != null)
    .sort((a, b) => b.score - a.score);
}

export function selectProvider(input: ProviderSelectionInput): ProviderSelectionResult | null {
  const ranked = rankProviders(input);
  return ranked[0] ?? null;
}

export function providerSelectionFromShot(input: {
  strategy: GenerationStrategyId;
  durationSeconds: number;
  aspectRatio: ProviderSelectionInput["aspectRatio"];
  requiresStartFrame: boolean;
  requiresEndFrame: boolean;
  requiresReferenceImages: boolean;
  requiresAudio?: boolean;
  preferredProviderId?: VideoProviderId;
  requireLive?: boolean;
}): ProviderSelectionResult | null {
  return selectProvider({
    strategy: input.strategy,
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio,
    requiresStartFrame: input.requiresStartFrame,
    requiresEndFrame: input.requiresEndFrame,
    requiresReferenceImages: input.requiresReferenceImages,
    requiresAudio: input.requiresAudio ?? false,
    preferredProviderId: input.preferredProviderId,
    requireLive: input.requireLive,
  });
}
