// pages/api/creative-studio/generate-video.ts
// Reference: https://ai.google.dev/gemini-api/docs/video
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";
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
  auditVideoPrompt,
  estimateVeoPromptTokens,
  VEO_PROMPT_MAX_TOKENS,
} from "@/lib/creative-studio/video-prompt-utils";
import { resolveVideoDeliveryUrl } from "@/lib/creative-studio/video-delivery";
import {
  resolveRequestFromApiBody,
  resolveVeoPrompt,
} from "@/lib/creative-studio/resolve-veo-prompt";
import { enforceVeoPromptBudget } from "@/lib/creative-studio/video-prompt-utils";
import {
  buildVeoReferenceAssets,
  collectProductReferenceSources,
} from "@/lib/creative-studio/veo-reference-images";
import {
  getVeoApiKey,
  getVeoApiKeySource,
  VEO_API_KEY_SETUP_MESSAGE,
} from "@/lib/gemini-config";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
  maxDuration: 300, // 5 minutes max (Vercel hobby plan limit)
};

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
      veoApiKeySource,
    });

    // Reference order: hero product → additional product photos → logo (max 3). JPEG/PNG passed through unchanged.
    const referenceSources = collectProductReferenceSources({
      hero_image,
      product_images,
      brand_logo,
    });
    const referenceImages = await buildVeoReferenceAssets({
      hero_image,
      product_images,
      brand_logo,
    });

    if (referenceImages.length > 0) {
      console.log(
        `✅ ${referenceImages.length} product reference image(s) ready (unchanged pack fidelity) — order: ${referenceSources.join(" → ").slice(0, 120)}`
      );
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

    const finalizedVoiceover = voiceover_script
      ? finalizeVoiceoverForClip(String(voiceover_script), videoDuration, {
          totalDurationSeconds: requestedDuration,
          brandName: brand_name,
          productName: product_name,
          keyMessage: key_message,
          cta: cta || creative_strategy?.cta,
          creativeStrategy: creative_strategy,
          userDescription: user_description,
        })
      : "";
    if (finalizedVoiceover) {
      const voBudget = computeVoiceoverBudget(videoDuration);
      console.log(
        `🎙️ Voiceover finalized: ${finalizedVoiceover.split(/\s+/).length} words (${voBudget.minWords}–${voBudget.maxWords} target, finish by ${voBudget.finishBySecond}s / ${videoDuration}s clip)`
      );
    }

    const resolved = resolveVeoPrompt(
      resolveRequestFromApiBody(req.body, {
        clipDurationSeconds: videoDuration,
        totalDurationSeconds: requestedDuration,
        aspectRatio: videoAspectRatio,
        hasReferenceImages: referenceImages.length > 0,
        voiceoverScript: finalizedVoiceover || voiceover_script,
      })
    );
    const rawPrompt = resolved.prompt;
    const videoPrompt = enforceVeoPromptBudget(rawPrompt);

    if (resolved.source === "film-engine") {
      console.log("🎛️ Film Engine v2:", resolved.filmSummary);
      console.log("🎛️ Using Film Engine prompt (~", resolved.estimatedTokens, "tokens)");
    }

    const promptAudit = auditVideoPrompt(videoPrompt);
    const promptTokens = estimateVeoPromptTokens(videoPrompt);
    const rawTokens = estimateVeoPromptTokens(rawPrompt);
    if (rawTokens > VEO_PROMPT_MAX_TOKENS) {
      console.warn(
        `📝 Prompt compressed for Veo: ~${rawTokens} → ~${promptTokens} tokens (max ${VEO_PROMPT_MAX_TOKENS})`
      );
    }
    console.log('📝 Video prompt length:', videoPrompt.length, 'chars, ~', promptTokens, 'tokens (max', VEO_PROMPT_MAX_TOKENS + ')');
    console.log('📝 Prompt audit score:', promptAudit.score, promptAudit.issues.length ? promptAudit.issues : 'ok');
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
      ...buildVeoGenerateSafetyConfig(),
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

    console.log('⏳ Video generation started, polling for completion...', {
      operationName: operation?.name || "(missing)",
      veoApiKeySource,
    });

    // Poll until complete (12s between polls to reduce sustained RPM on operations API)
    const pollIntervalMs = 12_000;
    const maxAttempts = 60;
    let attempts = 0;

    while (!operation.done && attempts < maxAttempts) {
      attempts++;
      console.log(`⏳ Polling attempt ${attempts}/${maxAttempts}...`);
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      try {
        operation = await withRetryOnGeminiRateLimit(
          () => ai.operations.getVideosOperation({ operation }),
          { maxRetries: 8, operationLabel: "veo-getVideosOperation" }
        );
      } catch (pollError: any) {
        console.error("❌ Veo polling failed", {
          operationName: operation?.name || "(missing)",
          veoApiKeySource,
          status: pollError?.status,
          message: pollError?.message || String(pollError),
        });
        throw pollError;
      }
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
          headers: { "x-goog-api-key": veoApiKey },
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

    const delivery = await resolveVideoDeliveryUrl(videoUrl);
    console.log(`📹 Delivery: ${delivery.delivery}, ${Math.round(delivery.bytes / 1024)}KB`);

    return res.status(200).json({
      ok: true,
      videoUrl: delivery.videoUrl,
      delivery: delivery.delivery,
      videoBytes: delivery.bytes,
      duration: videoDuration,
      aspectRatio: videoAspectRatio,
      referenceImagesUsed: referenceImages.length,
      model: "veo-3.1-fast-generate-preview",
    });
  } catch (error: any) {
    console.error("❌ Video generation error:", error);
    
    const errorMessage = error.message || String(error);
    
    if (errorMessage.includes('exceeds the length limit') || errorMessage.includes('INVALID_ARGUMENT')) {
      return res.status(400).json({
        ok: false,
        error: `Video prompt exceeded Veo's length limit (max ~${VEO_PROMPT_MAX_TOKENS} tokens). The prompt was auto-compressed — please regenerate the script or try again.`,
        details: errorMessage.slice(0, 200),
      });
    }

    if (errorMessage.includes('image')) {
      return res.status(400).json({
        ok: false,
        error: "Failed to process the image. The image may be in an unsupported format or corrupted. Try using a JPEG or PNG image.",
        details: errorMessage,
      });
    }
    
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
      /\brate limit\b|rate-limit|too many requests|requests per|RESOURCE_EXHAUSTED/i.test(
        errorMessage
      );
    if (isGeminiRateLimitError(error) || errorMessage.includes('quota') || looksLikeRateLimit) {
      return res.status(429).json({
        ok: false,
        error: "Veo rate limit hit. Please wait a minute and try again.",
        details: errorMessage,
      });
    }
    
    return res.status(500).json({
      ok: false,
      error: errorMessage || "Failed to generate video",
    });
  }
}
