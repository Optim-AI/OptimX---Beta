/**
 * Campaign-level Seedance prompt builder.
 *
 * Describes ONE coherent commercial unfolding over the campaign duration —
 * not a list of clips to stitch.
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { ShotPlan } from "../shot-planner/types";

function clean(parts: Array<string | undefined | null | false>): string {
  return parts
    .map((p) => (typeof p === "string" ? p.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .join(" ");
}

function joinSentences(parts: Array<string | undefined | null | false>): string {
  return parts
    .map((p) => (typeof p === "string" ? p.replace(/\s+/g, " ").trim() : ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+\./g, ".")
    .trim();
}

/**
 * Build a production-grade campaign prompt for native continuous Seedance generation.
 */
export function buildCampaignPrompt(input: {
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
}): { campaignPrompt: string; negativePrompt: string } {
  const { blueprint, shotPlan } = input;
  const concept = blueprint.selectedConcept;
  const vt = blueprint.visualTreatment;
  const product = blueprint.productStrategy;
  const brand = blueprint.brandStrategy;
  const platform = blueprint.platformStrategy;
  const editorial = blueprint.editorialPlan;
  const duration = blueprint.campaignDuration;

  const beats = [...(blueprint.visualBeats || [])].sort(
    (a, b) => a.timestampStartSeconds - b.timestampStartSeconds
  );

  const beatNarrative = beats
    .map((b, i) => {
      const span = `${b.timestampStartSeconds}s–${b.timestampEndSeconds}s`;
      return `Beat ${i + 1} (${span}): ${b.purpose}${b.intent ? ` — ${b.intent}` : ""}${
        b.emotion ? ` Emotion: ${b.emotion}.` : ""
      }${b.productVisible ? " Product visible." : ""}`;
    })
    .join(" ");

  const productStates = shotPlan.shots
    .filter((s) => s.productState)
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => {
      const ps = s.productState!;
      return `${s.sequence}. ${ps.state}${ps.description ? ` (${ps.description})` : ""}`;
    });

  const productProgression =
    productStates.length > 0
      ? `Product state progression across the commercial: ${productStates.join(" → ")}.`
      : product.visibilityRequirements
        ? `Product visibility: ${product.visibilityRequirements}.`
        : "";

  const characterNotes = shotPlan.shots
    .flatMap((s) => s.characterContinuity || [])
    .filter((c, i, arr) => arr.findIndex((x) => x.characterId === c.characterId) === i)
    .map((c) =>
      clean([
        c.identity,
        c.appearance,
        c.wardrobe ? `wardrobe: ${c.wardrobe}` : undefined,
        c.roleInStory,
      ])
    )
    .filter(Boolean);

  const continuityNotes = [
    blueprint.continuityLock.character,
    blueprint.continuityLock.wardrobe,
    blueprint.continuityLock.location,
    blueprint.continuityLock.lighting,
    blueprint.continuityLock.product,
    blueprint.continuityLock.visualTreatmentSummary,
  ].filter(Boolean);

  const artifactAvoid = [
    ...(blueprint.artifactRisks || []).map((r) => r.mitigation || r.description),
    ...shotPlan.shots.map((s) => s.artifactRisk).filter(Boolean),
  ]
    .filter(Boolean)
    .slice(0, 8);

  const endingShot = [...shotPlan.shots].sort((a, b) => b.sequence - a.sequence)[0];
  const ending =
    endingShot?.role === "end_card" || endingShot?.role === "cta"
      ? `End with a controlled brand/product resolve. Prefer a clean product hero or brand lock; do not invent complex on-screen typography or hallucinated logos.`
      : `Conclude on the product/brand resolve established by the final beat.`;

  const campaignPrompt = joinSentences([
    `Create ONE continuous ${duration}-second commercial advertisement as a single unbroken take of narrative time (not separate clips to stitch).`,
    `Aspect ratio ${blueprint.aspectRatio}.`,
    concept
      ? `Creative concept "${concept.title}": ${concept.creativeConcept}. Core idea: ${concept.coreIdea}. Emotional arc: ${concept.emotionalDirection}. Pitch: ${concept.oneLinePitch}.`
      : undefined,
    `Visual treatment: ${clean([
      vt.visualStyle,
      vt.colorLanguage,
      vt.lighting,
      vt.texture,
      vt.environment,
      vt.productionDesign,
    ])}.`,
    `Camera language: ${clean([vt.cameraLanguage, vt.lensLanguage, vt.motionLanguage])}. Do not invent random camera moves that contradict a locked-off or intimate treatment.`,
    `Environment: ${vt.environment || blueprint.continuityLock.location || "as established by creative treatment"}.`,
    characterNotes.length
      ? `Characters (maintain identity throughout): ${characterNotes.join("; ")}.`
      : undefined,
    `Brand ${brand.personality ? `(${brand.personality})` : ""}: ${brand.message}. ${
      brand.doNotLookGeneric || ""
    }`,
    `Product requirements: ${product.visibilityRequirements || "Respect product packaging identity from the supplied product reference."} Preserve exact packaging, label, colors, logo geometry, and proportions from the product reference image — do not invent alternate packaging.`,
    productProgression,
    `Narrative structure: ${editorial.storyStructure}. Pacing: ${editorial.pacing}${
      editorial.heroMomentSeconds != null
        ? `. Hero moment around ${editorial.heroMomentSeconds}s`
        : ""
    }.`,
    beatNarrative ? `Chronological visual beats inside this one continuous commercial: ${beatNarrative}` : undefined,
    platform.firstFrameHook ? `Opening hook: ${platform.firstFrameHook}.` : undefined,
    continuityNotes.length ? `Continuity lock: ${continuityNotes.join("; ")}.` : undefined,
    ending,
    artifactAvoid.length
      ? `Artifact mitigation: ${artifactAvoid.join("; ")}.`
      : undefined,
    `The result must feel like one coherent ${duration}s commercial for ${brand.message ? "this brand" : "the brand"}, not a montage of unrelated shots.`,
  ]);

  const negativePrompt = clean([
    "on-screen text, captions, watermark, logo overlays, distorted product labels",
    "extra limbs, morphing faces, identity drift, duplicate products",
    "generic stock-ad look, random camera whip, inconsistent wardrobe",
    "invented packaging, wrong brand colors",
    artifactAvoid.slice(0, 3).join(", "),
  ]);

  return { campaignPrompt, negativePrompt };
}
