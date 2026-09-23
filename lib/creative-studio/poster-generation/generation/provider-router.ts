/**
 * Provider router — Phase 6.
 * Application depends on ImageGenerationProvider, not Nano Banana directly.
 */

import type { ImageGenerationProvider } from "../types";
import { createNanoBananaImageProvider } from "./nano-banana-provider";

export type PosterImageProviderId = "nano_banana";

export function createPosterImageProvider(
  id: PosterImageProviderId = "nano_banana"
): ImageGenerationProvider {
  switch (id) {
    case "nano_banana":
      return createNanoBananaImageProvider();
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown poster image provider: ${_exhaustive}`);
    }
  }
}

export function getDefaultPosterImageProvider(): ImageGenerationProvider {
  return createPosterImageProvider("nano_banana");
}
