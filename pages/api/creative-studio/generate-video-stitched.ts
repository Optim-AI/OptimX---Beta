// pages/api/creative-studio/generate-video-stitched.ts
// Generates multiple Veo clips (typically 2x ~8s) and stitches them into one MP4.
// Reference: https://ai.google.dev/gemini-api/docs/video
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";
import { resolveVideoDeliveryUrl } from "@/lib/creative-studio/video-delivery";
import { parseVideoDataUrl } from "@/lib/creative-studio/parse-video-data-url";
import {
  buildVeoReferenceAssets,
  createVeoReferenceAsset,
  VEO_MAX_REFERENCE_IMAGES,
} from "@/lib/creative-studio/veo-reference-images";
import {
  fetchWithGeminiRateLimitRetry,
  isGeminiQuotaExhaustedError,
  isGeminiRateLimitError,
  withRetryOnGeminiRateLimit,
} from "@/lib/gemini-retry";
import {
  buildVeoGenerateSafetyConfig,
  computeVoiceoverBudget,
  finalizeVoiceoverForClip,
  normalizeVeoDuration,
  SEGMENT_SECONDS,
  estimateVeoPromptTokens,
  VEO_PROMPT_MAX_TOKENS,
} from "@/lib/creative-studio/video-prompt-utils";
import {
  assertPromptWithinBudget,
  resolveRequestFromApiBody,
  resolveVeoPrompt,
} from "@/lib/creative-studio/resolve-veo-prompt";
import { referenceSlotsFromRequest } from "@/lib/creative-studio/reference-labels";
import {
  getVeoApiKey,
  getVeoApiKeySource,
  VEO_API_KEY_SETUP_MESSAGE,
} from "@/lib/gemini-config";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
  maxDuration: 300, // Requires Vercel Pro (up to 300s). Hobby plan max is 60s — 16s videos may timeout.
};

const MODEL = "veo-3.1-fast-generate-preview";
const MAX_REFERENCE_IMAGES = VEO_MAX_REFERENCE_IMAGES;

