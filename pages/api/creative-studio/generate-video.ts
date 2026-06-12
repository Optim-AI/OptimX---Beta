// pages/api/creative-studio/generate-video.ts
// Reference: https://ai.google.dev/gemini-api/docs/video
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import {
  fetchWithGeminiRateLimitRetry,
  isGeminiRateLimitError,
  withRetryOnGeminiRateLimit,
} from "@/lib/gemini-retry";
import {
  buildVeoVideoPrompt,
  normalizeVeoDuration,
} from "@/lib/creative-studio/video-prompt-utils";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
  maxDuration: 300, // 5 minutes max (Vercel hobby plan limit)
};

const GEMINI_VEO_API_KEY = process.env.GEMINI_VEO_API_KEY;

// Parse data URL to get image bytes and mime type
function parseDataUrl(dataUrl: string): { imageBytes: string; mimeType: string } | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], imageBytes: match[2] };
}

// Convert image to JPEG/PNG (Veo requires supported formats - WebP/GIF can fail)
async function convertToSupportedFormat(
  buffer: Buffer,
  inputMime: string
): Promise<{ imageBytes: string; mimeType: string }> {
  const mime = inputMime.toLowerCase().split(";")[0].trim();
  // JPEG and PNG are reliably supported by Veo
  if (mime === "image/jpeg" || mime === "image/png") {
    return { imageBytes: buffer.toString("base64"), mimeType: mime };
  }
  try {
    const sharpInput = mime.includes("svg") ? { density: 144 } : undefined;
    const converted = await sharp(buffer, sharpInput)
      .jpeg({ quality: 92 })
      .toBuffer();
    console.log(`🔄 Converted ${mime} → image/jpeg for Veo compatibility`);
    return { imageBytes: converted.toString("base64"), mimeType: "image/jpeg" };
  } catch (e) {
    console.warn("Sharp conversion failed, passing through:", e);
    return { imageBytes: buffer.toString("base64"), mimeType: mime };
  }
}

