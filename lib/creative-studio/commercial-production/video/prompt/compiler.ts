/**
 * Provider-agnostic prompt compiler for the Commercial Production Engine.
 *
 * CommercialShot fields → structured CompiledPrompt.
 * Provider adapters then turn CompiledPrompt into vendor-specific text.
 *
 * This is intentionally separate from lib/creative-studio/resolve-veo-prompt.ts
 * and the film-engine Veo renderer (legacy Creative Studio paths).
 */

import type { CommercialShot } from "../../shot-planner/types";
import type { VisualTreatment } from "../../commercial-director/types";
import type {
  CompiledPrompt,
  PromptCompileInput,
  PromptCompiler,
} from "./types";

const DEFAULT_NEGATIVE =
  "on-screen text, captions, logos as overlays, watermark, distorted product labels, extra limbs, morphing faces, low quality";

function joinParts(parts: Array<string | undefined | null>): string {
  return parts
    .map((p) => (p || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(". ");
}

export class DefaultPromptCompiler implements PromptCompiler {
  compile(input: PromptCompileInput): CompiledPrompt {
    const { shot, visualTreatment, aspectRatio } = input;

    const subject = shot.subject;
    const action = shot.visualDescription;
    const environment = shot.environment || visualTreatment.environment;
    const composition = shot.composition;
    const camera = joinParts([
      shot.framing,
      shot.lens ? `lens ${shot.lens}` : visualTreatment.lensLanguage,
      shot.cameraMovement,
      visualTreatment.cameraLanguage,
    ]);
    const lighting = shot.lighting || visualTreatment.lighting;
    const motion = joinParts([shot.cameraMovement, visualTreatment.motionLanguage, visualTreatment.pacing]);
    const treatment = joinParts([
      visualTreatment.visualStyle,
      visualTreatment.colorLanguage,
      visualTreatment.texture,
      visualTreatment.productionDesign,
    ]);
    const continuity = joinParts([
      ...shot.continuity.mustMatch,
      shot.continuity.lock.character,
      shot.continuity.lock.wardrobe,
      shot.continuity.lock.location,
      shot.continuity.lock.lighting,
      shot.continuity.lock.product,
      shot.continuity.lock.visualTreatmentSummary,
    ]);
    const productRequirements = joinParts([
      `product visibility: ${shot.productVisibility}`,
      shot.referenceRequirements.productImages ? "match product reference images exactly" : "",
      shot.artifactRisk ? `avoid: ${shot.artifactRisk}` : "",
    ]);

    const promptText = joinParts([
      `Aspect ${aspectRatio}`,
      `Subject: ${subject}`,
      `Action: ${action}`,
      `Environment: ${environment}`,
      `Composition: ${composition}`,
      `Camera: ${camera}`,
      `Lighting: ${lighting}`,
      `Motion: ${motion}`,
      `Visual treatment: ${treatment}`,
      continuity ? `Continuity: ${continuity}` : "",
      productRequirements ? `Product: ${productRequirements}` : "",
      `Shot purpose: ${shot.shotWhy}`,
      `Story beat: ${shot.storyBeat}`,
    ]);

    return {
      subject,
      action,
      environment,
      composition,
      camera,
      lighting,
      motion,
      visualTreatment: treatment,
      continuity,
      productRequirements,
      negativeConstraints: DEFAULT_NEGATIVE,
      promptText,
      negativePrompt: DEFAULT_NEGATIVE,
    };
  }
}

export const defaultPromptCompiler = new DefaultPromptCompiler();

/**
 * Temporary bridge for the current Brand Studio API body (pre–Shot Planner).
 * Builds a CompiledPrompt without using resolveVeoPrompt / film-engine Veo paths.
 */
export function compilePromptFromLegacyBrief(input: {
  productName?: string;
  brandName?: string;
  category?: string;
  userDescription?: string;
  finalVideoPrompt?: string;
  voiceoverScript?: string;
  aspectRatio: string;
  durationSeconds: number;
  hasReferenceImages: boolean;
  storyboard?: Array<{
    visual_description?: string;
    beat?: string;
    shot_purpose?: string;
  }>;
}): CompiledPrompt {
  const storyboardLines = (input.storyboard || [])
    .map((s, i) => {
      const vis = (s.visual_description || "").trim();
      if (!vis) return "";
      return `Beat ${i + 1}${s.beat ? ` (${s.beat})` : ""}: ${vis}`;
    })
    .filter(Boolean)
    .join(" | ");

  const subject = joinParts([
    input.brandName,
    input.productName,
    input.category ? `${input.category} product` : "",
  ]);

  const action =
    (input.finalVideoPrompt || "").trim() ||
    (input.userDescription || "").trim() ||
    storyboardLines ||
    `Premium ${input.durationSeconds}s commercial featuring ${input.productName || "the product"}`;

  const productRequirements = joinParts([
    input.productName ? `product identity lock: ${input.productName}` : "",
    input.hasReferenceImages ? "match provided product reference images exactly — packaging, label, colors" : "",
    "no on-screen text or logos as overlays",
  ]);

  const promptText = joinParts([
    `Aspect ${input.aspectRatio}`,
    `Duration intent ${input.durationSeconds}s commercial film`,
    `Subject: ${subject || "brand product"}`,
    `Action / treatment: ${action}`,
    productRequirements ? `Product: ${productRequirements}` : "",
    input.voiceoverScript ? `Spoken voiceover (audio only, never on-screen text): ${input.voiceoverScript}` : "",
    "Photorealistic advertising commercial, motivated camera, continuous story",
  ]);

  return {
    subject: subject || "brand product",
    action,
    environment: "",
    composition: "product-hero commercial framing",
    camera: "motivated commercial camera",
    lighting: "premium brand lighting",
    motion: "controlled commercial motion",
    visualTreatment: "premium advertising look",
    continuity: "consistent character, wardrobe, location, product, lighting",
    productRequirements,
    negativeConstraints: DEFAULT_NEGATIVE,
    promptText,
    negativePrompt: DEFAULT_NEGATIVE,
  };
}

/** Re-export type for callers that only need the shot-based compiler. */
export type { CommercialShot, VisualTreatment };
