// pages/api/creative-studio/generate-video-stitched.ts
// Generates multiple Veo clips (typically 2x ~8s) and stitches them into one MP4.
// Reference: https://ai.google.dev/gemini-api/docs/video
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";
import { resolveVideoDeliveryUrl } from "@/lib/creative-studio/video-delivery";
import {
  fetchWithGeminiRateLimitRetry,
  isGeminiQuotaExhaustedError,
  isGeminiRateLimitError,
  withRetryOnGeminiRateLimit,
} from "@/lib/gemini-retry";
import {
  buildVeoGenerateSafetyConfig,
  computeVoiceoverBudget,
  normalizeVeoDuration,
  SEGMENT_SECONDS,
  splitVoiceoverForStitch,
  truncateVoiceover,
  estimateVeoPromptTokens,
  VEO_PROMPT_MAX_TOKENS,
} from "@/lib/creative-studio/video-prompt-utils";
import {
  assertPromptWithinBudget,
  resolveRequestFromApiBody,
  resolveVeoPrompt,
} from "@/lib/creative-studio/resolve-veo-prompt";
import { referenceSlotsFromRequest } from "@/lib/creative-studio/reference-labels";
import { getVeoApiKey, VEO_API_KEY_SETUP_MESSAGE } from "@/lib/gemini-config";

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
const MAX_REFERENCE_IMAGES = 3;

function parseDataUrl(
  dataUrl: string
): { imageBytes: string; mimeType: string } | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], imageBytes: match[2] };
}

async function convertToSupportedFormat(
  buffer: Buffer,
  inputMime: string
): Promise<{ imageBytes: string; mimeType: string }> {
  const mime = inputMime.toLowerCase().split(";")[0].trim();
  if (mime === "image/jpeg" || mime === "image/png") {
    return { imageBytes: buffer.toString("base64"), mimeType: mime };
  }
  try {
    const sharpInput = mime.includes("svg") ? { density: 144 } : undefined;
    const converted = await sharp(buffer, sharpInput).jpeg({ quality: 92 }).toBuffer();
    return { imageBytes: converted.toString("base64"), mimeType: "image/jpeg" };
  } catch {
    return { imageBytes: buffer.toString("base64"), mimeType: mime };
  }
}

async function fetchImageAsBase64(
  url: string
): Promise<{ imageBytes: string; mimeType: string } | null> {
  try {
    if (url.startsWith("data:")) {
      const parsed = parseDataUrl(url);
      if (!parsed) return null;
      const buffer = Buffer.from(parsed.imageBytes, "base64");
      return convertToSupportedFormat(buffer, parsed.mimeType);
    }

    const response = await fetch(url, {
      headers: {
        Accept: "image/*",
        "User-Agent": "Mozilla/5.0 (compatible; OptimX-VideoGenerator/1.0)",
      },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const mimeType = contentType.split(";")[0].trim();
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(mimeType)) return null;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const result = await convertToSupportedFormat(buffer, mimeType);
    if (result.imageBytes.length > 14_000_000) return null;
    return result;
  } catch {
    return null;
  }
}

async function getImageData(
  imageSource: string
): Promise<{ imageBytes: string; mimeType: string } | null> {
  if (imageSource.startsWith("data:")) {
    const parsed = parseDataUrl(imageSource);
    if (!parsed) return null;
    const buffer = Buffer.from(parsed.imageBytes, "base64");
    return convertToSupportedFormat(buffer, parsed.mimeType);
  }
  if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
    return await fetchImageAsBase64(imageSource);
  }
  return null;
}

