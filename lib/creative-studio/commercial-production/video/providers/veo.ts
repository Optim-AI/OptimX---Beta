/**
 * Google Veo — legacy capability declaration only.
 *
 * NOT used by the Commercial Production Engine active path.
 * Live Brand Studio video uses: RunwayProvider → Seedance 2.5.
 *
 * Existing legacy Creative Studio / film-engine Veo code remains elsewhere:
 *   lib/creative-studio/film-engine/veo-renderer.ts
 *   lib/creative-studio/resolve-veo-prompt.ts
 *
 * This file does not call Veo and has no createProvider registration.
 */

import type { CommercialAspectRatio } from "../../campaign/types";
import type { ProviderAvailability, VideoProviderCapabilities } from "./types";
import type { VideoProviderId } from "./ids";
import { getVeoProviderConfig, hasVeoCredentials } from "./config.server";

export const VEO_PROVIDER_ID: VideoProviderId = "veo";

export const VEO_SUPPORTED_ASPECT_RATIOS: CommercialAspectRatio[] = ["9:16", "16:9", "4:5"];

export function getVeoCapabilities(): VideoProviderCapabilities {
  const config = getVeoProviderConfig();
  return {
    id: VEO_PROVIDER_ID,
    label: "Google Veo",
    model: config.model,
    supportedDurationsSeconds: [4, 6, 8],
    minDurationSeconds: 4,
    maxDurationSeconds: 8,
    supportedAspectRatios: VEO_SUPPORTED_ASPECT_RATIOS,
    supportedResolutions: ["720p"],
    textToVideo: true,
    imageToVideo: true,
    startFrame: false,
    endFrame: false,
    referenceImages: true,
    maxReferenceImages: 3,
    cameraControl: false,
    audioSupport: true,
    generationSpeed: "fast",
    integrationStatus: "legacy_route",
  };
}

export function checkVeoAvailability(): ProviderAvailability {
  const credentialsConfigured = hasVeoCredentials();
  if (!credentialsConfigured) {
    return {
      id: VEO_PROVIDER_ID,
      status: "credentials_missing",
      credentialsConfigured: false,
      adapterImplemented: false,
      message:
        "Veo is legacy-only. Active commercial video uses Runway + Seedance 2.5. GEMINI_VEO_API_KEY not required for Brand Studio.",
    };
  }
  return {
    id: VEO_PROVIDER_ID,
    status: "adapter_not_implemented",
    credentialsConfigured: true,
    adapterImplemented: false,
    message:
      "Veo credentials exist for legacy film-engine paths only. No VideoProvider adapter; not used by Commercial Production Engine.",
  };
}
