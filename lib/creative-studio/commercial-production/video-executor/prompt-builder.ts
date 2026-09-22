/**
 * Motion-first video prompt builder for Phase 5.
 *
 * Image-to-video: keyframe = WHAT THE WORLD LOOKS LIKE; prompt = HOW IT MOVES.
 * Text-to-video: fuller scene description via DefaultPromptCompiler fields.
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { CommercialShot } from "../shot-planner/types";
import type { VideoGenerationMode } from "../reference-engine/types";
import type { CompiledPrompt } from "../video/prompt/types";
import { defaultPromptCompiler } from "../video/prompt/compiler";
import type { CommercialAspectRatio } from "../campaign/types";

const DEFAULT_NEGATIVE =
  "on-screen text, captions, logo overlays, watermark, distorted product labels, extra limbs, morphing faces, low quality, abrupt identity change";

function joinParts(parts: Array<string | undefined | null | false>): string {
  return parts
    .map((p) => (typeof p === "string" ? p.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .join(". ");
}

function isLockedOff(cameraMovement: string): boolean {
  return /locked[- ]?off|static|still|fixed/i.test(cameraMovement || "");
}

/**
 * Build a CompiledPrompt for video generation from blueprint + shot + mode.
 */
export function buildVideoGenerationPrompt(input: {
  blueprint: CommercialBlueprintCore;
  shot: CommercialShot;
  generationMode: VideoGenerationMode;
}): CompiledPrompt {
  const { blueprint, shot, generationMode } = input;
  const aspectRatio = blueprint.aspectRatio;

  if (generationMode === "image_to_video") {
    return buildMotionFirstPrompt(shot, blueprint, aspectRatio);
  }

  // text_to_video (and any AI video path that needs full scene description)
  return defaultPromptCompiler.compile({
    shot,
    visualTreatment: blueprint.visualTreatment,
    aspectRatio,
    providerId: "runway",
  });
}

function buildMotionFirstPrompt(
  shot: CommercialShot,
  blueprint: CommercialBlueprintCore,
  aspectRatio: CommercialAspectRatio
): CompiledPrompt {
  const vt = blueprint.visualTreatment;
  const locked = isLockedOff(shot.cameraMovement);

  const motion = joinParts([
    locked
      ? `Camera remains ${shot.cameraMovement || "locked-off"}; do not invent a dolly or pan`
      : shot.cameraMovement,
    shot.visualDescription && locked
      ? undefined
      : shot.visualDescription
        ? `Subject/action motion: ${summarizeMotion(shot.visualDescription)}`
        : undefined,
    shot.productState?.description
      ? `Product interaction consistent with state "${shot.productState.state}": ${shot.productState.description}`
      : undefined,
    vt.motionLanguage && !locked ? vt.motionLanguage : undefined,
  ]);

  const camera = joinParts([
    shot.framing,
    shot.lens ? `lens ${shot.lens}` : undefined,
    shot.cameraAngle,
    shot.cameraHeight,
    locked ? "preserve framing from starting frame" : shot.cameraMovement,
  ]);

  const continuity = joinParts([
    "Preserve the composition and visual identity of the supplied starting frame",
    "Preserve product packaging appearance and geometry from the starting frame",
    ...(shot.continuity.mustMatch || []),
    shot.continuity.lock.character,
    shot.continuity.lock.wardrobe,
    shot.continuity.lock.location,
    shot.continuity.lock.lighting,
    shot.continuity.lock.product,
    shot.productState?.transitionsFromShotId
      ? `Continue product state from shot ${shot.productState.transitionsFromShotId}`
      : undefined,
  ]);

  const productRequirements = joinParts([
    `product visibility: ${shot.productVisibility}`,
    shot.productState ? `product state: ${shot.productState.state}` : undefined,
    shot.referenceRequirements.productReferenceRequired
      ? "do not invent alternate packaging"
      : undefined,
  ]);

  const artifactAvoidance = joinParts([
    shot.artifactRisk ? `avoid: ${shot.artifactRisk}` : undefined,
    ...(shot.artifactRisks || []).map((r) => r.mitigation),
  ]);

  const lighting = joinParts([
    "Keep lighting consistent with the starting frame",
    shot.lighting || vt.lighting,
  ]);

  const promptText = joinParts([
    "Preserve the composition and visual identity of the supplied starting frame",
    `Shot purpose: ${shot.shotWhy}`,
    motion ? `Motion: ${motion}` : undefined,
    camera ? `Camera: ${camera}` : undefined,
    lighting,
    productRequirements ? `Product: ${productRequirements}` : undefined,
    continuity ? `Continuity: ${continuity}` : undefined,
    artifactAvoidance ? `Artifact mitigation: ${artifactAvoidance}` : undefined,
    `Aspect ${aspectRatio}`,
    `Duration intent ~${shot.durationSeconds}s`,
  ]);

  return {
    subject: shot.subject,
    action: motion || shot.visualDescription,
    environment: "as established by starting frame",
    composition: "preserve starting-frame composition",
    camera,
    lighting,
    motion: motion || shot.cameraMovement,
    visualTreatment: joinParts([vt.visualStyle, vt.colorLanguage]),
    continuity,
    productRequirements,
    negativeConstraints: DEFAULT_NEGATIVE,
    promptText,
    negativePrompt: DEFAULT_NEGATIVE,
  };
}

/** Prefer temporal verbs; strip lengthy static scene re-description when possible. */
function summarizeMotion(visualDescription: string): string {
  const text = visualDescription.replace(/\s+/g, " ").trim();
  if (text.length <= 220) return text;
  return `${text.slice(0, 217)}...`;
}