async function createReferenceAsset(imageSource: string): Promise<{
  image: { imageBytes: string; mimeType: string };
  referenceType: "asset";
} | null> {
  const imageData = await getImageData(imageSource);
  if (!imageData) return null;
  return {
    image: { imageBytes: imageData.imageBytes, mimeType: imageData.mimeType },
    referenceType: "asset",
  };
}

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
  const parsed = parseDataUrl(dataUrl);
  if (!parsed || !parsed.mimeType.includes("video")) {
    throw new Error("Expected a video data URL");
  }
  const buf = Buffer.from(parsed.imageBytes, "base64");
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

  const pollIntervalMs = 10_000;
  const maxAttempts = 55;
  let attempts = 0;
  while (!operation.done && attempts < maxAttempts) {
    attempts++;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    operation = await withRetryOnGeminiRateLimit(
      () => params.ai.operations.getVideosOperation({ operation }),
      { maxRetries: 8, operationLabel: "veo-getVideosOperation" }
    );
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

    const allowedAspectRatios = ["9:16", "16:9", "4:5"];
    let videoAspectRatio = typeof aspect_ratio === "string" ? aspect_ratio.trim() : "9:16";
    if (!allowedAspectRatios.includes(videoAspectRatio)) videoAspectRatio = "9:16";

    const requestedDuration = Math.max(1, parseInt(duration) || SEGMENT_SECONDS);
    const segments = requestedDuration > SEGMENT_SECONDS ? 2 : 1;

    // Build base reference images (max 3)
    const referenceImagePromises: Promise<{
      image: { imageBytes: string; mimeType: string };
      referenceType: "asset";
    } | null>[] = [];
    if (hero_image && referenceImagePromises.length < MAX_REFERENCE_IMAGES) {
      referenceImagePromises.push(createReferenceAsset(hero_image));
    }
    if (brand_logo && referenceImagePromises.length < MAX_REFERENCE_IMAGES) {
      referenceImagePromises.push(createReferenceAsset(brand_logo));
    }
    if (product_images && Array.isArray(product_images) && referenceImagePromises.length < MAX_REFERENCE_IMAGES) {
      const slotsLeft = MAX_REFERENCE_IMAGES - referenceImagePromises.length;
      const productImgs = product_images
        .filter((img: string) => img && img !== hero_image && img !== brand_logo)
        .slice(0, slotsLeft);
      for (const img of productImgs) referenceImagePromises.push(createReferenceAsset(img));
    }
    const referenceImageResults = await Promise.all(referenceImagePromises);
    const baseReferenceImages = referenceImageResults.filter(
      (r): r is NonNullable<typeof r> => r != null
    );

    const segmentDuration = normalizeVeoDuration(
      segments === 2 ? SEGMENT_SECONDS : requestedDuration,
      baseReferenceImages.length > 0
    );

    const baseUserPrompt = final_video_prompt || prompt;
    if (!baseUserPrompt) {
      return res.status(400).json({ ok: false, error: "Either 'prompt' or 'final_video_prompt' is required" });
    }

    const storyboardScenes = Array.isArray(storyboard) ? storyboard : undefined;

    // Split voiceover into two halves by word budget so each 8s clip gets a finishable script
    const fullVoBudget = computeVoiceoverBudget(requestedDuration);
    const trimmedFullVoiceover = voiceover_script
      ? truncateVoiceover(String(voiceover_script), fullVoBudget.maxWords)
      : "";
    const perClipBudget = computeVoiceoverBudget(segmentDuration);

    let voiceoverPart1 = trimmedFullVoiceover;
    let voiceoverPart2 = "";
    if (trimmedFullVoiceover && segments === 2) {
      const split = splitVoiceoverForStitch(trimmedFullVoiceover, perClipBudget.maxWords);
      voiceoverPart1 = truncateVoiceover(split.part1, perClipBudget.maxWords);
      voiceoverPart2 = truncateVoiceover(split.part2, perClipBudget.maxWords);
      console.log(
        `🎙️ Voiceover split: Part1 ${voiceoverPart1.split(/\s+/).length} words, Part2 ${voiceoverPart2.split(/\s+/).length} words`
      );
    } else if (trimmedFullVoiceover) {
      voiceoverPart1 = truncateVoiceover(trimmedFullVoiceover, perClipBudget.maxWords);
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
    const continuityAsset = await createReferenceAsset(
      `data:image/jpeg;base64,${frameBuf.toString("base64")}`
    );

    // Clip 2 (only if requested)
    let stitchedDataUrl = clip1DataUrl;
    if (segments === 2) {
      // Prefer keeping hero + product refs; if slots full, drop brand logo (middle slot) to make room for continuity.
      const clip2ReferenceImages = [...baseReferenceImages];
      if (continuityAsset) {
        if (clip2ReferenceImages.length >= MAX_REFERENCE_IMAGES) {
          // base order is: hero, brand_logo, product_image
          if (clip2ReferenceImages.length >= 2) clip2ReferenceImages.splice(1, 1);
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

