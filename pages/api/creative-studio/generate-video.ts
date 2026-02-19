// pages/api/creative-studio/generate-video.ts
// Reference: https://ai.google.dev/gemini-api/docs/video
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { getUserIdFromRequest } from '@/auth/request';
import { CreditsDAO } from '@/database/models/Credits.dao';

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
  maxDuration: 300, // 5 minutes max (Vercel hobby plan limit)
};

// Read at request time (not module load) — fixes production env loading in Vercel/serverless
function getGeminiVeoApiKey(): string | undefined {
  return process.env.GEMINI_VEO_API_KEY || process.env.GEMINI_API_KEY;
}

// Parse data URL to get image bytes and mime type
function parseDataUrl(dataUrl: string): { imageBytes: string; mimeType: string } | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], imageBytes: match[2] };
}

// Convert any image buffer to JPEG (for consistent API input)
async function convertToJpeg(
  buffer: Buffer
): Promise<{ imageBytes: string; mimeType: string } | null> {
  try {
    const converted = await sharp(buffer)
      .jpeg({ quality: 90 })
      .toBuffer();
    return {
      imageBytes: converted.toString("base64"),
      mimeType: "image/jpeg",
    };
  } catch (error) {
    console.warn("Error converting image to JPEG:", error);
    return null;
  }
}

