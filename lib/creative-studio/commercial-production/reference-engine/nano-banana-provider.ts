/**
 * NanoBananaProvider — thin adapter over shared lib/creative-studio/nano-banana.
 * Does not duplicate API key, HTTP, retry, or image extraction logic.
 */

import {
  generateGeminiImage,
  getGeminiImageModel,
  getNanoBananaApiKey,
  getNanoBananaApiKeySource,
  type GeminiImageReferencePart,
} from "@/lib/creative-studio/nano-banana";
import type {
  ImageGenerationProvider,
  ImageGenerationProviderRequest,
  ImageGenerationProviderResult,
} from "./types";
import { ReferenceEngineError } from "./types";

export class NanoBananaProvider implements ImageGenerationProvider {
  readonly id = "nano_banana";

  get modelId(): string {
    return getGeminiImageModel();
  }

  checkAvailability(): { available: boolean; message: string } {
    const key = getNanoBananaApiKey();
    if (!key) {
      return {
        available: false,
        message:
          "Set NANO_API_KEY or GEMINI_API_KEY for Nano Banana (gemini-2.5-flash-image) keyframe generation.",
      };
    }
    return {
      available: true,
      message: `Nano Banana ready via ${getNanoBananaApiKeySource()} model=${this.modelId}`,
    };
  }

  async generateImage(
    request: ImageGenerationProviderRequest
  ): Promise<ImageGenerationProviderResult> {
    const availability = this.checkAvailability();
    if (!availability.available) {
      throw new ReferenceEngineError("PROVIDER_UNAVAILABLE", availability.message);
    }

    const references: GeminiImageReferencePart[] = [];
    for (const ref of request.referenceImages || []) {
      const source = ref.dataUrl || ref.url;
      if (!source) continue;
      references.push({
        dataUrlOrHttp: source,
        instruction: ref.instruction,
      });
    }

    const prompt = request.negativePrompt
      ? `${request.prompt}\n\nAvoid: ${request.negativePrompt}`
      : request.prompt;

    try {
      const result = await generateGeminiImage({
        prompt,
        aspectRatio: request.aspectRatio,
        references,
        operationLabel: `commercial-keyframe:${request.shotId}:a${request.metadata.attempt}`,
        maxRetries: 4,
      });

      return {
        buffer: result.buffer,
        dataUrl: result.dataUrl,
        provider: result.provider,
        model: result.model,
        aspectRatio: result.aspectRatio,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/429|rate limit|RESOURCE_EXHAUSTED/i.test(msg)) {
        throw new ReferenceEngineError("RATE_LIMITED", msg);
      }
      throw new ReferenceEngineError("IMAGE_GENERATION_FAILED", msg);
    }
  }
}

export function createNanoBananaProvider(): ImageGenerationProvider {
  return new NanoBananaProvider();
}
