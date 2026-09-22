/**
 * Build KeyframeSpecification + production-brief prompts from blueprint + shot.
 * Preserves Commercial Director visual DNA — does not invent a new look.
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { CommercialShot } from "../shot-planner/types";
import type { ResolvedReferencePlan } from "./reference-strategy";
import type { KeyframeSpecification, ReferenceAsset } from "./types";

export function buildKeyframeSpecification(input: {
  blueprint: CommercialBlueprintCore;
  shot: CommercialShot;
  plan: ResolvedReferencePlan;
  resolvedReferences: ReferenceAsset[];
}): KeyframeSpecification {
  const { blueprint, shot, plan, resolvedReferences } = input;
  const treatment = blueprint.visualTreatment;
  const productRefs = resolvedReferences.filter((r) => r.type === "product").map((r) => r.assetId);

  const subjects =
    shot.characterContinuity?.map((c) => ({
      description: c.identity,
      wardrobe: c.wardrobe,
    })) || [{ description: shot.subject }];

  const artifactRisks = shot.artifactRisks?.map((r) => r.risk) || [];
  if (shot.artifactRisk) artifactRisks.push(shot.artifactRisk);

  const instructions = (shot.artifactRisks || []).map(
    (r) => `Avoid: ${r.risk}. ${r.mitigation}`
  );

  const compositionParts = shot.composition || "";
  const spec: Omit<KeyframeSpecification, "imageGenerationPrompt" | "negativePrompt"> = {
    campaignId: blueprint.campaignId,
    shotId: shot.id,
    purpose: shot.shotWhy,
    aspectRatio: blueprint.aspectRatio,
    composition: {
      framing: shot.framing,
      subjectPlacement: compositionParts,
      foreground: undefined,
      midground: undefined,
      background: shot.environment,
    },
    camera: {
      shotType: shot.framing,
      lens: shot.lens || treatment.lensLanguage,
      angle: shot.cameraAngle,
      perspective: shot.subjectDistance,
    },
    lighting: {
      style: shot.lighting || treatment.lighting,
    },
    environment: {
      location: shot.environment || treatment.environment,
      setting: treatment.environment,
      atmosphere: treatment.visualStyle,
    },
    subjects,
    product: {
      required: plan.productReferenceRequired,
      visibility: shot.productVisibility,
      placement: shot.productVisibilityReason,
      state: shot.productState?.description || shot.productState?.state,
      interaction: shot.productState?.state,
      referenceAssetIds: productRefs,
    },
    visualTreatment: {
      style: treatment.visualStyle,
      colorLanguage: treatment.colorLanguage,
      texture: treatment.texture,
      depth: treatment.lensLanguage,
    },
    continuity: {
      previousShotIds: shot.continuity.continuesFromShotIds,
      mustMatch: shot.continuity.mustMatch,
      mustMatchDimensions: shot.continuity.mustMatchDimensions || shot.continuityDimensions,
      characterContinuity: shot.characterContinuity
        ?.map((c) => `${c.characterId}: ${c.identity}; match ${c.mustMatch.join(", ")}`)
        .join(" | "),
    },
    artifactAvoidance: {
      risks: [...new Set(artifactRisks.filter(Boolean))],
      instructions,
    },
    resolvedStrategy: plan.strategy,
    shotPlannerStrategyType: shot.referenceRequirements.strategyType,
    generationStrategyId: shot.generationStrategy.id,
  };

  const imageGenerationPrompt = buildKeyframePrompt(blueprint, shot, spec, resolvedReferences);
  const negativePrompt = buildNegativePrompt(shot, blueprint);

  return {
    ...spec,
    imageGenerationPrompt,
    negativePrompt,
  };
}

export function buildKeyframePrompt(
  blueprint: CommercialBlueprintCore,
  shot: CommercialShot,
  spec: Omit<KeyframeSpecification, "imageGenerationPrompt" | "negativePrompt">,
  references: ReferenceAsset[]
): string {
  const treatment = blueprint.visualTreatment;
  const concept = blueprint.selectedConcept;
  const hasProductRef = references.some((r) => r.type === "product");
  const hasPrev = references.some((r) => r.type === "previous_shot");
  const hasChar = references.some((r) => r.type === "character");

  const lines = [
    "COMMERCIAL KEYFRAME — still frame for advertising video production.",
    "Create ONE photorealistic production still that establishes composition before motion.",
    "Do NOT invent a new visual style. Obey the campaign visual treatment.",
    "",
    "WHAT / WHY",
    `Shot purpose: ${shot.shotWhy}`,
    `Story beat: ${shot.storyBeat}`,
    `Campaign concept: ${concept.title} — ${concept.oneLinePitch}`,
    "",
    "CAMERA SEES",
    shot.visualDescription,
    `Framing: ${shot.framing}`,
    `Lens: ${shot.lens || treatment.lensLanguage}`,
    `Camera language (locked): ${treatment.cameraLanguage}`,
    shot.cameraAngle ? `Angle: ${shot.cameraAngle}` : "",
    shot.cameraHeight ? `Height: ${shot.cameraHeight}` : "",
    "",
    "WHERE / LIGHT",
    `Environment: ${shot.environment || treatment.environment}`,
    `Visual style (locked): ${treatment.visualStyle}`,
    `Lighting: ${shot.lighting || treatment.lighting}`,
    `Color language: ${treatment.colorLanguage}`,
    `Texture: ${treatment.texture}`,
    `Production design: ${treatment.productionDesign}`,
    "",
    "SUBJECT",
    `Primary subject: ${shot.subject}`,
    spec.continuity.characterContinuity
      ? `Character continuity: ${spec.continuity.characterContinuity}`
      : "",
    "",
    "PRODUCT",
    spec.product.required
      ? `Product MUST appear with visibility=${spec.product.visibility}. ${spec.product.placement || ""}`
      : "Product must NOT appear (intentionally delayed / absent).",
    spec.product.state ? `Product state: ${spec.product.state}` : "",
    hasProductRef
      ? "CRITICAL: Use the supplied PRODUCT REFERENCE image. Preserve exact packaging, label, colors, and geometry. Do NOT redesign or invent the product."
      : spec.product.required
        ? "WARNING: Product is required but no product reference image was available — do not invent packaging marks."
        : "",
    "",
    "CONTINUITY",
    spec.continuity.mustMatch?.length
      ? `Must match: ${spec.continuity.mustMatch.join("; ")}`
      : "",
    hasPrev
      ? "Use the PREVIOUS-SHOT reference for wardrobe, environment, lighting, and identity continuity."
      : "",
    hasChar ? "Use the CHARACTER reference for identity lock." : "",
    "",
    "COMPOSITION",
    shot.composition,
    `Aspect ratio: ${blueprint.aspectRatio}`,
    `Typography: ${treatment.typographyDirection}`,
    "",
    "AVOID",
    ...spec.artifactAvoidance.instructions,
    "No on-screen captions, watermarks, or invented logos as overlays.",
  ];

  return lines.filter(Boolean).join("\n");
}

export function buildNegativePrompt(
  shot: CommercialShot,
  blueprint: CommercialBlueprintCore
): string {
  const risks = shot.artifactRisks?.map((r) => r.risk).join(", ") || shot.artifactRisk || "";
  return [
    "on-screen text, captions, watermark, distorted packaging labels",
    "extra limbs, morphing faces, duplicate products",
    "wrong brand colors, invented logos",
    risks,
    blueprint.visualTreatment.typographyDirection.includes("no on-screen")
      ? "text overlays"
      : "",
  ]
    .filter(Boolean)
    .join(", ");
}

export function refinePromptFromQc(
  basePrompt: string,
  issues: Array<{ check: string; message: string }>
): string {
  const repairs: string[] = [];
  for (const issue of issues) {
    if (/product/i.test(issue.check) || /product/i.test(issue.message)) {
      repairs.push(
        "REPAIR: The referenced product must be clearly visible in the specified placement. Preserve exact packaging from the product reference."
      );
    }
    if (/continuity/i.test(issue.check) || /continuity/i.test(issue.message)) {
      repairs.push(
        "REPAIR: Maintain continuity with the approved previous-shot / character reference. Preserve wardrobe, environment, lighting, and subject identity."
      );
    }
    if (/aspect/i.test(issue.check)) {
      repairs.push("REPAIR: Respect the required aspect ratio framing exactly.");
    }
  }
  if (!repairs.length) {
    repairs.push(
      "REPAIR: Regenerate the same creative intent with stricter adherence to the production brief above."
    );
  }
  return `${basePrompt}\n\n${[...new Set(repairs)].join("\n")}`;
}
