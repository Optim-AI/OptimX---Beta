// pages/api/creative-studio/generate-video-stitched.ts
// Generates multiple Veo clips (typically 2x ~8s) and stitches them into one MP4.
// Reference: https://ai.google.dev/gemini-api/docs/video
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  fetchWithGeminiRateLimitRetry,
  isGeminiRateLimitError,
  withRetryOnGeminiRateLimit,
} from "@/lib/gemini-retry";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: "25mb",
    },
  },
  maxDuration: 300,
};

const GEMINI_VEO_API_KEY = process.env.GEMINI_VEO_API_KEY;
const MODEL = "veo-3.1-fast-generate-preview";
const SEGMENT_SECONDS = 8;
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
    if (!ffmpegPath) return reject(new Error("ffmpeg binary not available (ffmpeg-static)."));
    const proc = spawn(ffmpegPath, args, { cwd });
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
  await runFfmpeg(["-y", "-sseof", "-0.2", "-i", mp4Path, "-vframes", "1", "-q:v", "2", jpgPath]);
}

async function generateClipDataUrl(params: {
  ai: GoogleGenAI;
  prompt: string;
  aspectRatio: string;
  referenceImages: Array<{ image: { imageBytes: string; mimeType: string }; referenceType: "asset" }>;
}) {
  const generateConfig: any = {
    aspectRatio: params.aspectRatio,
    numberOfVideos: 1,
    safetyFilterLevel: "BLOCK_ONLY_HIGH",
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

  const pollIntervalMs = 12_000;
  const maxAttempts = 60;
  let attempts = 0;
  while (!operation.done && attempts < maxAttempts) {
    attempts++;
    await new Promise((r) => setTimeout(r, pollIntervalMs));
    operation = await withRetryOnGeminiRateLimit(
      () => params.ai.operations.getVideosOperation({ operation }),
      { maxRetries: 8, operationLabel: "veo-getVideosOperation" }
    );
  }

  if (!operation.done) throw new Error("Video generation timed out. Please try again.");
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
    const videoResponse = await fetchWithGeminiRateLimitRetry(
      generatedVideo.video.uri,
      { headers: { "x-goog-api-key": GEMINI_VEO_API_KEY! } },
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
  if (!GEMINI_VEO_API_KEY) {
    return res.status(500).json({ ok: false, error: "GEMINI_VEO_API_KEY is not configured" });
  }
  if (!ffmpegPath) {
    return res.status(500).json({ ok: false, error: "ffmpeg is not available in this runtime" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_VEO_API_KEY });
    const {
      prompt,
      product_name,
      brand_name,
      style,
      duration,
      aspect_ratio,
      quality,
      final_video_prompt,
      voiceover_script,
      headline,
      subtext,
      product_images,
      brand_logo,
      hero_image,
    } = req.body;

    const allowedAspectRatios = ["9:16", "16:9", "4:5"];
    let videoAspectRatio = typeof aspect_ratio === "string" ? aspect_ratio.trim() : "9:16";
    if (!allowedAspectRatios.includes(videoAspectRatio)) videoAspectRatio = "9:16";

    const requestedDuration = Math.max(1, parseInt(duration) || SEGMENT_SECONDS);
    const segments = requestedDuration > SEGMENT_SECONDS ? 2 : 1;
    const segmentDuration = segments === 2 ? SEGMENT_SECONDS : requestedDuration;

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

    const realismAndEditSpec = `
REALISM & IMAGE QUALITY (CRITICAL):
- Photorealistic live-action footage (unless the user explicitly requested animation).
- Bright, well-exposed image (avoid dim/underexposed scenes). Clean whites, natural skin tones, realistic contrast.
- Natural camera physics: realistic motion blur, stable horizon, no wobble/jitter, no warping.
- Commercial-grade color: consistent color temperature and grading across the whole video.
- High detail without "AI sharpness": avoid over-smoothing, plastic skin, halos, painterly textures.

EDITING & TRANSITIONS (CRITICAL):
- Make it feel human-shot and professionally edited, not AI-generated.
- Use a clear multi-shot edit WITH motivated cuts on action/beat.
- Prefer real-world transitions: match cuts, whip-pan cut, rack-focus cut, speed-ramp cut, natural occlusion wipe (passing object), or hard cuts.
- Avoid floaty morphing transitions, hallucinated dissolves, random camera teleports, flicker between shots, or object/label changes.

NEGATIVE CONSTRAINTS:
- No dark, muddy lighting. No flicker, strobing, frame-to-frame texture crawling.
- No jumping logos, changing packaging text, shifting product geometry, or inconsistent branding.
- No extra fingers/limbs, warped faces, melting objects, glitch artifacts, or watermark overlays.
`.trim();

    const styleDescriptions: Record<string, { prefix: string; details: string }> = {
      Cinematic: { prefix: "A cinematic, high-production", details: "Film-quality cinematography with dramatic lighting and smooth camera movements." },
      "Product Close-up": { prefix: "A premium product showcase", details: "Macro-level product cinematography with shallow depth of field, highlighting product details." },
      Lifestyle: { prefix: "A lifestyle-focused", details: "Authentic lifestyle footage with natural lighting and relatable scenarios." },
      Luxury: { prefix: "An elegant, luxury", details: "High-end luxury aesthetic with refined visuals and sophisticated color grading." },
      "Stop Motion": { prefix: "A charming stop-motion animation style", details: "Tactile stop-motion aesthetic with creative transitions." },
      "3D Animation": { prefix: "A polished 3D animated", details: "High-quality 3D CGI animation with realistic textures." },
      "Motion Graphics": { prefix: "A sleek motion graphics", details: "Professional motion graphics with clean transitions and dynamic typography." },
      "Bold & Energetic": { prefix: "A bold, high-energy", details: "Dynamic, fast-paced visuals with punchy edits and vibrant colors." },
    };
    const styleConfig = styleDescriptions[style] || { prefix: "A professional", details: "" };

    const baseUserPrompt = final_video_prompt || prompt;
    if (!baseUserPrompt) {
      return res.status(400).json({ ok: false, error: "Either 'prompt' or 'final_video_prompt' is required" });
    }

    // Split voiceover into two halves so each clip gets only its portion
    let voiceoverPart1 = voiceover_script || "";
    let voiceoverPart2 = "";
    if (voiceover_script && segments === 2) {
      const sentences = voiceover_script
        .split(/(?<=[.!?।])\s+/)
        .map((s: string) => s.trim())
        .filter(Boolean);

      if (sentences.length >= 2) {
        const midIdx = Math.ceil(sentences.length / 2);
        voiceoverPart1 = sentences.slice(0, midIdx).join(" ");
        voiceoverPart2 = sentences.slice(midIdx).join(" ");
      } else {
        // Single sentence — give it to Part 1, Part 2 gets a continuation cue
        voiceoverPart1 = voiceover_script;
        voiceoverPart2 = "";
      }
      console.log(`🎙️ Voiceover split: Part1 ${voiceoverPart1.length} chars, Part2 ${voiceoverPart2.length} chars`);
    }

    const buildClipHeader = (clipVoiceover: string) =>
      `${styleConfig.prefix} ${requestedDuration}-second commercial video ad for ${brand_name || "the brand"} featuring ${product_name || "the product"}.

${styleConfig.details}

Aspect ratio: ${videoAspectRatio}
${clipVoiceover ? `Voiceover for this clip: "${clipVoiceover}"` : "No voiceover for this clip - use music/sound effects."}
${headline ? `Display headline: "${headline}"` : ""}
${subtext ? `Display subtext: "${subtext}"` : ""}
`;

    const referenceBlock =
      baseReferenceImages.length > 0
        ? `CRITICAL — REFERENCE IMAGES: The attached reference images show the EXACT product (and/or logo). You MUST depict this product precisely: same appearance, design, colors, packaging, and branding. Do not redesign, reimagine, or alter the product.`
        : `Create visuals based on the description above.`;

    const safetyBlock = `SAFETY CONSTRAINT: This is a professional brand advertisement. All people must be fully clothed in appropriate attire. Absolutely no nudity, partial nudity, or revealing clothing. Keep all content safe for work and family-friendly.`;

    const clip1Prompt = `${buildClipHeader(voiceoverPart1)}
SEGMENT 1 of ${segments} (duration ~${segmentDuration}s):
This is the FIRST HALF of a ${requestedDuration}-second ad. Create the opening — hook, product introduction, and setup.
End with a clear, editable cut point (a resolved action/beat — product hero shot, a pause, or held frame), so the next segment can continue smoothly.
The voiceover above is ONLY for this ${segmentDuration}-second clip. Pace it naturally across the full ${segmentDuration} seconds — do NOT rush or compress it.

${baseUserPrompt}

${realismAndEditSpec}

${referenceBlock}

${safetyBlock}`.trim();

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

      const clip2Prompt = `${buildClipHeader(voiceoverPart2)}
SEGMENT 2 of ${segments} (duration ~${segmentDuration}s):
This is the SECOND HALF of a ${requestedDuration}-second ad. Continue the SAME story from segment 1.
Match lighting, color grade, lens/DOF, location, wardrobe, and product placement EXACTLY. Start with a new camera angle that can match-cut from the end of segment 1.
Cover the demonstration/story payoff, emotional climax, and closing CTA.
${voiceoverPart2 ? `The voiceover above is ONLY for this ${segmentDuration}-second clip. Pace it naturally across the full ${segmentDuration} seconds — do NOT rush, compress, or repeat any voiceover from segment 1.` : "No voiceover for this segment — rely on visuals and music/sound design."}

${baseUserPrompt}

${realismAndEditSpec}

${referenceBlock}

${safetyBlock}`.trim();

      const clip2DataUrl = await generateClipDataUrl({
        ai,
        prompt: clip2Prompt,
        aspectRatio: videoAspectRatio,
        referenceImages: clip2ReferenceImages,
      });
      await writeMp4DataUrlToFile(clip2DataUrl, clip2Path);

      // Stitch (try stream copy concat first; fallback to re-encode concat)
      await fs.writeFile(listPath, `file '${clip1Path}'\nfile '${clip2Path}'\n`);
      try {
        await runFfmpeg(["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath], tmpDir);
      } catch {
        // Fallback: re-encode and concatenate video only (audio may be absent/variable).
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
            outPath,
          ],
          tmpDir
        );
      }

      stitchedDataUrl = await fileToVideoDataUrl(outPath);
    }

    // Cleanup best-effort
    fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});

    return res.status(200).json({
      ok: true,
      videoUrl: stitchedDataUrl,
      duration: segments === 2 ? SEGMENT_SECONDS * 2 : segmentDuration,
      aspectRatio: videoAspectRatio,
      referenceImagesUsed: baseReferenceImages.length,
      model: MODEL,
      segments,
      stitched: segments === 2,
      quality: quality || "standard",
    });
  } catch (error: any) {
    const errorMessage = error?.message || String(error);

    const looksLikeRateLimit =
      /\brate limit\b|rate-limit|too many requests|requests per|RESOURCE_EXHAUSTED/i.test(errorMessage);
    if (isGeminiRateLimitError(error) || errorMessage.includes("quota") || looksLikeRateLimit) {
      return res.status(429).json({
        ok: false,
        error: "API rate limit reached. Please wait a moment and try again.",
        details: errorMessage,
      });
    }

    return res.status(500).json({
      ok: false,
      error: errorMessage || "Failed to generate stitched video",
    });
  }
}

