/**
 * Future direct Seedance provider boundary (BytePlus / ModelArk).
 *
 * ACTIVE commercial path uses Seedance 2.5 as a MODEL under RunwayProvider:
 *   provider = runway, model = seedance2_5
 *
 * This registration is capability-only (no createProvider). Do not treat it as
 * the live Brand Studio generator. Do not call Seedance APIs from this file.
 */

import type { CommercialAspectRatio } from "../../campaign/types";
import type { ProviderAvailability, VideoProviderCapabilities } from "./types";
import type { VideoProviderId } from "./ids";
import { getSeedanceProviderConfig, hasSeedanceCredentials } from "./config.server";

export const SEEDANCE_PROVIDER_ID: VideoProviderId = "seedance";

export const SEEDANCE_SUPPORTED_ASPECT_RATIOS: CommercialAspectRatio[] = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
];

export interface SeedanceGenerateVideoRequest {
  model: string;
  prompt: string;
  duration: number;
  aspectRatio: string;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  referenceImageUrls?: string[];
  generateAudio?: boolean;
}

export function getSeedanceCapabilities(): VideoProviderCapabilities {
  const config = getSeedanceProviderConfig();
  return {
    id: SEEDANCE_PROVIDER_ID,
    label: "Seedance 2.5",
    model: config.model,
    supportedDurationsSeconds: Array.from({ length: 27 }, (_, i) => i + 4),
    minDurationSeconds: 4,
    maxDurationSeconds: 30,
    supportedAspectRatios: SEEDANCE_SUPPORTED_ASPECT_RATIOS,
    supportedResolutions: ["480p", "720p", "1080p"],
    textToVideo: true,
    imageToVideo: true,
    startFrame: true,
    endFrame: true,
    referenceImages: true,
    maxReferenceImages: 30,
    cameraControl: false,
    audioSupport: true,
    generationSpeed: "standard",
    estimatedCostPerSecondUsd: config.costPerSecondUsd,
    integrationStatus: "not_implemented",
  };
}

export function checkSeedanceAvailability(): ProviderAvailability {
  const credentialsConfigured = hasSeedanceCredentials();
  if (!credentialsConfigured) {
    return {
      id: SEEDANCE_PROVIDER_ID,
      status: "credentials_missing",
      credentialsConfigured: false,
      adapterImplemented: false,
      message:
        "Set SEEDANCE_API_KEY (or BYTEPLUS_ARK_API_KEY) on the server. The Seedance adapter is not implemented yet (Phase 5).",
    };
  }
  return {
    id: SEEDANCE_PROVIDER_ID,
    status: "adapter_not_implemented",
    credentialsConfigured: true,
    adapterImplemented: false,
    message: "Seedance credentials are present. generateVideo is not implemented yet (Phase 5).",
  };
}
