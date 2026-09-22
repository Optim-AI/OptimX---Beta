/**
 * Runway VideoProvider implementation.
 *
 * provider = runway
 * active model = seedance2_5 (Seedance 2.5 via Runway Dev API)
 *
 * Higher layers (API routes, Commercial Director, Shot Planner) must call
 * this through VideoProvider / getLiveProvider("runway") — never import
 * runway-client directly.
 */

import sharp from "sharp";
import type { CommercialAspectRatio } from "../../campaign/types";
import { adaptCompiledPromptForRunway } from "../prompt/provider-adapters/runway";
import {
  RUNWAY_API_KEY_SETUP_MESSAGE,
  RUNWAY_SEEDANCE_MODEL,
  createRunwayVideoTask,
  downloadRunwayOutput,
  getRunwayApiKey,
  getRunwayTask,
  runwayRatioForAspect,
  type RunwayReferenceImage,
} from "./runway-client";
import { getRunwayProviderConfig, hasRunwayCredentials } from "./config.server";
import type {
  CostEstimate,
  ProviderAvailability,
  ProviderCostEstimateInput,
  ProviderGenerateAccepted,
  ProviderGenerateRequest,
  ProviderJobStatus,
  VideoProvider,
  VideoProviderCapabilities,
} from "./types";
import type { VideoProviderId } from "./ids";

/** Runway image inputs: JPEG, PNG, WebP only — GIF/SVG/etc. are rejected. */
const RUNWAY_IMAGE_MIMES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
/** Data URI body limit is 5MB encoded (~3.3MB binary). */
const RUNWAY_DATA_URI_MAX_BYTES = 3_300_000;
/** Seedance reference images: aspect between 0.4–4; prefer ≥640px, ≤4K. */
const REF_MIN_SIDE = 640;
const REF_MAX_SIDE = 2048;
const REF_MIN_ASPECT = 0.4;
const REF_MAX_ASPECT = 4;

export { RUNWAY_API_KEY_SETUP_MESSAGE, RUNWAY_SEEDANCE_MODEL };

export const RUNWAY_PROVIDER_ID: VideoProviderId = "runway";

/** Canonical active model id for the Runway provider. */
export const RUNWAY_ACTIVE_MODEL = RUNWAY_SEEDANCE_MODEL;

export const RUNWAY_SUPPORTED_ASPECT_RATIOS: CommercialAspectRatio[] = [
  "16:9",
  "9:16",
  "1:1",
  "4:5",
  "4:3",
  "3:4",
];

function clampShotDuration(seconds: number): number {
  const n = Math.round(Number(seconds) || 0);
  return Math.max(4, Math.min(30, n));
}

function mapRunwayStatus(status: string): ProviderJobStatus["state"] {
  switch (status) {
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    case "RUNNING":
      return "running";
    case "PENDING":
    case "THROTTLED":
    default:
      return "pending";
  }
}

function detectImageMime(url: string, mimeType?: string): string | undefined {
  const dataMatch = url.match(/^data:(image\/[a-z0-9.+-]+)/i);
  if (dataMatch) return dataMatch[1].toLowerCase();

  // Prefer path extension over declared mime — callers often default mimeType to image/jpeg.
  const path = url.split("?")[0]!.toLowerCase();
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg")) return "image/svg+xml";

  if (mimeType?.toLowerCase().startsWith("image/")) {
    return mimeType.toLowerCase().split(";")[0]!.trim();
  }
  return undefined;
}

async function probeHttpsImageMime(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) return undefined;
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    return contentType?.startsWith("image/") ? contentType : undefined;
  } catch {
    return undefined;
  }
}

function isAllowedRunwayUriScheme(url: string): boolean {
  if (url.startsWith("data:image/")) return true;
  if (url.startsWith("runway://")) return true;
  if (url.startsWith("https://") && url.length <= 2048) return true;
  return false;
}