function runFfmpeg(args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const executable = getFfmpegExecutable();
    const proc = spawn(executable, args, { cwd });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += String(d)));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg failed (code ${code}): ${stderr.slice(-4000)}`));
    });
  });
}

async function writeMp4DataUrlToFile(dataUrl: string, outPath: string) {
  const buf = parseVideoDataUrl(dataUrl);
  if (!buf) throw new Error("Expected a video data URL");
  await fs.writeFile(outPath, buf);
}

async function fileToVideoDataUrl(filePath: string) {
  const buf = await fs.readFile(filePath);
  return `data:video/mp4;base64,${buf.toString("base64")}`;
}

async function extractLastFrameJpeg(mp4Path: string, jpgPath: string) {
  // Take a frame from the tail of clip 1 to anchor continuity for clip 2.
  try {
    await runFfmpeg(["-y", "-sseof", "-0.2", "-i", mp4Path, "-vframes", "1", "-q:v", "2", jpgPath]);
  } catch {
    await runFfmpeg(["-y", "-sseof", "-1", "-i", mp4Path, "-vframes", "1", "-q:v", "2", jpgPath]);
  }
}

async function generateClipDataUrl(params: {
  ai: GoogleGenAI;
  prompt: string;
  aspectRatio: string;
  referenceImages: Array<{ image: { imageBytes: string; mimeType: string }; referenceType: "asset" }>;
  clipDurationSeconds: number;
}) {
  const veoApiKeySource = getVeoApiKeySource();
  const generateConfig: any = {
    aspectRatio: params.aspectRatio,
    durationSeconds: params.clipDurationSeconds,
    numberOfVideos: 1,
    ...buildVeoGenerateSafetyConfig(),
  };
  if (params.referenceImages.length > 0) {
    generateConfig.referenceImages = params.referenceImages.slice(0, MAX_REFERENCE_IMAGES);
  }

  const generateParams: any = {
    model: MODEL,
    prompt: params.prompt,
    config: generateConfig,
  };

  let operation = await withRetryOnGeminiRateLimit(
    () => params.ai.models.generateVideos(generateParams),
    { maxRetries: 6, operationLabel: "veo-generateVideos" }
  );

  console.log("⏳ Segment video generation started", {
    operationName: operation?.name || "(missing)",
    veoApiKeySource,
    clipDurationSeconds: params.clipDurationSeconds,
  });

  const pollIntervalMs = 10_000;
  const maxAttempts = 55;
  let attempts = 0;
  while (!operation.done && attempts < maxAttempts) {
    attempts++;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    try {
      operation = await withRetryOnGeminiRateLimit(
        () => params.ai.operations.getVideosOperation({ operation }),
        { maxRetries: 8, operationLabel: "veo-getVideosOperation" }
      );
    } catch (pollError: any) {
      console.error("❌ Veo segment polling failed", {
        operationName: operation?.name || "(missing)",
        veoApiKeySource,
        status: pollError?.status,
        message: pollError?.message || String(pollError),
      });
      throw pollError;
    }
  }

  if (!operation.done) {
    throw new Error(
      "Video generation timed out while waiting for AI. Extended (16s) videos take longer — please try again."
    );
  }
  if (operation.error) {
    const errMsg = (operation.error as any).message || JSON.stringify(operation.error);
    throw new Error(`Video generation failed: ${errMsg}`);
  }
  const generatedVideo = operation.response?.generatedVideos?.[0];
  if (!generatedVideo?.video) throw new Error("Video generation returned no video.");

  if (generatedVideo.video.videoBytes) {
    return `data:video/mp4;base64,${generatedVideo.video.videoBytes}`;
  }
  if (generatedVideo.video.uri) {
    const veoApiKey = getVeoApiKey();
    const videoResponse = await fetchWithGeminiRateLimitRetry(
      generatedVideo.video.uri,
      { headers: { "x-goog-api-key": veoApiKey! } },
      { maxRetries: 6, operationLabel: "veo-download-video" }
    );
    if (!videoResponse.ok) throw new Error("Failed to download generated video");
    const buf = Buffer.from(await videoResponse.arrayBuffer());
    return `data:video/mp4;base64,${buf.toString("base64")}`;
  }
  throw new Error("No video data available in response");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  const veoApiKey = getVeoApiKey();
  if (!veoApiKey) {
    return res.status(503).json({
      ok: false,
      error: VEO_API_KEY_SETUP_MESSAGE,
      code: "VEO_API_KEY_MISSING",
    });
  }
  const veoApiKeySource = getVeoApiKeySource();
  try {
    getFfmpegExecutable();
  } catch {
    return res.status(500).json({ ok: false, error: "ffmpeg is not available in this runtime" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: veoApiKey });
    const {
      prompt,
      product_name,
      brand_name,
      category,
      user_description,
      creative_format,
      hook_type,
      campaign_goal,
      creative_strategy,
      style,
      duration,
      aspect_ratio,
      quality,
      final_video_prompt,
      voiceover_script,
      headline,
      subtext,
      key_message,
      cta,
      product_images,
      brand_logo,
      hero_image,
      storyboard,
    } = req.body;

    console.log("🎬 Stitched video request", {
      productName: product_name,
      brandName: brand_name,
      duration,
      style,
      veoApiKeySource,
    });

    const allowedAspectRatios = ["9:16", "16:9", "4:5"];
    let videoAspectRatio = typeof aspect_ratio === "string" ? aspect_ratio.trim() : "9:16";
    if (!allowedAspectRatios.includes(videoAspectRatio)) videoAspectRatio = "9:16";

    const requestedDuration = Math.max(1, parseInt(duration) || SEGMENT_SECONDS);
    const segments = requestedDuration > SEGMENT_SECONDS ? 2 : 1;

    const baseReferenceImages = await buildVeoReferenceAssets({
      hero_image,
      product_images,
      brand_logo,
    });

    const segmentDuration = normalizeVeoDuration(
      segments === 2 ? SEGMENT_SECONDS : requestedDuration,
      baseReferenceImages.length > 0
    );

    const baseUserPrompt = final_video_prompt || prompt;
    if (!baseUserPrompt) {
      return res.status(400).json({ ok: false, error: "Either 'prompt' or 'final_video_prompt' is required" });
    }

    const storyboardScenes = Array.isArray(storyboard) ? storyboard : undefined;

    const perClipBudget = computeVoiceoverBudget(segmentDuration);
    const voFinalizeOpts = {
      totalDurationSeconds: requestedDuration,
      brandName: brand_name as string | undefined,
      productName: product_name as string | undefined,
      keyMessage: key_message as string | undefined,
      cta: cta as string | undefined,
      creativeStrategy: creative_strategy as import("@/lib/creative-studio/video-prompt-utils").VeoPromptInput["creativeStrategy"],
      userDescription: user_description as string | undefined,
    };

    let voiceoverPart1 = voiceover_script
      ? finalizeVoiceoverForClip(String(voiceover_script), segmentDuration, {
          ...voFinalizeOpts,
          segmentIndex: segments === 2 ? 0 : undefined,
          segmentCount: segments === 2 ? 2 : undefined,
        })
      : "";
    let voiceoverPart2 =
      segments === 2 && voiceover_script
        ? finalizeVoiceoverForClip(String(voiceover_script), segmentDuration, {
            ...voFinalizeOpts,
            segmentIndex: 1,
            segmentCount: 2,
          })
        : "";

    if (voiceoverPart1) {
      console.log(
        `🎙️ Voiceover clip 1: ${voiceoverPart1.split(/\s+/).length} words (${perClipBudget.minWords}–${perClipBudget.maxWords}, finish by ${perClipBudget.finishBySecond}s)`
      );
    }
    if (voiceoverPart2) {
      console.log(
        `🎙️ Voiceover clip 2: ${voiceoverPart2.split(/\s+/).length} words (${perClipBudget.minWords}–${perClipBudget.maxWords}, finish by ${perClipBudget.finishBySecond}s)`
      );
    }

    const clip1Resolved = resolveVeoPrompt(
      resolveRequestFromApiBody(req.body, {
        clipDurationSeconds: segmentDuration,
        totalDurationSeconds: requestedDuration,
        aspectRatio: videoAspectRatio,
        hasReferenceImages: baseReferenceImages.length > 0,
        voiceoverScript: voiceoverPart1,
        segmentIndex: segments === 2 ? 0 : undefined,
        segmentCount: segments === 2 ? 2 : undefined,
      })
    );
    const clip1Prompt = assertPromptWithinBudget(clip1Resolved.prompt);
    console.log(`📝 Clip 1 prompt (${clip1Resolved.source}, ~${estimateVeoPromptTokens(clip1Prompt)} tokens)`);

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "optimx-video-"));
    const clip1Path = path.join(tmpDir, "clip1.mp4");
    const clip2Path = path.join(tmpDir, "clip2.mp4");
    const framePath = path.join(tmpDir, "clip1_last.jpg");
    const outPath = path.join(tmpDir, "stitched.mp4");
    const listPath = path.join(tmpDir, "list.txt");

    // Clip 1
    const clip1DataUrl = await generateClipDataUrl({
      ai,
      prompt: clip1Prompt,
      aspectRatio: videoAspectRatio,
      referenceImages: baseReferenceImages,
      clipDurationSeconds: segmentDuration,
    });
    await writeMp4DataUrlToFile(clip1DataUrl, clip1Path);

    // Continuity frame from end of clip 1
    await extractLastFrameJpeg(clip1Path, framePath);
    const frameBuf = await fs.readFile(framePath);
    const continuityAsset = await createVeoReferenceAsset(
      `data:image/jpeg;base64,${frameBuf.toString("base64")}`
    );

    // Clip 2 (only if requested)
    let stitchedDataUrl = clip1DataUrl;
    if (segments === 2) {
      // Keep hero + product refs; drop last slot (logo or extra product angle) to make room for continuity.
      const clip2ReferenceImages = [...baseReferenceImages];
      if (continuityAsset) {
        while (clip2ReferenceImages.length >= MAX_REFERENCE_IMAGES) {
          clip2ReferenceImages.pop();
        }
        clip2ReferenceImages.push(continuityAsset);
      }

      const clip2RefSlots = referenceSlotsFromRequest({
        hero_image,
        brand_logo,
        product_images,
        segment_has_continuity_frame: true,
        product_name,
        brand_name,
      });

      const clip2Resolved = resolveVeoPrompt(
        resolveRequestFromApiBody(req.body, {
          clipDurationSeconds: segmentDuration,
          totalDurationSeconds: requestedDuration,
          aspectRatio: videoAspectRatio,
          hasReferenceImages: clip2ReferenceImages.length > 0,
          voiceoverScript: voiceoverPart2,
          segmentIndex: 1,
          segmentCount: 2,
          referenceSlots: clip2RefSlots,
        })
      );
      const clip2Prompt = assertPromptWithinBudget(clip2Resolved.prompt);
      console.log(`📝 Clip 2 prompt (${clip2Resolved.source}, ~${estimateVeoPromptTokens(clip2Prompt)} tokens, continuity frame attached)`);

      const clip2DataUrl = await generateClipDataUrl({
        ai,
        prompt: clip2Prompt,
        aspectRatio: videoAspectRatio,
        referenceImages: clip2ReferenceImages,
        clipDurationSeconds: segmentDuration,
      });
      await writeMp4DataUrlToFile(clip2DataUrl, clip2Path);

      // Stitch with audio preserved; re-encode if stream-copy concat fails
      await fs.writeFile(listPath, "file 'clip1.mp4'\nfile 'clip2.mp4'\n");
      try {
        await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath], tmpDir);
      } catch {
        try {
          await runFfmpeg(
            [
              "-y",
              "-i",
              clip1Path,
              "-i",
              clip2Path,
              "-filter_complex",
              "[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[outv][outa]",
              "-map",
              "[outv]",
              "-map",
              "[outa]",
              "-c:v",
              "libx264",
              "-preset",
              "veryfast",
              "-crf",
              "18",
              "-c:a",
              "aac",
              "-b:a",
              "192k",
              "-movflags",
              "+faststart",
              outPath,
            ],
            tmpDir
          );
        } catch {
          // Last resort: video-only concat if a clip has no audio stream
          await runFfmpeg(
            [
              "-y",
              "-i",
              clip1Path,
              "-i",
              clip2Path,
              "-filter_complex",
              "[0:v][1:v]concat=n=2:v=1:a=0[v]",
              "-map",
              "[v]",
              "-c:v",
              "libx264",
              "-preset",
              "veryfast",
              "-crf",
              "18",
              "-movflags",
              "+faststart",
              outPath,
            ],
            tmpDir
          );
        }
      }

      stitchedDataUrl = await fileToVideoDataUrl(outPath);
    }

    const delivery = await resolveVideoDeliveryUrl(stitchedDataUrl, {
      forceUpload: segments === 2,
    });
    console.log(
      `✅ Stitched video ready: ${delivery.delivery}, ${Math.round(delivery.bytes / 1024)}KB, segments=${segments}`
    );

    // Cleanup best-effort
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

    return res.status(200).json({
      ok: true,
      videoUrl: delivery.videoUrl,
      delivery: delivery.delivery,
      videoBytes: delivery.bytes,
      duration: segments === 2 ? segmentDuration * 2 : segmentDuration,
      aspectRatio: videoAspectRatio,
      referenceImagesUsed: baseReferenceImages.length,
      model: MODEL,
      segments,
      stitched: segments === 2,
      quality: quality || "standard",
    });
  } catch (error: any) {
    const errorMessage = error?.message || String(error);

    if (isGeminiQuotaExhaustedError(error)) {
      return res.status(429).json({
        ok: false,
        error:
          "Google Veo API quota exhausted for this API key. Enable billing or raise your quota at https://ai.google.dev/gemini-api/docs/rate-limits, then try again.",
        details: errorMessage,
        quotaExhausted: true,
      });
    }

    const looksLikeRateLimit =
      /\brate limit\b|rate-limit|too many requests|requests per|RESOURCE_EXHAUSTED/i.test(errorMessage);
    if (isGeminiRateLimitError(error) || errorMessage.includes("quota") || looksLikeRateLimit) {
      return res.status(429).json({
        ok: false,
        error: "Veo rate limit hit. Please wait a minute and try again.",
        details: errorMessage,
      });
    }

    const looksLikeTimeout =
      /timed out|timeout|FUNCTION_INVOCATION_TIMEOUT|504|deadline exceeded/i.test(errorMessage);
    if (looksLikeTimeout) {
      return res.status(504).json({
        ok: false,
        error:
          "Extended video generation timed out on the server. 16s videos need ~3–5 minutes (2 AI clips + stitch). Ensure Vercel Pro (300s function limit) and try again.",
        details: errorMessage,
      });
    }

    return res.status(500).json({
      ok: false,
      error: errorMessage || "Failed to generate stitched video",
    });
  }
}

