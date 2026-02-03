// pages/api/creative-studio/generate-video.ts
// Reference: https://ai.google.dev/gemini-api/docs/video
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
  maxDuration: 600, // 10 minutes max
};

const GEMINI_VEO_API_KEY = process.env.GEMINI_VEO_API_KEY;

// Parse data URL to get image bytes and mime type
function parseDataUrl(dataUrl: string): { imageBytes: string; mimeType: string } | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], imageBytes: match[2] };
}

// Fetch image from URL and convert to base64
async function fetchImageAsBase64(url: string): Promise<{ imageBytes: string; mimeType: string } | null> {
  try {
    // Skip if it's already a data URL
    if (url.startsWith('data:')) {
      return parseDataUrl(url);
    }
    
    // Fetch the image
    const response = await fetch(url, {
      headers: {
        'Accept': 'image/*',
        'User-Agent': 'OptimX-VideoGenerator/1.0',
      },
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch image from URL: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim();
    
    // Only allow supported image types
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mimeType)) {
      console.warn(`Unsupported image type: ${mimeType}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const imageBytes = Buffer.from(arrayBuffer).toString('base64');
    
    // Validate the base64 is not too large (max ~10MB decoded)
    if (imageBytes.length > 14_000_000) {
      console.warn('Image too large, skipping');
      return null;
    }
    
    console.log(`✅ Fetched image: ${mimeType}, ${Math.round(imageBytes.length / 1024)}KB`);
    return { imageBytes, mimeType };
  } catch (error) {
    console.warn(`Error fetching image:`, error);
    return null;
  }
}

// Get image data from URL or data URL
async function getImageData(imageSource: string): Promise<{ imageBytes: string; mimeType: string } | null> {
  if (imageSource.startsWith('data:')) {
    return parseDataUrl(imageSource);
  } else if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
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

    // Build reference images array (Veo 3.1 structure: referenceImages with referenceType "asset")
    // These are the EXACT product/images from URL or upload — video must depict them precisely
    const referenceImagePromises: Promise<{ image: { imageBytes: string; mimeType: string }; referenceType: "asset" } | null>[] = [];
    
    if (hero_image) {
      console.log('📷 Adding hero image as reference asset...');
      referenceImagePromises.push(createReferenceAsset(hero_image));
    }
    if (brand_logo) {
      console.log('📷 Adding brand logo as reference asset...');
      referenceImagePromises.push(createReferenceAsset(brand_logo));
    }
    if (product_images && Array.isArray(product_images)) {
      for (const img of product_images.slice(0, 3)) {
        if (img && img !== hero_image && img !== brand_logo) {
          console.log('📷 Adding product image as reference asset...');
          referenceImagePromises.push(createReferenceAsset(img));
        }
      }
    }
    
    const referenceImageResults = await Promise.all(referenceImagePromises);
    const referenceImages = referenceImageResults.filter((r): r is NonNullable<typeof r> => r != null);
    
    if (referenceImages.length > 0) {
      console.log(`✅ ${referenceImages.length} reference image(s) ready — video must depict these exactly`);
    } else {
      console.log('⚠️ No valid reference images — text-to-video mode');
    }

    let videoPrompt: string;
    let videoDuration: number = parseInt(duration) || 6;
    // Support user's aspect ratio: 9:16 (vertical), 16:9 (landscape), 4:5 (portrait/social)
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
      "Motion Graphics": { prefix: "A sleek motion graphics", details: "Professional motion graphics with clean transitions and dynamic typography." },
      "Bold & Energetic": { prefix: "A bold, high-energy", details: "Dynamic, fast-paced visuals with punchy edits and vibrant colors." },
    };

    if (final_video_prompt) {
      const styleConfig = styleDescriptions[style] || { prefix: "A professional", details: "" };
      
      videoPrompt = `${styleConfig.prefix} ${videoDuration}-second commercial video ad for ${brand_name || 'the brand'} featuring ${product_name || 'the product'}.

${styleConfig.details}

${final_video_prompt}

Aspect ratio: ${videoAspectRatio}
${voiceover_script ? `Voiceover: "${voiceover_script}"` : "No voiceover - use music/sound effects."}
${headline ? `Display headline: "${headline}"` : ""}
${subtext ? `Display subtext: "${subtext}"` : ""}

${referenceImages.length > 0 ? `CRITICAL — REFERENCE IMAGES: The attached reference images show the EXACT product (and/or logo) uploaded or fetched by the user. You MUST depict this product precisely in the video: same appearance, design, colors, packaging, and branding. Do not redesign, reimagine, or alter the product. The reference images are the source of truth. Generate a video ad that features this exact product.` : "Create visuals based on the description above."}`;
    } else if (prompt) {
      videoPrompt = `Create a ${videoDuration}-second video ad (${videoAspectRatio} aspect ratio).

${prompt}

${referenceImages.length > 0 ? `CRITICAL: The attached reference images show the EXACT product. Depict it precisely — same look, design, and branding. Do not change or redesign the product. The video ad must feature this exact product as shown in the references.` : ''}`;
    } else {
      return res.status(400).json({ ok: false, error: "Either 'prompt' or 'final_video_prompt' is required" });
    }

    console.log('📝 Video prompt length:', videoPrompt.length);
    console.log('🚀 Starting Veo 3.1 video generation...', { aspectRatio: videoAspectRatio });

    // Config structure per Veo 3.1 reference: aspectRatio, optional referenceImages (each { image, referenceType: "asset" })
    const generateConfig: any = {
      aspectRatio: videoAspectRatio,
      resolution: "720p",
      numberOfVideos: 1,
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

    let operation = await ai.models.generateVideos(generateParams);

    console.log('⏳ Video generation started, polling for completion...');

    // Poll until complete
    const maxAttempts = 60; // 10 minutes max
    let attempts = 0;

    while (!operation.done && attempts < maxAttempts) {
      attempts++;
      console.log(`⏳ Polling attempt ${attempts}/${maxAttempts}...`);
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second intervals
      operation = await ai.operations.getVideosOperation({ operation });
    }

    if (!operation.done) {
      console.error('❌ Video generation timed out after 10 minutes');
      return res.status(408).json({ ok: false, error: "Video generation timed out. Please try again." });
    }

    const generatedVideo = operation.response?.generatedVideos?.[0];
    if (!generatedVideo?.video) {
      console.error('❌ No video in response:', JSON.stringify(operation.response).substring(0, 500));
      return res.status(500).json({ ok: false, error: "Video not found in response" });
    }

    console.log('✅ Video generated successfully!');

    // Get video data
    let videoUrl: string;
    if (generatedVideo.video.videoBytes) {
      videoUrl = `data:video/mp4;base64,${generatedVideo.video.videoBytes}`;
      console.log('📹 Video returned as base64 data');
    } else if (generatedVideo.video.uri) {
      console.log('📹 Downloading video from URI...');
      const videoResponse = await fetch(generatedVideo.video.uri, {
        headers: { "x-goog-api-key": GEMINI_VEO_API_KEY },
      });
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
    
    if (errorMessage.includes('quota') || errorMessage.includes('rate')) {
      return res.status(429).json({
        ok: false,
        error: "API rate limit reached. Please wait a moment and try again.",
        details: errorMessage,
      });
    }
    
    return res.status(500).json({
      ok: false,
      error: errorMessage || "Failed to generate video",
    });
  }
}
