// pages/api/creative-studio/generate-video.ts
// Reference: https://ai.google.dev/gemini-api/docs/video
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { getUserIdFromRequest } from '@/auth/request';
import { CreditsDAO } from '@/database/models/Credits.dao';
import { supabaseAdmin } from '@/auth/supabase/client';

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

// Resolve video to a Buffer (download from URI if needed)
async function videoToBuffer(video: VeoVideo, apiKey: string): Promise<Buffer> {
  if (video.videoBytes) {
    return Buffer.from(video.videoBytes, "base64");
  }
  if (video.uri) {
    const response = await fetch(video.uri, { headers: { "x-goog-api-key": apiKey } });
    if (!response.ok) throw new Error(`Failed to download video: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
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
      error: "Error Contact Support",
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
      "Hook": { prefix: "A performance-first scroll-stopping", details: "Fast cuts, high motion energy, tight framing, strong contrast lighting, immediate visual impact." },
      "Retro": { prefix: "A retro, vintage", details: "Vintage aesthetic with nostalgic 70s/80s influences, grain, and period-appropriate color grading." },
      "Minimalist": { prefix: "A clean, minimalist", details: "Minimal design with simple compositions, ample negative space, and restrained visuals." },
      "Neon": { prefix: "A neon-lit", details: "Neon and glowing visuals with bold colors, cyberpunk or nightlife atmosphere, and high contrast." },
    };

    const isHookMode = style === "Hook";

    if (final_video_prompt && isHookMode) {
      // HOOK MODE: Performance-first, attention warfare. Strict 4-part structure.
      videoPrompt = `HOOK MODE — Performance-first 8-second ad. This is attention warfare, NOT cinematic storytelling.

MANDATORY 4-PART STRUCTURE (follow exactly):
- 0–2s: PATTERN INTERRUPT — Stop scrolling immediately. Bold visual hook. No slow build-ups, no landscape establishing shots, no calm mood builds, no brand logo fade-in first.
- 2–4s: EMOTIONAL TRIGGER — Amplify one of: Pain (problem), Desire (aspiration), Urgency (limited time), or Curiosity (unexpected setup). High emotional tension.
- 4–6s: PRODUCT REVEAL — Product must appear clearly by mid-video. No mysterious slow storytelling. Fast, clear product visibility.
- 6–8s: STRONG CALL-TO-ACTION — Clear visual CTA moment. Drive action.

PACING (Hook dominates tempo):
- Fast cuts, high motion energy, tight framing, strong contrast lighting
- No slow intros, no ambient product spins, no overly abstract visuals
- 100% visual storytelling — NO on-screen text, captions, headlines, subtitles, overlays, or typography
- If voiceover exists, it carries the message; visuals must be self-explanatory

Product: ${product_name || 'the product'}
Brand: ${brand_name || 'the brand'}

${final_video_prompt}

Aspect ratio: ${videoAspectRatio}
${voiceover_script ? `Voiceover: "${voiceover_script}"` : "No voiceover - use music/sound effects."}

CRITICAL — NO ON-SCREEN TEXT: Zero captions, headlines, subtitles, overlays, or typography. Video must be 100% visual.

${reference_images.length > 0 ? `CRITICAL — USE REFERENCE IMAGES PRECISELY: The attached reference images are the source of truth. You MUST use them exactly as provided. The product/hero image(s) must appear in the video with the SAME appearance, design, colors, and packaging. The brand logo must appear EXACTLY as shown. Product must be clearly visible by 4–6 seconds.` : "Create visuals based on the description above. Product must be clearly visible by 4–6 seconds."}`;
    } else if (final_video_prompt) {
      const styleConfig = styleDescriptions[style] || { prefix: "A professional", details: "" };
      
      videoPrompt = `${styleConfig.prefix} ${initialDurationSeconds}-second commercial video ad for ${brand_name || 'the brand'} featuring ${product_name || 'the product'}.

${styleConfig.details}

${final_video_prompt}

Aspect ratio: ${videoAspectRatio}
${voiceover_script ? `Voiceover: "${voiceover_script}"` : "No voiceover - use music/sound effects."}


${reference_images.length > 0 ? `CRITICAL — USE REFERENCE IMAGES PRECISELY: The attached reference images are the source of truth. You MUST use them exactly as provided:
- The product/hero image(s) must appear in the video with the SAME appearance, design, colors, and packaging — do not redesign or alter.
- The brand logo (from brand guidelines) must appear in the video EXACTLY as shown in the reference — same logo asset, no redraw or stylization.
Generate a video ad that features this exact product and brand logo as depicted in the reference images.` : "Create visuals based on the description above."}`;
    } else if (prompt) {
      if (isHookMode) {
        videoPrompt = `HOOK MODE — Performance-first 8-second ad. Attention warfare.

MANDATORY 4-PART STRUCTURE: 0–2s Pattern Interrupt → 2–4s Emotional Trigger → 4–6s Product Reveal → 6–8s Strong CTA.
Fast cuts, high motion, tight framing, strong contrast. NO on-screen text. Product must appear clearly by 4–6s.

${prompt}

CRITICAL — NO ON-SCREEN TEXT: Zero captions, headlines, subtitles, overlays. 100% visual only.

${reference_images.length > 0 ? `CRITICAL — USE REFERENCE IMAGES PRECISELY: Depict the product and brand logo exactly as in the attached reference images. Product must appear by mid-video.` : ''}`;
      } else {
        videoPrompt = `Create a ${initialDurationSeconds}-second video ad (${videoAspectRatio} aspect ratio).

${prompt}

CRITICAL — NO ON-SCREEN TEXT: Do NOT add any text, captions, titles, subtitles, headlines, or text overlays to the video. The video must be purely visual with zero written text displayed.

${reference_images.length > 0 ? `CRITICAL — USE REFERENCE IMAGES PRECISELY: Depict the product and brand logo exactly as in the attached reference images. Same look, design, and branding. Do not redesign or alter. The brand logo must appear exactly as provided.` : ''}`;
      }
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

    let videoBuffer: Buffer;
    try {
      videoBuffer = await videoToBuffer(finalVideo, apiKey);
    } catch (e) {
      console.error('Failed to resolve video:', e);
      return res.status(500).json({ ok: false, error: "No video data available in response" });
    }

    // Upload video to Supabase storage
    let videoUrl: string;
    let videoStoragePath: string | null = null;
    try {
      const storagePath = `generated/${userId}/${Date.now()}_video.mp4`;
      const { error: uploadError } = await supabaseAdmin.storage
        .from("campaign-assets")
        .upload(storagePath, videoBuffer, {
          contentType: "video/mp4",
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        console.warn("Video storage upload failed, falling back to data URL:", uploadError);
        videoUrl = `data:video/mp4;base64,${videoBuffer.toString("base64")}`;
      } else {
        const { data } = supabaseAdmin.storage
          .from("campaign-assets")
          .getPublicUrl(storagePath);
        videoUrl = (data as any)?.publicUrl ?? `data:video/mp4;base64,${videoBuffer.toString("base64")}`;
        videoStoragePath = storagePath;
        console.log('✅ Video uploaded to storage:', storagePath);
      }
    } catch (e) {
      console.warn("Video storage upload error, falling back to data URL:", e);
      videoUrl = `data:video/mp4;base64,${videoBuffer.toString("base64")}`;
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
      videoStoragePath,
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
