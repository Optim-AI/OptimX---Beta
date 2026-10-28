/**
 * Nano Banana / Gemini flash-image shared client.
 * Used by Brand Studio posters and commercial keyframe generation.
 */

export {
  getGeminiImageModel,
  getPosterImageModel,
  getPosterImageSize,
  detectImageMimeType,
  getNanoBananaApiKey,
  getNanoBananaApiKeySource,
  normalizeImageForGemini,
  mapToAllowedGeminiAspect,
  commercialAspectToGeminiAspect,
  extractImageFromGeminiResponse,
  dataUrlToBuffer,
  fetchUrlToBuffer,
  fetchUrlToDataUrl,
  isUnsupportedGeminiImageMime,
  generateGeminiImage,
  GEMINI_IMAGE_ALLOWED_ASPECTS,
  GEMINI_IMAGE_SIZES,
  GEMINI_IMAGE_UNSUPPORTED_MIMES,
} from "./client";

export type {
  GeminiImageAspectRatio,
  GeminiImageSize,
  GeminiImageReferencePart,
  GenerateGeminiImageInput,
  GenerateGeminiImageResult,
} from "./client";