// Fetch image from URL and convert to JPEG
async function fetchImageAsBase64(
  url: string
): Promise<{ imageBytes: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch image: ${response.status}`);
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return await convertToJpeg(buffer);
  } catch (error) {
    console.warn("Error fetching image:", error);
    return null;
  }
}

// Get image data from URL or data URL — always normalized to JPEG before sending to API
async function getImageData(imageSource: string): Promise<{ imageBytes: string; mimeType: string } | null> {
  let buffer: Buffer | null = null;

  if (imageSource.startsWith("data:")) {
    const parsed = parseDataUrl(imageSource);
    if (!parsed) return null;
    try {
      buffer = Buffer.from(parsed.imageBytes, "base64");
    } catch {
      return null;
    }
  } else if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
    try {
      const response = await fetch(imageSource);
      if (!response.ok) return null;
      buffer = Buffer.from(await response.arrayBuffer());
    } catch {
      return null;
    }
  } else {
    console.warn("Invalid image source format");
    return null;
  }

  if (!buffer) return null;
  return await convertToJpeg(buffer);
}

// Veo 3.1 reference image structure (mirrors Python types.VideoGenerationReferenceImage)
type VideoGenerationReferenceImage = {
  image: { imageBytes: string; mimeType: string };
  referenceType: "asset";
};

// Build a single reference image object for Veo 3.1
async function createReferenceAsset(imageSource: string): Promise<VideoGenerationReferenceImage | null> {
  const imageData = await getImageData(imageSource);
  if (!imageData) return null;
  return {
    image: { imageBytes: imageData.imageBytes, mimeType: imageData.mimeType },
    referenceType: "asset",
  };
}

// Video shape from Veo API (videoBytes or uri)
type VeoVideo = { videoBytes?: string; uri?: string; mimeType?: string };

// Poll a generateVideos operation until done; return the first generated video or null
async function pollVideoOperation(
  ai: InstanceType<typeof GoogleGenAI>,
  operation: Awaited<ReturnType<InstanceType<typeof GoogleGenAI>["models"]["generateVideos"]>>,
  maxAttempts = 60,
  intervalMs = 10000
): Promise<VeoVideo | null> {
  let current = operation;
  let attempts = 0;
  while (!current.done && attempts < maxAttempts) {
    attempts++;
    console.log(`⏳ Polling attempt ${attempts}/${maxAttempts}...`);
    await new Promise((r) => setTimeout(r, intervalMs));
    current = await ai.operations.getVideosOperation({ operation: current });
  }
  if (!current.done) return null;
  const generated = current.response?.generatedVideos?.[0];
  const raw = generated?.video;
  if (!raw) return null;
  return raw as VeoVideo;
}

// Resolve video to base64 data URL (download from URI if needed)
async function videoToDataUrl(video: VeoVideo, apiKey: string): Promise<string> {
  if (video.videoBytes) {
    return `data:video/mp4;base64,${video.videoBytes}`;
  }
  if (video.uri) {
    const response = await fetch(video.uri, { headers: { "x-goog-api-key": apiKey } });
    if (!response.ok) throw new Error(`Failed to download video: ${response.status}`);
    const buffer = await response.arrayBuffer();
    return `data:video/mp4;base64,${Buffer.from(buffer).toString("base64")}`;
  }
  throw new Error("No video data in response");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const apiKey = getGeminiVeoApiKey();
  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: "GEMINI_VEO_API_KEY is not configured. Add GEMINI_VEO_API_KEY (or GEMINI_API_KEY) in your host's Environment Variables (e.g. Vercel → Settings → Environment Variables), ensure it's enabled for Production, then redeploy.",
    });
  }

  try {
    // Authenticate user and check credits
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'Unauthorized - no valid session' });
    }

    const balance = await CreditsDAO.getFullBalance(userId);
    const videoTotal = (balance?.videoCredits?.subscription ?? 0) + (balance?.videoCredits?.addon ?? 0);
    if (videoTotal <= 0) {
      return res.status(402).json({ ok: false, error: 'Insufficient video credits. Please purchase more credits.' });
    }

    const ai = new GoogleGenAI({ apiKey });
    
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
      text_style,
      text_position,
      align_brand,
      product_images,
      brand_logo,
      hero_image,
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

    // Reference images for Veo 3.1 (structure mirrors Python VideoGenerationReferenceImage + GenerateVideosConfig.reference_images)
    let hero_reference: VideoGenerationReferenceImage | null = null;
    let brand_logo_reference: VideoGenerationReferenceImage | null = null;
    const product_references: (VideoGenerationReferenceImage | null)[] = [];

    if (hero_image) {
      console.log('📷 Adding hero/product image as reference asset (must appear precisely in video)...');
      hero_reference = await createReferenceAsset(hero_image);
    }
    if (brand_logo) {
      console.log('📷 Adding brand guideline logo as reference asset (use exactly as provided)...');
      brand_logo_reference = await createReferenceAsset(brand_logo);
    }
    if (product_images && Array.isArray(product_images)) {
      for (const img of product_images.slice(0, 3)) {
        if (img && img !== hero_image && img !== brand_logo) {
          console.log('📷 Adding product image as reference asset...');
          product_references.push(await createReferenceAsset(img));
        }
      }
    }

    const reference_images: VideoGenerationReferenceImage[] = [
      hero_reference,
      brand_logo_reference,
      ...product_references,
    ].filter((r): r is VideoGenerationReferenceImage => r != null).slice(0, 3);

    if (reference_images.length > 0) {
      console.log(`✅ ${reference_images.length} reference image(s) ready — video must depict these exactly`);
    } else {
      console.log('⚠️ No valid reference images — text-to-video mode');
    }

    let videoPrompt: string;
    // Standard duration: 8 seconds only
    const initialDurationSeconds = 8;
    // User's aspect ratio for all modes: 4:5, 16:9, 9:16
    const allowedAspectRatios = ["9:16", "16:9", "4:5"];
    let videoAspectRatio = typeof aspect_ratio === "string" ? aspect_ratio.trim() : "9:16";
    if (!allowedAspectRatios.includes(videoAspectRatio)) {
      videoAspectRatio = "9:16";
    }

    const styleDescriptions: Record<string, { prefix: string; details: string }> = {
      "Cinematic": { prefix: "A cinematic, high-production", details: "Film-quality cinematography with dramatic lighting and smooth camera movements." },
      "Product Close-up": { prefix: "A premium product showcase", details: "Macro-level product cinematography with shallow depth of field, highlighting product details." },
      "Lifestyle": { prefix: "A lifestyle-focused", details: "Authentic lifestyle footage with natural lighting and relatable scenarios." },
      "Luxury": { prefix: "An elegant, luxury", details: "High-end luxury aesthetic with refined visuals and sophisticated color grading." },
      "Stop Motion": { prefix: "A charming stop-motion animation style", details: "Tactile stop-motion aesthetic with creative transitions." },
      "3D Animation": { prefix: "A polished 3D animated", details: "High-quality 3D CGI animation with realistic textures." },
      "2D Animation": { prefix: "A polished 2D animated", details: "Flat, illustrated 2D animation with clean lines and expressive character." },
      "Motion Graphics": { prefix: "A sleek motion graphics", details: "Professional motion graphics with clean transitions and dynamic typography." },
      "Bold & Energetic": { prefix: "A bold, high-energy", details: "Dynamic, fast-paced visuals with punchy edits and vibrant colors." },
      "Whimsical": { prefix: "A whimsical, playful", details: "Playful, fantasy-inspired visuals with soft colors and charming, imaginative style." },
      "Retro": { prefix: "A retro, vintage", details: "Vintage aesthetic with nostalgic 70s/80s influences, grain, and period-appropriate color grading." },
      "Minimalist": { prefix: "A clean, minimalist", details: "Minimal design with simple compositions, ample negative space, and restrained visuals." },
      "Neon": { prefix: "A neon-lit", details: "Neon and glowing visuals with bold colors, cyberpunk or nightlife atmosphere, and high contrast." },
    };

    // Text style and position for on-screen text (readability, accessibility, branding)
    const textStyle = typeof text_style === "string" ? text_style : "animated_effects";
    const textPosition = typeof text_position === "string" ? text_position : "lower_third";
    const useBrandAlignment = align_brand === true || align_brand === "true";

    const textStyleInstructions: Record<string, string> = {
      kinetic: "Use KINETIC TYPOGRAPHY: dynamic, moving text that adds energy. Text should animate with motion—scaling, tracking, or moving in sync with the beat or message.",
      animated_titles: "Use ANIMATED TITLES: typewriter effect, glitch, or bouncing so the text stands out. Choose one style (e.g. typewriter reveal, subtle glitch, or bounce-in) and apply it clearly.",
      subtitles_captions: "Use SUBTITLES/CAPTIONS style: karaoke-style word-by-word or phrase highlighting for accessibility. Clear, readable captions that sync with speech or key moments; high contrast so they are always legible.",
      specialized: "Use SPECIALIZED text style: meme-style bold text, testimonial quote styling, or countdown numbers—whichever fits the message. Make it distinctive and on-brand.",
      animated_effects: "Use ANIMATED EFFECTS: fade-in, drop-in, or sliding text entrances. Text should appear with a clear motion (fade, drop from top, or slide from side) and remain readable.",
    };
    const textPositionInstructions: Record<string, string> = {
      lower_third: "POSITION: Place text in the LOWER THIRD of the frame so it does not obstruct key visuals. Keep within safe margins.",
      center: "POSITION: Place text prominently in the CENTER of the frame. Ensure it does not fully obscure the main subject.",
      top_third: "POSITION: Place text in the TOP THIRD of the frame. Keep within safe margins and avoid overlapping critical action.",
      full_width: "POSITION: Use a full-width caption bar or banner style (e.g. bottom or top bar) so text is clearly separated from the main image.",
    };

    const hasOnScreenText = !!(headline || subtext);
    const onScreenTextBlock = hasOnScreenText
      ? `
ON-SCREEN TEXT (CRITICAL — follow exactly):

- SPELLING: Display the headline and subtext EXACTLY as written. Do not change, paraphrase, or introduce spelling or typo errors. Copy character-for-character. No misspellings.

- TEXT INTEGRITY — DO NOT: Use distorted letters, warped text, stretched or bent typography, broken or fragmented letters, extra characters, random symbols, or gibberish. Every character must be clean, legible, and exactly as provided. Typography must be crisp and correct with no visual distortion.

- STYLE: ${textStyleInstructions[textStyle] ?? textStyleInstructions.animated_effects}

- ${textPositionInstructions[textPosition] ?? textPositionInstructions.lower_third}

- READABILITY & CONTRAST: Use high-contrast colors (e.g. white text on dark semi-transparent overlay, or dark bold text on light overlay). Use clear, bold Sans Serif typography so text is always visible and readable. Ensure text remains on screen long enough to be read comfortably (at least 2–3 seconds for short lines, longer for full sentences).

${useBrandAlignment && brand_name ? "- BRANDING: Align font weight and color with a professional, consistent look suitable for " + brand_name + ". Keep typography and colors cohesive with the ad." : ""}

${headline ? `Headline (display exactly): "${headline}"` : ""}
${subtext ? `Subtext (display exactly): "${subtext}"` : ""}
`
      : "";

    if (final_video_prompt) {
      const styleConfig = styleDescriptions[style] || { prefix: "A professional", details: "" };
      
      videoPrompt = `${styleConfig.prefix} ${initialDurationSeconds}-second commercial video ad for ${brand_name || 'the brand'} featuring ${product_name || 'the product'}.

${styleConfig.details}

${final_video_prompt}

Aspect ratio: ${videoAspectRatio}
${voiceover_script ? `Voiceover: "${voiceover_script}"` : "No voiceover - use music/sound effects."}
${onScreenTextBlock}

${reference_images.length > 0 ? `CRITICAL — USE REFERENCE IMAGES PRECISELY: The attached reference images are the source of truth. You MUST use them exactly as provided:
- The product/hero image(s) must appear in the video with the SAME appearance, design, colors, and packaging — do not redesign or alter.
- The brand logo (from brand guidelines) must appear in the video EXACTLY as shown in the reference — same logo asset, no redraw or stylization.
Generate a video ad that features this exact product and brand logo as depicted in the reference images.` : "Create visuals based on the description above."}`;
    } else if (prompt) {
      videoPrompt = `Create a ${initialDurationSeconds}-second video ad (${videoAspectRatio} aspect ratio).

${prompt}
${onScreenTextBlock}

${reference_images.length > 0 ? `CRITICAL — USE REFERENCE IMAGES PRECISELY: Depict the product and brand logo exactly as in the attached reference images. Same look, design, and branding. Do not redesign or alter. The brand logo must appear exactly as provided.` : ''}`;
    } else {
      return res.status(400).json({ ok: false, error: "Either 'prompt' or 'final_video_prompt' is required" });
    }

    console.log('📝 Video prompt length:', videoPrompt.length);
    console.log('🚀 Starting Veo 3.1 video generation...', { aspectRatio: videoAspectRatio, durationSeconds: initialDurationSeconds });

    // Config: user's aspect ratio (4:5, 16:9, 9:16), duration per selection, resolution 720p
    const generateConfig: any = {
      aspectRatio: videoAspectRatio,
      resolution: "720p",
      numberOfVideos: 1,
      durationSeconds: initialDurationSeconds,
    };
    if (reference_images.length > 0) {
      generateConfig.referenceImages = reference_images;
      console.log(`📷 Using ${reference_images.length} reference image(s) — product must appear exactly as in references`);
    }

    // generateVideos: model, prompt, config (reference_images passed as referenceImages in config)
    const generateParams: any = {
      model: "veo-3.1-fast-generate-preview",
      prompt: videoPrompt,
      config: generateConfig,
    };

    let operation = await ai.models.generateVideos(generateParams);

    console.log('⏳ Video generation started, polling for completion...');
    let videoResult = await pollVideoOperation(ai, operation);
    if (!videoResult) {
      console.error('❌ Video generation timed out');
      return res.status(408).json({ ok: false, error: "Video generation timed out. Please try again." });
    }

    const finalVideo = videoResult;
    console.log('✅ Video generated successfully!');

    let videoUrl: string;
    try {
      videoUrl = await videoToDataUrl(finalVideo, apiKey);
    } catch (e) {
      console.error('Failed to resolve video:', e);
      return res.status(500).json({ ok: false, error: "No video data available in response" });
    }

    // Deduct video credits after successful generation
    try {
      await CreditsDAO.deductVideoCredits(userId, initialDurationSeconds);
      console.log(`✅ Deducted ${initialDurationSeconds}s video credits for user ${userId}`);
    } catch (creditError) {
      console.error(`⚠ Failed to deduct video credits for user ${userId}:`, creditError);
      // Don't fail the response - video was already generated
    }

    // Get updated balance to return
    const updatedBalance = await CreditsDAO.getFullBalance(userId);
    const updatedVideoTotal = (updatedBalance?.videoCredits?.subscription ?? 0) + (updatedBalance?.videoCredits?.addon ?? 0);

    return res.status(200).json({
      ok: true,
      videoUrl,
      duration: initialDurationSeconds,
      aspectRatio: videoAspectRatio,
      referenceImagesUsed: reference_images.length,
      model: "veo-3.1-fast-generate-preview",
      creditsRemaining: updatedVideoTotal,
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
    
    const isQuotaOrRate = errorMessage.includes('quota') || errorMessage.includes('rate') || errorMessage.includes('RESOURCE_EXHAUSTED') || error?.status === 429;
    if (isQuotaOrRate) {
      return res.status(429).json({
        ok: false,
        error: "Video API quota or rate limit reached. Please check your plan and billing, or reachout to support.",
        details: errorMessage,
      });
    }
    
    return res.status(500).json({
      ok: false,
      error: errorMessage || "Failed to generate video",
    });
  }
}