// Fetch image from URL and convert to base64 (with format conversion for Veo)
async function fetchImageAsBase64(url: string): Promise<{ imageBytes: string; mimeType: string } | null> {
  try {
    // Skip if it's already a data URL
    if (url.startsWith('data:')) {
      const parsed = parseDataUrl(url);
      if (!parsed) return null;
      const buffer = Buffer.from(parsed.imageBytes, "base64");
      return convertToSupportedFormat(buffer, parsed.mimeType);
    }
    
    // Fetch the image
    const response = await fetch(url, {
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'Mozilla/5.0 (compatible; OptimX-VideoGenerator/1.0)',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch image from URL: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();
    
    // Allow common image types - we'll convert unsupported ones
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(mimeType)) {
      console.warn(`Unsupported image type: ${mimeType}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const result = await convertToSupportedFormat(buffer, mimeType);
    
    if (result.imageBytes.length > 14_000_000) {
      console.warn('Image too large, skipping');
      return null;
    }
    
    console.log(`✅ Fetched image: ${mimeType} → ${result.mimeType}, ${Math.round(result.imageBytes.length / 1024)}KB`);
    return result;
  } catch (error) {
    console.warn(`Error fetching image:`, error);
    return null;
  }
}

// Get image data from URL or data URL (with format conversion for Veo)
async function getImageData(imageSource: string): Promise<{ imageBytes: string; mimeType: string } | null> {
  if (imageSource.startsWith('data:')) {
    const parsed = parseDataUrl(imageSource);
    if (!parsed) return null;
    const buffer = Buffer.from(parsed.imageBytes, "base64");
    return convertToSupportedFormat(buffer, parsed.mimeType);
  }
  if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    return await fetchImageAsBase64(imageSource);
  }
  console.warn('Invalid image source format');
  return null;
}

// Build a single reference image object for Veo 3.1 (referenceImages structure)
// Structure: { image: { imageBytes, mimeType }, referenceType: "asset" }
async function createReferenceAsset(imageSource: string): Promise<{ image: { imageBytes: string; mimeType: string }; referenceType: "asset" } | null> {
  const imageData = await getImageData(imageSource);
  if (!imageData) return null;
  return {
    image: { imageBytes: imageData.imageBytes, mimeType: imageData.mimeType },
    referenceType: "asset",
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  if (!GEMINI_VEO_API_KEY) {
    return res.status(500).json({ ok: false, error: "GEMINI_VEO_API_KEY is not configured" });
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
      storyboard,
    } = req.body;

    console.log('🎬 Video generation request:', {
      hasPrompt: !!prompt,
      hasFinalPrompt: !!final_video_prompt,
      productName: product_name,
      brandName: brand_name,
      style,
      duration,
      aspectRatio: aspect_ratio,
      hasHeroImage: !!hero_image,
      hasBrandLogo: !!brand_logo,
      productImagesCount: product_images?.length || 0,
    });

    // Build reference images array (Veo 3.1: max 3 reference images)
    // Priority: hero_image > brand_logo > product_images
    const MAX_REFERENCE_IMAGES = 3;
    const referenceImagePromises: Promise<{ image: { imageBytes: string; mimeType: string }; referenceType: "asset" } | null>[] = [];
    
    if (hero_image && referenceImagePromises.length < MAX_REFERENCE_IMAGES) {
      console.log('📷 Adding hero image as reference asset...');
      referenceImagePromises.push(createReferenceAsset(hero_image));
    }
    if (brand_logo && referenceImagePromises.length < MAX_REFERENCE_IMAGES) {
      console.log('📷 Adding brand logo as reference asset...');
      referenceImagePromises.push(createReferenceAsset(brand_logo));
    }
    if (product_images && Array.isArray(product_images) && referenceImagePromises.length < MAX_REFERENCE_IMAGES) {
      const slotsLeft = MAX_REFERENCE_IMAGES - referenceImagePromises.length;
      const productImgs = product_images
        .filter((img: string) => img && img !== hero_image && img !== brand_logo)
        .slice(0, slotsLeft);
      for (const img of productImgs) {
        console.log('📷 Adding product image as reference asset...');
        referenceImagePromises.push(createReferenceAsset(img));
      }
    }
    
    const referenceImageResults = await Promise.all(referenceImagePromises);
    let referenceImages = referenceImageResults.filter((r): r is NonNullable<typeof r> => r != null);
    referenceImages = referenceImages.slice(0, MAX_REFERENCE_IMAGES);
    
    if (referenceImages.length > 0) {
      console.log(`✅ ${referenceImages.length} reference image(s) ready — video must depict these exactly`);
    } else {
      console.log('⚠️ No valid reference images — text-to-video mode');
    }

    // Support user's aspect ratio: 9:16 (vertical), 16:9 (landscape), 4:5 (portrait/social)
    const allowedAspectRatios = ["9:16", "16:9", "4:5"];
    let videoAspectRatio = typeof aspect_ratio === "string" ? aspect_ratio.trim() : "9:16";
    if (!allowedAspectRatios.includes(videoAspectRatio)) {
      videoAspectRatio = "9:16";
    }

    const requestedDuration = parseInt(duration) || 8;
    const videoDuration = normalizeVeoDuration(requestedDuration, referenceImages.length > 0);

    if (!final_video_prompt && !prompt) {
      return res.status(400).json({ ok: false, error: "Either 'prompt' or 'final_video_prompt' is required" });
    }

    const videoPrompt = buildVeoVideoPrompt({
      brandName: brand_name,
      productName: product_name,
      style,
      clipDurationSeconds: videoDuration,
      totalDurationSeconds: requestedDuration,
      aspectRatio: videoAspectRatio,
      finalVideoPrompt: final_video_prompt,
      fallbackPrompt: prompt,
      voiceoverScript: voiceover_script,
      storyboard: Array.isArray(storyboard) ? storyboard : undefined,
      hasReferenceImages: referenceImages.length > 0,
      headline,
      subtext,
    });

    console.log('📝 Video prompt length:', videoPrompt.length);
    console.log('🚀 Starting Veo 3.1 video generation...', {
      aspectRatio: videoAspectRatio,
      durationSeconds: videoDuration,
      hasVoiceover: !!voiceover_script,
      storyboardScenes: Array.isArray(storyboard) ? storyboard.length : 0,
      style,
    });

    const generateConfig: any = {
      aspectRatio: videoAspectRatio,
      durationSeconds: videoDuration,
      numberOfVideos: 1,
      safetyFilterLevel: "BLOCK_ONLY_HIGH",
    };
    if (referenceImages.length > 0) {
      generateConfig.referenceImages = referenceImages;
      console.log(`📷 Using ${referenceImages.length} reference image(s) — product must appear exactly as in references`);
    }

    // generateVideos params: model, prompt, config (with referenceImages when provided)
    const generateParams: any = {
      model: "veo-3.1-fast-generate-preview",
      prompt: videoPrompt, 
      config: generateConfig,
    };

    let operation = await withRetryOnGeminiRateLimit(
      () => ai.models.generateVideos(generateParams),
      { maxRetries: 6, operationLabel: "veo-generateVideos" }
    );

    console.log('⏳ Video generation started, polling for completion...');

    // Poll until complete (12s between polls to reduce sustained RPM on operations API)
    const pollIntervalMs = 12_000;
    const maxAttempts = 60;
    let attempts = 0;

    while (!operation.done && attempts < maxAttempts) {
      attempts++;
      console.log(`⏳ Polling attempt ${attempts}/${maxAttempts}...`);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      operation = await withRetryOnGeminiRateLimit(
        () => ai.operations.getVideosOperation({ operation }),
        { maxRetries: 8, operationLabel: "veo-getVideosOperation" }
      );
    }

    if (!operation.done) {
      console.error('❌ Video generation timed out after 10 minutes');
      return res.status(408).json({ ok: false, error: "Video generation timed out. Please try again." });
    }

    if (operation.error) {
      console.error('❌ Video generation operation failed:', JSON.stringify(operation.error));
      const errMsg = (operation.error as any).message || JSON.stringify(operation.error);
      return res.status(500).json({ ok: false, error: `Video generation failed: ${errMsg}` });
    }

    const raiFilteredCount = operation.response?.raiMediaFilteredCount;
    const raiReasons = operation.response?.raiMediaFilteredReasons;

    if (raiFilteredCount && raiFilteredCount > 0) {
      console.error('❌ Video filtered by safety policy:', { raiFilteredCount, raiReasons });
      const reasonDetail = raiReasons?.length ? ` (${raiReasons.join(', ')})` : '';
      return res.status(400).json({
        ok: false,
        error: `Video was blocked by content safety filters${reasonDetail}. Try adjusting your prompt or images to avoid restricted content.`,
      });
    }

    const generatedVideo = operation.response?.generatedVideos?.[0];
    if (!generatedVideo?.video) {
      console.error('❌ No video in response:', JSON.stringify(operation.response).substring(0, 500));
      console.error('❌ Operation metadata:', JSON.stringify(operation.metadata).substring(0, 500));
      return res.status(500).json({
        ok: false,
        error: "Video generation completed but no video was returned. This may be due to content filtering or a temporary API issue. Please try again with a different prompt.",
      });
    }

    console.log('✅ Video generated successfully!');

    // Get video data
    let videoUrl: string;
    if (generatedVideo.video.videoBytes) {
      videoUrl = `data:video/mp4;base64,${generatedVideo.video.videoBytes}`;
      console.log('📹 Video returned as base64 data');
    } else if (generatedVideo.video.uri) {
      console.log('📹 Downloading video from URI...');
      const videoResponse = await fetchWithGeminiRateLimitRetry(
        generatedVideo.video.uri,
        {
          headers: { "x-goog-api-key": GEMINI_VEO_API_KEY },
        },
        { maxRetries: 6, operationLabel: "veo-download-video" }
      );
      if (!videoResponse.ok) {
        console.error('Failed to download video:', videoResponse.status);
        return res.status(500).json({ ok: false, error: "Failed to download generated video" });
      }
      const videoBuffer = await videoResponse.arrayBuffer();
      videoUrl = `data:video/mp4;base64,${Buffer.from(videoBuffer).toString("base64")}`;
      console.log('📹 Video downloaded and converted to base64');
    } else {
      return res.status(500).json({ ok: false, error: "No video data available in response" });
    }

    return res.status(200).json({
      ok: true,
      videoUrl,
      duration: videoDuration,
      aspectRatio: videoAspectRatio,
      referenceImagesUsed: referenceImages.length,
      model: "veo-3.1-fast-generate-preview",
    });
  } catch (error: any) {
    console.error("❌ Video generation error:", error);
    
    const errorMessage = error.message || String(error);
    
    if (errorMessage.includes('image')) {
      return res.status(400).json({
        ok: false,
        error: "Failed to process the image. The image may be in an unsupported format or corrupted. Try using a JPEG or PNG image.",
        details: errorMessage,
      });
    }
    
    const looksLikeRateLimit =
      /\brate limit\b|rate-limit|too many requests|requests per|RESOURCE_EXHAUSTED/i.test(
        errorMessage
      );
    if (isGeminiRateLimitError(error) || errorMessage.includes('quota') || looksLikeRateLimit) {
      return res.status(429).json({
        ok: false,
        error: "too many requests. Please wait a moment and try again.",
        details: errorMessage,
      });
    }
    
    return res.status(500).json({
      ok: false,
      error: errorMessage || "Failed to generate video",
    });
  }
}
