/**
 * Campaign Production Compiler — Phase 7.
 *
 * Blueprint + ShotPlan + assets → CampaignGenerationSpec
 * Does NOT call Runway / Seedance / Nano Banana.
 */

import { isCampaignDurationSeconds } from "../campaign/campaign-duration";
import { getRunwayCapabilities } from "../video/providers/runway";
import {
  VIDEO_EXECUTOR_MODEL,
  VIDEO_EXECUTOR_PROVIDER,
} from "../video-executor/types";
import { buildCampaignPrompt } from "./prompt-builder";
import { buildCampaignReferences } from "./reference-builder";
import { assertCampaignGenerationSpec } from "./validate";
import {
  CampaignCompilerError,
  type CampaignGenerationSpec,
  type CompileCampaignGenerationInput,
} from "./types";

export function compileCampaignGeneration(
  input: CompileCampaignGenerationInput
): CampaignGenerationSpec {
  const { blueprint, shotPlan } = input;
  const generationVersion = input.generationVersion || "v1";
  const generationMode = input.generationMode || "native_continuous";

  if (!blueprint?.campaignId) {
    throw new CampaignCompilerError("INVALID_BLUEPRINT", "blueprint.campaignId is required");
  }
  if (!blueprint.selectedConcept?.title || !blueprint.selectedConcept?.creativeConcept) {
    throw new CampaignCompilerError(
      "EMPTY_CREATIVE",
      "Blueprint selectedConcept is empty or incomplete"
    );
  }
  if (!blueprint.visualBeats?.length) {
    throw new CampaignCompilerError("EMPTY_CREATIVE", "Blueprint visualBeats are required");
  }
  if (!isCampaignDurationSeconds(blueprint.campaignDuration)) {
    throw new CampaignCompilerError(
      "UNSUPPORTED_DURATION",
      `Unsupported campaign duration ${blueprint.campaignDuration}`
    );
  }
  if (!shotPlan?.shots?.length) {
    throw new CampaignCompilerError("INVALID_SHOT_PLAN", "ShotPlan has no shots");
  }
  if (shotPlan.campaignId !== blueprint.campaignId) {
    throw new CampaignCompilerError(
      "INVALID_SHOT_PLAN",
      `ShotPlan campaignId ${shotPlan.campaignId} does not match blueprint ${blueprint.campaignId}`
    );
  }

  const caps = getRunwayCapabilities();
  const maxRefs =
    input.maxReferenceImages ??
    Math.min(caps.maxReferenceImages || 8, 8);

  const refs = buildCampaignReferences({
    blueprint,
    shotPlan,
    availableAssets: input.availableAssets,
    approvedKeyframesByShotId: input.approvedKeyframesByShotId,
    maxReferenceImages: maxRefs,
    requireProductWhenNeeded: true,
  });

  const { campaignPrompt, negativePrompt } = buildCampaignPrompt({
    blueprint,
    shotPlan,
  });

  const concept = blueprint.selectedConcept;
  const vt = blueprint.visualTreatment;
  const editorial = blueprint.editorialPlan;

  const spec: CampaignGenerationSpec = {
    campaignId: blueprint.campaignId,
    generationVersion,
    duration: blueprint.campaignDuration,
    aspectRatio: blueprint.aspectRatio,
    generationMode,
    provider: VIDEO_EXECUTOR_PROVIDER,
    model: VIDEO_EXECUTOR_MODEL,
    creativeConcept: {
      title: concept.title,
      coreIdea: concept.coreIdea,
      creativeConcept: concept.creativeConcept,
      emotionalDirection: concept.emotionalDirection,
      oneLinePitch: concept.oneLinePitch,
    },
    visualTreatment: {
      visualStyle: vt.visualStyle,
      colorLanguage: vt.colorLanguage,
      lighting: vt.lighting,
      cameraLanguage: vt.cameraLanguage,
      motionLanguage: vt.motionLanguage,
      environment: vt.environment,
      texture: vt.texture,
      pacing: vt.pacing,
    },
    narrative: {
      storyStructure: editorial.storyStructure,
      pacing: editorial.pacing,
      heroMomentSeconds: editorial.heroMomentSeconds,
    },
    visualBeats: [...blueprint.visualBeats]
      .sort((a, b) => a.timestampStartSeconds - b.timestampStartSeconds)
      .map((b) => ({
        id: b.id,
        purpose: b.purpose,
        timestampStartSeconds: b.timestampStartSeconds,
        timestampEndSeconds: b.timestampEndSeconds,
        emotion: b.emotion,
        intent: b.intent,
        productVisible: b.productVisible,
      })),
    editorialPlan: {
      storyStructure: editorial.storyStructure,
      pacing: editorial.pacing,
    },
    productRequirements: {
      name: blueprint.productStrategy.identityLock || "product",
      visibilityRequirements: blueprint.productStrategy.visibilityRequirements,
      firstAppearanceSeconds: blueprint.productStrategy.firstAppearanceSeconds,
      preservePackaging: true,
    },
    brandRequirements: {
      name: blueprint.brandStrategy.message,
      message: blueprint.brandStrategy.message,
      constraints: blueprint.brandStrategy.constraints || [],
    },
    platformRequirements: {
      aspectRatio: blueprint.platformStrategy.aspectRatio || blueprint.aspectRatio,
      firstFrameHook: blueprint.platformStrategy.firstFrameHook,
      ctaStrategy: blueprint.platformStrategy.ctaStrategy,
    },
    continuityRequirements: [
      blueprint.continuityLock.character,
      blueprint.continuityLock.wardrobe,
      blueprint.continuityLock.location,
      blueprint.continuityLock.lighting,
      blueprint.continuityLock.product,
      blueprint.continuityLock.visualTreatmentSummary,
    ].filter(Boolean) as string[],
    artifactRisks: (blueprint.artifactRisks || []).map(
      (r) => `${r.category}: ${r.description}`
    ),
    campaignPrompt,
    negativePrompt,
    referenceAssets: refs.selected,
    omittedReferences: refs.omitted,
    diagnostics: {
      shotCount: shotPlan.shots.length,
      beatCount: blueprint.visualBeats.length,
      referenceCount: refs.selected.length,
      maxReferencesAllowed: maxRefs,
      usesProductReference: refs.usesProductReference,
    },
  };

  assertCampaignGenerationSpec(spec);
  return spec;
}
