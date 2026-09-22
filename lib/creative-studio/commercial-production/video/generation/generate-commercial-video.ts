/**
 * Temporary Brand Studio commercial video path (pre–Shot Planner / Timeline).
 *
 * Intended Commercial Production Engine architecture (Phase 2+):
 *   Campaign (15s|30s) → many CommercialShots → VideoProvider.generateVideo per shot
 *   → QC → Timeline → final commercial
 *
 * This module is a LEGACY/FALLBACK single-clip bridge for the current UI:
 *   Campaign duration (15|30) is sent as one provider generation while Seedance
 *   supports that length. It must not become the multi-shot engine design.
 *
 * Active stack:
 *   PromptCompiler (provider-agnostic) → RunwayProvider (VideoProvider)
 *   → Runway API → model seedance2_5
 *
 * Does NOT use resolveVeoPrompt or film-engine Veo paths.
 */

import { resolveVideoDeliveryUrl, uploadVideoBuffer } from "@/lib/creative-studio/video-delivery";
import { collectProductReferenceSources } from "@/lib/creative-studio/veo-reference-images";
import {
  computeVoiceoverBudget,
  finalizeVoiceoverForClip,
} from "@/lib/creative-studio/video-prompt-utils";
import { normalizeCampaignDuration } from "../../campaign/campaign-duration";
import type { CampaignDurationSeconds } from "../../campaign/campaign-duration";
import type { CommercialAspectRatio } from "../../campaign/types";
import type { StoredAssetRef } from "../../assets";
import { compilePromptFromLegacyBrief } from "../prompt/compiler";
import {
  RUNWAY_API_KEY_SETUP_MESSAGE,
  RUNWAY_ACTIVE_MODEL,
  downloadRunwayProviderOutput,
} from "../providers/runway";
import { getActiveVideoProvider } from "../providers/registry";
import type { ProviderJobStatus } from "../providers/types";

const ALLOWED_ASPECT_RATIOS = ["9:16", "16:9", "4:5", "1:1"] as const;
const MAX_REFERENCE_IMAGES = 8;
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 12 * 60 * 1000;

export interface CommercialVideoResult {
  ok: true;
  videoUrl: string;
  delivery: "storage" | "inline";
  videoBytes: number;
  duration: CampaignDurationSeconds;
  aspectRatio: string;
  referenceImagesUsed: number;
  model: string;
  provider: "runway";
  providerJobId: string;
}

export interface CommercialVideoError {
  ok: false;
  status: number;
  error: string;
  code?: string;
  details?: string;
}

