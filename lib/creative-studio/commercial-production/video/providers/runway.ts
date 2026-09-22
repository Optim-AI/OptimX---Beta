/**
 * Runway provider public surface.
 *
 * provider id = "runway"
 * active model = seedance2_5 (configured via RUNWAY_VIDEO_MODEL)
 *
 * Implementation lives in runway-provider.ts.
 * Low-level HTTP lives in runway-client.ts (internal to RunwayProvider).
 */

export {
  RUNWAY_PROVIDER_ID,
  RUNWAY_ACTIVE_MODEL,
  RUNWAY_SEEDANCE_MODEL,
  RUNWAY_API_KEY_SETUP_MESSAGE,
  RUNWAY_SUPPORTED_ASPECT_RATIOS,
  RunwayProvider,
  createRunwayProvider,
  getRunwayCapabilities,
  checkRunwayAvailability,
  downloadRunwayProviderOutput,
} from "./runway-provider";

export type { RunwayGenerateVideoRequest } from "./runway-types";
