/**
 * Reference-engine fixtures + mock image provider (no live Nano Banana).
 */

import { Buffer } from "node:buffer";
import { makeProtein30sBlueprint } from "../shot-planner/fixtures";
import { makeValidProtein30sShotPlan, makeValid15sShotPlan } from "../shot-planner/fixtures";
import type { CommercialShot } from "../shot-planner/types";
import type {
  AvailableCampaignAssets,
  ImageGenerationProvider,
  ImageGenerationProviderRequest,
  ImageGenerationProviderResult,
} from "./types";

export function makeProductAsset(id = "product-1") {
  return {
    id,
    kind: "product_image" as const,
    url: "https://example.com/product.png",
    mimeType: "image/png",
  };
}

export function makeAvailableAssets(
  overrides: Partial<AvailableCampaignAssets> = {}
): AvailableCampaignAssets {
  return {
    productImages: [makeProductAsset()],
    ...overrides,
  };
}

export class MockImageProvider implements ImageGenerationProvider {
  readonly id = "mock_nano_banana";
  readonly modelId = "mock-gemini-2.5-flash-image";
  calls: ImageGenerationProviderRequest[] = [];

  checkAvailability() {
    return { available: true, message: "mock available" };
  }

  async generateImage(
    request: ImageGenerationProviderRequest
  ): Promise<ImageGenerationProviderResult> {
    this.calls.push(request);
    // 1x1 PNG
    const buffer = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    return {
      buffer,
      dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
      provider: this.id,
      model: this.modelId,
      aspectRatio: "9:16",
      width: 1,
      height: 1,
    };
  }
}

export function getHeroShot(): { blueprint: ReturnType<typeof makeProtein30sBlueprint>; shot: CommercialShot } {
  const blueprint = makeProtein30sBlueprint();
  const plan = makeValidProtein30sShotPlan();
  const shot = plan.shots.find((s) => s.role === "product_hero")!;
  return { blueprint, shot };
}

export function getAtmosphericShot(): {
  blueprint: ReturnType<typeof makeProtein30sBlueprint>;
  shot: CommercialShot;
} {
  const blueprint = makeProtein30sBlueprint();
  const plan = makeValidProtein30sShotPlan();
  const shot = plan.shots.find((s) => s.generationStrategy.id === "text-to-video")!;
  return { blueprint, shot };
}

export function getMotionGraphicsShot(): {
  blueprint: ReturnType<typeof makeProtein30sBlueprint>;
  shot: CommercialShot;
} {
  const blueprint = makeProtein30sBlueprint();
  // 15s plan has end_card motion-graphics
  const plan = makeValid15sShotPlan();
  blueprint.campaignId = plan.campaignId;
  blueprint.campaignDuration = 15;
  const shot = plan.shots.find((s) => s.generationStrategy.id === "motion-graphics")!;
  return { blueprint, shot };
}

export function getPreparingShot(): {
  blueprint: ReturnType<typeof makeProtein30sBlueprint>;
  shot: CommercialShot;
} {
  const blueprint = makeProtein30sBlueprint();
  const plan = makeValidProtein30sShotPlan();
  const shot = plan.shots.find((s) => s.productState?.state === "preparing")!;
  return { blueprint, shot };
}