function toAssetRef(src: string, index: number): StoredAssetRef | null {
  const trimmed = src?.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  ) {
    return {
      id: `ref-${index}`,
      kind: "product_image",
      url: trimmed,
      mimeType: trimmed.startsWith("data:image/")
        ? trimmed.slice(5, trimmed.indexOf(";")) || "image/jpeg"
        : "image/jpeg",
    };
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForProviderJob(
  getJob: (id: string) => Promise<ProviderJobStatus>,
  providerJobId: string
): Promise<ProviderJobStatus> {
  const started = Date.now();
  while (Date.now() - started < MAX_WAIT_MS) {
    const status = await getJob(providerJobId);
    if (status.state === "succeeded") return status;
    if (status.state === "failed" || status.state === "cancelled") {
      throw new Error(status.failureReason || `Runway job ${status.state}`);
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Runway job timed out after ${Math.round(MAX_WAIT_MS / 60000)} minutes (${providerJobId}).`
  );
}

export async function generateCommercialVideoFromRequest(
  body: Record<string, unknown>
): Promise<CommercialVideoResult | CommercialVideoError> {
  const provider = getActiveVideoProvider();
  const availabilityResult = provider.checkAvailability();
  const avail =
    availabilityResult instanceof Promise ? await availabilityResult : availabilityResult;

  if (!avail.credentialsConfigured || avail.status === "credentials_missing") {
    return {
      ok: false,
      status: 503,
      error: RUNWAY_API_KEY_SETUP_MESSAGE,
      code: "RUNWAY_API_KEY_MISSING",
    };
  }

  const duration = normalizeCampaignDuration(body.duration as number | string | undefined);
  let aspectRatio = typeof body.aspect_ratio === "string" ? body.aspect_ratio.trim() : "9:16";
  if (!ALLOWED_ASPECT_RATIOS.includes(aspectRatio as (typeof ALLOWED_ASPECT_RATIOS)[number])) {
    aspectRatio = "9:16";
  }
  const quality = body.quality === "high" ? "high" : "standard";
  const commercialAspect = aspectRatio as CommercialAspectRatio;

  const finalVideoPrompt =
    typeof body.final_video_prompt === "string"
      ? body.final_video_prompt
      : typeof body.prompt === "string"
        ? body.prompt
        : undefined;

  if (!finalVideoPrompt) {
    return {
      ok: false,
      status: 400,
      error: "Either 'prompt' or 'final_video_prompt' is required",
    };
  }

  const referenceSources = collectProductReferenceSources({
    hero_image: body.hero_image as string | null,
    product_images: body.product_images as string[] | null,
    brand_logo: body.brand_logo as string | null,
    max: MAX_REFERENCE_IMAGES,
  });
  const productReferences: StoredAssetRef[] = [];
  for (let i = 0; i < referenceSources.length; i++) {
    const ref = toAssetRef(referenceSources[i], i);
    if (ref) productReferences.push(ref);
  }

  const voiceoverScript = typeof body.voiceover_script === "string" ? body.voiceover_script : "";
  const creativeStrategy = body.creative_strategy as { cta?: string } | undefined;
  const finalizedVoiceover = voiceoverScript
    ? finalizeVoiceoverForClip(voiceoverScript, duration, {
        totalDurationSeconds: duration,
        brandName: body.brand_name as string | undefined,
        productName: body.product_name as string | undefined,
        keyMessage: body.key_message as string | undefined,
        cta: (body.cta as string | undefined) || creativeStrategy?.cta,
        creativeStrategy: body.creative_strategy as any,
        userDescription: body.user_description as string | undefined,
      })
    : "";

  if (finalizedVoiceover) {
    const voBudget = computeVoiceoverBudget(duration);
    console.log(
      `🎙️ Voiceover finalized: ${finalizedVoiceover.split(/\s+/).length} words (${voBudget.minWords}–${voBudget.maxWords} target, finish by ${voBudget.finishBySecond}s / ${duration}s)`
    );
  }

  const storyboard = Array.isArray(body.storyboard)
    ? (body.storyboard as Array<{
        visual_description?: string;
        beat?: string;
        shot_purpose?: string;
      }>)
    : undefined;

  // Provider-agnostic compile — not resolveVeoPrompt / film-engine.
  const compiledPrompt = compilePromptFromLegacyBrief({
    productName: body.product_name as string | undefined,
    brandName: body.brand_name as string | undefined,
    category: body.category as string | undefined,
    userDescription: body.user_description as string | undefined,
    finalVideoPrompt,
    voiceoverScript: finalizedVoiceover || voiceoverScript,
    aspectRatio,
    durationSeconds: duration,
    hasReferenceImages: productReferences.length > 0,
    storyboard,
  });

  const caps = provider.getCapabilities();
  console.log("🎬 Commercial video via VideoProvider:", {
    provider: provider.id,
    model: caps.model,
    productName: body.product_name,
    brandName: body.brand_name,
    campaignDuration: duration,
    aspectRatio,
    referenceImages: productReferences.length,
    note: "single-clip fallback until Shot Planner + Timeline (Phase 2+)",
  });

  const jobId = `brand-studio-${Date.now()}`;
  const accepted = await provider.generateVideo({
    jobId,
    campaignId: jobId,
    shotId: `${jobId}-clip`,
    // text-to-video + product refs (Seedance `references`). Not a start-frame I2V call.
    mode: "text-to-video",
    prompt: compiledPrompt,
    durationSeconds: duration,
    aspectRatio: commercialAspect,
    resolution: quality === "high" ? "1080p" : "720p",
    generateAudio: true,
    productReferences: productReferences.length ? productReferences : undefined,
    referenceImages: productReferences.length ? productReferences : undefined,
  });

  console.log("⏳ Provider job submitted:", accepted.providerJobId, {
    provider: accepted.provider,
    model: accepted.model,
    duration,
  });

  const completed = await waitForProviderJob(
    (id) => provider.getJob(id),
    accepted.providerJobId
  );
  const outputUrl = completed.assetUrl;
  if (!outputUrl) {
    return {
      ok: false,
      status: 500,
      error: "Runway Seedance completed but returned no video URL. Please try again.",
    };
  }

  const buf = await downloadRunwayProviderOutput(outputUrl);
  let videoUrl: string;
  let delivery: "storage" | "inline";
  let bytes = buf.length;
  try {
    videoUrl = await uploadVideoBuffer(buf);
    delivery = "storage";
  } catch {
    const dataUrl = `data:video/mp4;base64,${buf.toString("base64")}`;
    const resolvedDelivery = await resolveVideoDeliveryUrl(dataUrl, {
      forceUpload: bytes > 3 * 1024 * 1024,
    });
    videoUrl = resolvedDelivery.videoUrl;
    delivery = resolvedDelivery.delivery;
    bytes = resolvedDelivery.bytes || bytes;
  }

  console.log(
    `✅ Seedance commercial ready (${duration}s, ${delivery}, ${Math.round(bytes / 1024)}KB)`
  );

  return {
    ok: true,
    videoUrl,
    delivery,
    videoBytes: bytes,
    duration,
    aspectRatio,
    referenceImagesUsed: productReferences.length,
    model: accepted.model || caps.model || RUNWAY_ACTIVE_MODEL,
    provider: "runway",
    providerJobId: completed.providerJobId,
  };
}
