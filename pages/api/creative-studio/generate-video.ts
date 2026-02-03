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

function parseDataUrl(dataUrl: string): { imageBytes: string; mimeType: string } | null {
  if (!dataUrl || typeof dataUrl !== "string") return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], imageBytes: match[2] };
}

function createReferenceImage(dataUrl: string, referenceType: "asset" | "style" = "asset") {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  return {
    image: { imageBytes: parsed.imageBytes, mimeType: parsed.mimeType },
    referenceType,
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

    // Build reference images
    const referenceImages: any[] = [];
    if (hero_image) {
      const ref = createReferenceImage(hero_image, "asset");
      if (ref) referenceImages.push(ref);
    }
    if (brand_logo) {
      const ref = createReferenceImage(brand_logo, "asset");
      if (ref) referenceImages.push(ref);
    }
    if (product_images && Array.isArray(product_images)) {
      for (const imgUrl of product_images) {
        if (referenceImages.length >= 3) break;
        if (imgUrl === hero_image) continue;
        const ref = createReferenceImage(imgUrl, "asset");
        if (ref) referenceImages.push(ref);
      }
    }

    let videoPrompt: string;
    let videoDuration: number = 6;
    let videoAspectRatio = aspect_ratio || "9:16";
    if (!["9:16", "16:9", "4:5"].includes(videoAspectRatio)) {
      videoAspectRatio = "9:16";
    }

    let videoResolution = "720p";
    if (quality === "high" && duration === 8) {
      videoResolution = "1080p";
    }

    const styleDescriptions: Record<string, { prefix: string; details: string }> = {
      "Cinematic": { prefix: "A cinematic, high-production", details: "Film-quality cinematography with dramatic lighting." },
      "Product Close-up": { prefix: "A premium product showcase", details: "Macro-level product cinematography." },
      "Lifestyle": { prefix: "A lifestyle-focused", details: "Authentic lifestyle footage." },
      "Luxury": { prefix: "An elegant, luxury", details: "High-end luxury aesthetic." },
      "Stop Motion": { prefix: "A charming stop-motion animation style", details: "Tactile stop-motion aesthetic." },
      "3D Animation": { prefix: "A polished 3D animated", details: "High-quality 3D CGI animation." },
      "Motion Graphics": { prefix: "A sleek motion graphics", details: "Professional motion graphics." },
      "Bold & Energetic": { prefix: "A bold, high-energy", details: "Dynamic, fast-paced visuals." },
    };

    if (final_video_prompt) {
      videoDuration = duration || 6;
      const styleConfig = styleDescriptions[style] || { prefix: "A professional", details: "" };
      
      videoPrompt = `${styleConfig.prefix} ${videoDuration}-second commercial for ${brand_name} ${product_name}.

${styleConfig.details}

${final_video_prompt}

Aspect ratio: ${videoAspectRatio}
${voiceover_script ? `Voiceover: "${voiceover_script}"` : "No voiceover - music/sound effects only."}
${headline ? `On-screen headline: "${headline}"` : ""}
${subtext ? `Supporting text: "${subtext}"` : ""}`;
    } else if (prompt) {
      videoPrompt = `Create a ${videoDuration}-second video ad (${videoAspectRatio}).
${prompt}`;
    } else {
      return res.status(400).json({ ok: false, error: "Either 'prompt' or structured input is required" });
    }

    console.log('Starting video generation, duration:', videoDuration);

    const needsExtension = videoDuration > 8;
    const baseDuration = needsExtension ? (videoDuration === 10 ? 4 : 8) : videoDuration;
    const sdkAspectRatio = videoAspectRatio === "4:5" ? "9:16" : videoAspectRatio;

    const generateConfig: any = {
      aspectRatio: sdkAspectRatio,
      resolution: needsExtension ? "720p" : videoResolution,
      numberOfVideos: 1,
    };
    
    if (referenceImages.length > 0) {
      generateConfig.referenceImages = referenceImages;
    }

    let operation = await ai.models.generateVideos({
      model: "veo-3.1-fast-generate-preview",
      prompt: videoPrompt,
      config: generateConfig,
    });

    // Poll until complete
    const maxAttempts = 60;
    let attempts = 0;

    while (!operation.done && attempts < maxAttempts) {
      attempts++;
      await new Promise((resolve) => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation });
    }

    if (!operation.done) {
      return res.status(408).json({ ok: false, error: "Video generation timed out." });
    }

    let generatedVideo = operation.response?.generatedVideos?.[0];
    if (!generatedVideo?.video) {
      return res.status(500).json({ ok: false, error: "Video not found in response" });
    }

    // Handle extension for longer videos
    if (needsExtension) {
      const extensionPrompt = `Continue the video seamlessly. Maintain visual style and pacing.`;
      
      try {
        let extensionOperation = await ai.models.generateVideos({
          model: "veo-3.1-generate-preview",
          video: generatedVideo.video,
          prompt: extensionPrompt,
          config: { numberOfVideos: 1, resolution: "720p" },
        });
        
        let extensionAttempts = 0;
        while (!extensionOperation.done && extensionAttempts < maxAttempts) {
          extensionAttempts++;
          await new Promise((resolve) => setTimeout(resolve, 10000));
          extensionOperation = await ai.operations.getVideosOperation({ operation: extensionOperation });
        }
        
        if (extensionOperation.done && extensionOperation.response?.generatedVideos?.[0]?.video) {
          generatedVideo = extensionOperation.response.generatedVideos[0];
        }
      } catch (e) {
        console.warn('Extension failed, using base video');
      }
    }

    // Get video data
    let videoUrl: string;
    if (generatedVideo.video.videoBytes) {
      videoUrl = `data:video/mp4;base64,${generatedVideo.video.videoBytes}`;
    } else if (generatedVideo.video.uri) {
      const videoResponse = await fetch(generatedVideo.video.uri, {
        headers: { "x-goog-api-key": GEMINI_VEO_API_KEY },
      });
      if (!videoResponse.ok) {
        return res.status(500).json({ ok: false, error: "Failed to download video" });
      }
      const videoBuffer = await videoResponse.arrayBuffer();
      videoUrl = `data:video/mp4;base64,${Buffer.from(videoBuffer).toString("base64")}`;
    } else {
      return res.status(500).json({ ok: false, error: "No video data available" });
    }

    return res.status(200).json({
      ok: true,
      videoUrl,
      duration: needsExtension ? baseDuration + 7 : baseDuration,
      requestedDuration: videoDuration,
      aspectRatio: videoAspectRatio,
      wasExtended: needsExtension,
    });
  } catch (error: any) {
    console.error("Video generation error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to generate video",
    });
  }
}
