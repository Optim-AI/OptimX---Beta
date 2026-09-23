/**
 * Nano Banana ImageGenerationProvider — Phase 6.
 * Wraps existing lib/creative-studio/nano-banana transport. No Gemini HTTP duplication.
 */

import {
  generateGeminiImage,
  getNanoBananaApiKey,
  getNanoBananaApiKeySource,
  getPosterImageModel,
} from "@/lib/creative-studio/nano-banana";
import type {
  ImageGenerationProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  ImageProviderCapabilities,
  PosterAspectRatio,
} from "../types";
import { POSTER_ASPECT_RATIOS } from "../types";
import { compileNanoBananaPrompt } from "./nano-banana-prompt";

const CREDITS_PER_IMAGE = 1;

export class NanoBananaImageProvider implements ImageGenerationProvider {
  readonly id = "nano_banana";

  get modelId(): string {
    return getPosterImageModel();
  }

  getCapabilities(): ImageProviderCapabilities {
    return {
      supportsGenerate: true,
      supportsEdit: false,
      supportedAspectRatios: [...POSTER_ASPECT_RATIOS],
      maxReferenceImages: 4,
      supportsReferenceImages: true,
      supportsInpainting: false,
    };
  }

  async checkAvailability(): Promise<{ available: boolean; reason?: string }> {
    const key = getNanoBananaApiKey();
    if (!key) {
      return {
        available: false,
        reason:
          "Set NANO_API_KEY or GEMINI_API_KEY for Nano Banana poster generation.",
      };
    }
    return {
      available: true,
      reason: `Nano Banana ready via ${getNanoBananaApiKeySource()} model=${this.modelId}`,
    };
  }

  estimateCost(_request: ImageGenerationRequest): number {
    return CREDITS_PER_IMAGE;
  }

  async generate(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    const started = Date.now();
    const availability = await this.checkAvailability();
    if (!availability.available) {
      return {
        ok: false,
        provider: this.id,
        model: this.modelId,
        durationMs: Date.now() - started,
        estimatedCostCredits: 0,
        errorCode: "PROVIDER_UNAVAILABLE",
        errorMessage: availability.reason || "Provider unavailable",
      };
    }

    const prompt =
      request.prompt || compileNanoBananaPrompt(request.specification);

    const incoming = (request.referenceImages || []).filter(
      (r) => r.url || r.base64Data
    );
    const isBasePoster = (r: (typeof incoming)[number]) =>
      /BASE POSTER/i.test(r.label || "") ||
      /PRIMARY EDIT SOURCE|CONTROLLED ITERATION SOURCE/i.test(
        r.instruction || ""
      );

    const max = this.getCapabilities().maxReferenceImages;
    let picked = incoming;

    const bases = incoming.filter(isBasePoster);
    if (bases.length) {
      // Iteration: BASE POSTER first, then product identity, then anything else
      const products = incoming.filter(
        (r) => r.kind === "product" && !isBasePoster(r)
      );
      const others = incoming.filter(
        (r) => r.kind !== "product" && !isBasePoster(r)
      );
      picked = [...bases.slice(0, 1), ...products.slice(0, 1), ...others].slice(
        0,
        max
      );
    } else {
      // Fresh generate: product first
      const products = incoming.filter((r) => r.kind === "product");
      const others = incoming.filter((r) => r.kind !== "product");
      const productTake = Math.min(
        products.length,
        Math.max(1, Math.min(2, max))
      );
      picked = [
        ...products.slice(0, productTake),
        ...others.slice(
          0,
          Math.max(0, max - Math.min(products.length, productTake))
        ),
      ].slice(0, max);
    }

    if (!picked.some((r) => r.kind === "product") && !bases.length) {
      console.warn("[nanoBanana] generating without product reference image", {
        generationId: request.metadata.generationId,
        refKinds: incoming.map((r) => r.kind),
      });
    }

    const references = picked.map((r) => ({
      dataUrlOrHttp: r.base64Data
        ? `data:${r.mimeType};base64,${r.base64Data}`
        : (r.url as string),
      instruction:
        r.instruction ||
        r.label ||
        (r.kind === "product"
          ? "IMAGE ROLE — PRODUCT: Use this exact user-uploaded product. Do not invent packaging."
          : "Reference image."),
    }));

    try {
      const result = await generateGeminiImage({
        prompt,
        aspectRatio: request.aspectRatio,
        references,
        model: this.modelId,
        operationLabel: `poster-gen:${request.metadata.generationId}`,
        maxRetries: 4,
      });

      return {
        ok: true,
        imageDataUrl: result.dataUrl,
        imageBuffer: result.buffer,
        mimeType: "image/png",
        provider: result.provider,
        model: result.model,
        durationMs: Date.now() - started,
        estimatedCostCredits: CREDITS_PER_IMAGE,
        compiledPrompt: prompt,
        rawProviderStatus: "ok",
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      let errorCode = "PROVIDER_FAILED";
      if (/429|rate limit|RESOURCE_EXHAUSTED/i.test(msg)) {
        errorCode = "RATE_LIMITED";
      }
      return {
        ok: false,
        provider: this.id,
        model: this.modelId,
        durationMs: Date.now() - started,
        estimatedCostCredits: 0,
        errorCode,
        errorMessage: msg,
        compiledPrompt: prompt,
        rawProviderStatus: "error",
      };
    }
  }

  async edit(
    _request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    return {
      ok: false,
      provider: this.id,
      model: this.modelId,
      estimatedCostCredits: 0,
      errorCode: "UNSUPPORTED",
      errorMessage: "Edit mode is not implemented in Phase 6",
    };
  }
}

export function createNanoBananaImageProvider(): ImageGenerationProvider {
  return new NanoBananaImageProvider();
}

export function isPosterAspectSupported(aspect: string): aspect is PosterAspectRatio {
  return (POSTER_ASPECT_RATIOS as readonly string[]).includes(aspect);
}