async function loadImageBuffer(url: string): Promise<Buffer | undefined> {
  try {
    if (url.startsWith("data:image/")) {
      const comma = url.indexOf(",");
      if (comma < 0) return undefined;
      return Buffer.from(url.slice(comma + 1), "base64");
    }
    if (url.startsWith("https://")) {
      const response = await fetch(url);
      if (!response.ok) return undefined;
      return Buffer.from(await response.arrayBuffer());
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Re-encode every reference through sharp so Seedance gets a safe still:
 * JPEG, bounded size, aspect within 0.4–4. Fixes GIF/tiny/extreme-aspect ASSET failures.
 */
async function normalizeImageBufferToJpegDataUri(input: Buffer): Promise<string | undefined> {
  try {
    const meta = await sharp(input, { pages: 1, failOn: "none" }).metadata();
    let width = meta.width || 0;
    let height = meta.height || 0;
    if (!width || !height) return undefined;

    let pipeline = sharp(input, { pages: 1, failOn: "none" }).rotate();

    let aspect = width / height;
    if (aspect < REF_MIN_ASPECT || aspect > REF_MAX_ASPECT) {
      const targetAspect = Math.min(REF_MAX_ASPECT, Math.max(REF_MIN_ASPECT, aspect));
      const cropW =
        aspect > targetAspect ? Math.round(height * targetAspect) : width;
      const cropH =
        aspect > targetAspect ? height : Math.round(width / targetAspect);
      const left = Math.max(0, Math.floor((width - cropW) / 2));
      const top = Math.max(0, Math.floor((height - cropH) / 2));
      pipeline = pipeline.extract({ left, top, width: cropW, height: cropH });
      width = cropW;
      height = cropH;
      aspect = width / height;
    }

    const minSide = Math.min(width, height);
    const maxSide = Math.max(width, height);
    if (minSide < REF_MIN_SIDE || maxSide > REF_MAX_SIDE) {
      const scaleUp = minSide > 0 && minSide < REF_MIN_SIDE ? REF_MIN_SIDE / minSide : 1;
      const scaleDown = maxSide * scaleUp > REF_MAX_SIDE ? REF_MAX_SIDE / (maxSide * scaleUp) : 1;
      const scale = scaleUp * scaleDown;
      pipeline = pipeline.resize({
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        fit: "fill",
      });
    }

    let jpeg = await pipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
    if (jpeg.length > RUNWAY_DATA_URI_MAX_BYTES) {
      jpeg = await sharp(jpeg)
        .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 75, mozjpeg: true })
        .toBuffer();
    }
    if (jpeg.length > RUNWAY_DATA_URI_MAX_BYTES) return undefined;
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/**
 * Seedance accepts https:// (max 2048 chars), runway://, or data:image/* (up to 5MB).
 * All decoded refs are normalized to JPEG data URIs so third-party validation is stable.
 */
async function resolveRunwayImageUri(ref?: {
  url?: string;
  mimeType?: string;
}): Promise<string | undefined> {
  const url = ref?.url?.trim();
  if (!url || !isAllowedRunwayUriScheme(url)) return undefined;

  let mime = detectImageMime(url, ref?.mimeType);
  const path = url.split("?")[0] || url;
  const hasImageExt = /\.(jpe?g|png|webp|gif|svg)$/i.test(path);
  if (url.startsWith("https://") && !hasImageExt) {
    const probed = await probeHttpsImageMime(url);
    if (probed) mime = probed;
  }

  if (mime && !RUNWAY_IMAGE_MIMES.has(mime) && mime !== "image/gif") {
    return undefined;
  }

  const buffer = await loadImageBuffer(url);
  if (!buffer?.length) return undefined;
  return normalizeImageBufferToJpegDataUri(buffer);
}

export function getRunwayCapabilities(): VideoProviderCapabilities {
  const config = getRunwayProviderConfig();
  return {
    id: RUNWAY_PROVIDER_ID,
    label: "Runway",
    model: config.model || RUNWAY_ACTIVE_MODEL,
    supportedDurationsSeconds: Array.from({ length: 27 }, (_, i) => i + 4),
    minDurationSeconds: 4,
    maxDurationSeconds: 30,
    supportedAspectRatios: RUNWAY_SUPPORTED_ASPECT_RATIOS,
    supportedResolutions: ["720p", "1080p"],
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
    integrationStatus: "ready",
  };
}

export function checkRunwayAvailability(): ProviderAvailability {
  const credentialsConfigured = hasRunwayCredentials();
  if (!credentialsConfigured) {
    return {
      id: RUNWAY_PROVIDER_ID,
      status: "credentials_missing",
      credentialsConfigured: false,
      adapterImplemented: true,
      message: "Set RUNWAY_API_KEY (or RUNWAYML_API_SECRET). RunwayProvider is implemented; credentials are missing.",
    };
  }
  return {
    id: RUNWAY_PROVIDER_ID,
    status: "available",
    credentialsConfigured: true,
    adapterImplemented: true,
    message: `RunwayProvider ready. Active model: ${getRunwayProviderConfig().model || RUNWAY_ACTIVE_MODEL}.`,
  };
}

export class RunwayProvider implements VideoProvider {
  readonly id: VideoProviderId = RUNWAY_PROVIDER_ID;

  getCapabilities(): VideoProviderCapabilities {
    return getRunwayCapabilities();
  }

  checkAvailability(): ProviderAvailability {
    return checkRunwayAvailability();
  }

  estimateVideoCost(request: ProviderCostEstimateInput): CostEstimate {
    const perSecond = getRunwayProviderConfig().costPerSecondUsd;
    const durationSeconds = clampShotDuration(request.durationSeconds);
    return {
      currency: "USD",
      durationSeconds,
      estimatedCostUsd:
        perSecond != null ? Number((perSecond * durationSeconds).toFixed(4)) : undefined,
      notes: `Runway model ${getRunwayProviderConfig().model || RUNWAY_ACTIVE_MODEL}`,
    };
  }

  async generateVideo(request: ProviderGenerateRequest): Promise<ProviderGenerateAccepted> {
    if (!getRunwayApiKey()) {
      throw new Error(RUNWAY_API_KEY_SETUP_MESSAGE);
    }

    const { promptText } = adaptCompiledPromptForRunway(request.prompt);
    const duration = clampShotDuration(request.durationSeconds);
    const quality = request.resolution === "1080p" ? "high" : "standard";
    const ratio = runwayRatioForAspect(request.aspectRatio, quality);

    const startFrame = await resolveRunwayImageUri(request.startFrame);
    const referenceImages: RunwayReferenceImage[] = [];
    // Prefer product refs; Seedance third-party validation is strict on logos/GIFs/tiny assets.
    const refs = [...(request.productReferences || []), ...(request.referenceImages || [])];
    const maxRefs = Math.min(4, 30);
    for (let i = 0; i < refs.length && referenceImages.length < maxRefs; i++) {
      const uri = await resolveRunwayImageUri(refs[i]);
      if (!uri) continue;
      referenceImages.push({ uri });
    }

    if (refs.length && !referenceImages.length) {
      console.warn("[runway-provider] All reference images were skipped (unsupported/invalid). Continuing text-only.");
    } else if (referenceImages.length) {
      console.log("[runway-provider] references.normalized", {
        inputCount: refs.length,
        outputCount: referenceImages.length,
      });
    }

    const mode = request.mode;
    const useStartFrame = Boolean(startFrame) && (mode === "image-to-video" || mode === "first-last-frame");

    const task = await createRunwayVideoTask({
      promptText,
      duration,
      ratio,
      promptImage: useStartFrame ? startFrame : undefined,
      referenceImages: !useStartFrame && referenceImages.length ? referenceImages : undefined,
    });

    return {
      providerJobId: task.id,
      status: "submitted",
      provider: RUNWAY_PROVIDER_ID,
      model: getRunwayProviderConfig().model || RUNWAY_ACTIVE_MODEL,
    };
  }

  async getJob(providerJobId: string): Promise<ProviderJobStatus> {
    const task = await getRunwayTask(providerJobId);
    const state = mapRunwayStatus(task.status);
    return {
      providerJobId: task.id,
      state,
      assetUrl: state === "succeeded" ? task.output?.[0] : undefined,
      failureReason: task.failure || task.error,
    };
  }
}

export function createRunwayProvider(): VideoProvider {
  return new RunwayProvider();
}

/** Download a completed Runway output URL to a Buffer (used by delivery layer). */
export async function downloadRunwayProviderOutput(url: string): Promise<Buffer> {
  return downloadRunwayOutput(url);
}
