/**
 * Campaign-level Seedance prompt builder.
 *
 * Describes ONE coherent commercial unfolding over the campaign duration —
 * not a list of clips to stitch.
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { ShotPlan } from "../shot-planner/types";
import {
  creativeStyleToPromptBlock,
  getCreativeStylePlaybook,
  REALISM_RULE,
  type CreativeStyleId,
} from "../campaign/creative-style";
import { adTypeToPromptBlock, getAdTypePlaybook, type AdTypeId } from "../campaign/ad-type";
import { adDirectionToPromptBlock, type AdDirection } from "../campaign/ad-direction";
import { UGC_PRESENTER_GREETING, ugcToPromptBlock, type CampaignUgcInput } from "../campaign/ugc";

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

/** Speech actions the video model would act out with moving lips. */
const SPEECH_ACTION_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:speaks?|speaking|talks?|talking|says?|saying|tells?|telling|explains?|explaining|announces?|announcing|exclaims?|exclaiming|narrates?|narrating)\b(?:\s+(?:to|into|at)\s+(?:the\s+)?(?:camera|viewer|lens|audience))?/gi, "reacts silently"],
  [/\b(?:testimonial|monologue|dialogue|piece to camera|direct address)\b/gi, "silent reaction"],
  [/\b(?:lip[- ]?sync(?:ed|ing)?)\b/gi, "silent"],
];

/** Planner phrases that make the video model draw text (it acts out what it reads). */
const ON_SCREEN_TEXT_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:end[- ]?card|title card|text overlay|on[- ]screen text|super(?:imposed)? text|lower[- ]third(?: text)?|captions?|subtitles?|kinetic (?:type|typography))\b/gi, "clean product shot"],
  [/\b(?:tagline|slogan|headline|price tag|offer text|cta text|call[- ]to[- ]action text)\b(?:\s+(?:appears|reads|shows|animates)(?:\s+in)?)?/gi, "the product"],
  [/["“][^"”]{2,60}["”]\s*(?:appears|is shown|is displayed|flashes)/gi, "the product is shown"],
];

/** Remove instructions that would make the video model render words; real text is added in post. */
export function stripOnScreenText(text: string): string {
  return ON_SCREEN_TEXT_PATTERNS.reduce((acc, [re, replacement]) => acc.replace(re, replacement), text);
}

/**
 * External-language voiceover is added in post, so any on-camera speech will never
 * match it. Rewrite speech actions in planner text into silent reactions.
 */
export function stripOnCameraSpeech(text: string): string {
  return SPEECH_ACTION_PATTERNS.reduce((acc, [re, replacement]) => acc.replace(re, replacement), text);
}

/**
 * Build a production-grade campaign prompt for native continuous Seedance generation.
 */
export function buildCampaignPrompt(input: {
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
  /**
   * When true (Tamil / Hindi / Malayalam / Kannada), Seedance must NOT generate
   * spoken voiceover — Gemini TTS is muxed after.
   */
  suppressSpokenVoiceover?: boolean;
  /** Physical handling facts read from the product photo (closure, how it opens). */
  productHandling?: string;
  /** User-chosen visual style; decides continuous scene vs edited sequence. */
  creativeStyle?: CreativeStyleId;
  /** A brand end card is overlaid in post on the final seconds. */
  endCard?: boolean;
  adType?: AdTypeId;
  /** Every product in the ad, in reference-image order. */
  productNames?: string[];
  occasion?: string;
  shopDetails?: string;
  adDirection?: AdDirection;
  ugc?: CampaignUgcInput;
}): { campaignPrompt: string; negativePrompt: string } {
  const { blueprint, shotPlan } = input;
  const silent = Boolean(input.suppressSpokenVoiceover);
  const speechSafe = (text: string) => stripOnScreenText(silent ? stripOnCameraSpeech(text) : text);
  const concept = blueprint.selectedConcept;
  const vt = blueprint.visualTreatment;
  const product = blueprint.productStrategy;
  const brand = blueprint.brandStrategy;
  const platform = blueprint.platformStrategy;
  const editorial = blueprint.editorialPlan;
  const duration = blueprint.campaignDuration;
  const playbook = getCreativeStylePlaybook(input.creativeStyle);
  const edited = playbook.structure === "edited";

  const beats = [...(blueprint.visualBeats || [])].sort(
    (a, b) => a.timestampStartSeconds - b.timestampStartSeconds
  );

  const beatNarrative = beats
    .map((b, i) => {
      const span = `${b.timestampStartSeconds}s–${b.timestampEndSeconds}s`;
      return speechSafe(`Beat ${i + 1} (${span}): ${b.purpose}${b.intent ? ` — ${b.intent}` : ""}${
        b.emotion ? ` Emotion: ${b.emotion}.` : ""
      }${b.productVisible ? " Product visible." : ""}`);
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
  const ending = silent
    ? `Final ${duration >= 30 ? 4 : 3} seconds: a clean product hero shot of the real packaging, no faces in frame, held steady and calm while the voiceover finishes.`
    : endingShot?.role === "end_card" || endingShot?.role === "cta"
      ? `End with a controlled brand/product resolve. Prefer a clean product hero or brand lock; do not invent complex on-screen typography or hallucinated logos.`
      : `Conclude on the product/brand resolve established by the final beat.`;

  // Positive description of silent acting: video models act out what they read,
  // so "no talking" alone still produces moving lips.
  // UGC presenter: one English hello on camera, then the same closed-mouth acting.
  const presenter = silent && input.ugc?.speech === "presenter";
  const silentPerformance = presenter
    ? `PERFORMANCE (CRITICAL): The creator faces the camera like a vlogger and says only "${UGC_PRESENTER_GREETING}" in English in the first 1–2 seconds. After that nobody speaks on camera — closed-mouth smiles, nods, raised eyebrows, showing and pointing at the product, a thumbs-up — while still facing the lens.`
    : silent
    ? `PERFORMANCE (CRITICAL): Nobody speaks on camera at any moment — this is a narrated commercial and the narrator is never seen. People act without words: closed-mouth smiles, nods, eyes closing while savouring, chewing with lips closed, glances at the product. Never frame a character addressing or talking to the camera.`
    : undefined;

  const audioDirective = presenter
    ? `AUDIO: Only the short English hello "${UGC_PRESENTER_GREETING}" at the very start; after that, instrumental music and soft ambient sound only, no other voices.`
    : silent
    ? `AUDIO: Instrumental music bed and subtle ambient sound effects only (packaging sounds, room tone). No human voices in the audio.`
    : `AUDIO: Include a clear native English commercial voiceover that sells the product — hook, brand+product, benefit, CTA. Music ducked under speech.`;

  const productHandling = input.productHandling?.trim()
    ? `PRODUCT HANDLING (CRITICAL — physical facts from the product photo): ${input.productHandling.trim()}`
    : undefined;

  const campaignPrompt = joinSentences([
    edited
      ? `Create ONE ${duration}-second commercial advertisement that plays as a finished, edited sequence of shots joined by clean cuts and transitions — one coherent ad, generated in a single pass.`
      : `Create ONE continuous ${duration}-second commercial advertisement as a single unbroken take of narrative time (not separate clips to stitch).`,
    `Aspect ratio ${blueprint.aspectRatio}.`,
    `VISUAL STYLE (CRITICAL): ${creativeStyleToPromptBlock(playbook, duration)}`,
    `NO WRITTEN WORDS (CRITICAL): the video contains no captions, titles, subtitles, slogans, prices or letters in any language. The only writing visible is what is printed on the real product label.`,
    `AD TYPE (CRITICAL): ${adTypeToPromptBlock(getAdTypePlaybook(input.adType), {
      productNames: input.productNames || [],
      occasion: input.occasion,
      shopDetails: input.shopDetails,
    })}`,
    (input.productNames?.length ?? 0) > 1
      ? `The product reference images are in the same order as the product list — each product must match its own reference exactly.`
      : undefined,
    adDirectionToPromptBlock(input.adDirection) || undefined,
    ugcToPromptBlock(input.ugc, { hasProductPhotos: (input.productNames?.length ?? 0) > 0 }) || undefined,
    silentPerformance,
    productHandling,
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
    `Camera language: ${clean([vt.cameraLanguage, vt.lensLanguage, vt.motionLanguage])}. Do not invent random camera moves that contradict the treatment.`,
    `Environment: ${vt.environment || blueprint.continuityLock.location || "as established by creative treatment"}.`,
    characterNotes.length
      ? `Characters (maintain identity throughout): ${speechSafe(characterNotes.join("; "))}.`
      : undefined,
    `Brand ${brand.personality ? `(${brand.personality})` : ""}: ${brand.message}. ${
      brand.doNotLookGeneric || ""
    }`,
    `Product requirements: ${product.visibilityRequirements || "Respect product packaging identity from the supplied product reference."} Preserve exact packaging, label, colors, logo geometry, and proportions from the product reference image — do not invent alternate packaging.`,
    speechSafe(productProgression),
    `Narrative structure: ${editorial.storyStructure}. Pacing: ${editorial.pacing}${
      editorial.heroMomentSeconds != null
        ? `. Hero moment around ${editorial.heroMomentSeconds}s`
        : ""
    }.`,
    beatNarrative
      ? `Chronological visual beats inside this one ${edited ? "edited" : "continuous"} commercial: ${beatNarrative}`
      : undefined,
    platform.firstFrameHook ? `Opening hook: ${platform.firstFrameHook}.` : undefined,
    continuityNotes.length ? `Continuity lock: ${continuityNotes.join("; ")}.` : undefined,
    audioDirective,
    ending,
    input.endCard
      ? `In the final 3 seconds, frame the product in the upper half of the picture; the lower third is plain, empty background surface with nothing in it.`
      : undefined,
    artifactAvoid.length
      ? `Artifact mitigation: ${artifactAvoid.join("; ")}.`
      : undefined,
    REALISM_RULE,
    edited
      ? `The result must feel like one coherent ${duration}s commercial for this brand: every shot serves the same idea, with consistent characters, product and colour.`
      : `The result must feel like one coherent ${duration}s commercial for ${brand.message ? "this brand" : "the brand"}, not a montage of unrelated shots.`,
  ]);

  const negativePrompt = clean([
    "on-screen text, captions, watermark, logo overlays, distorted product labels",
    "extra limbs, morphing faces, identity drift, duplicate products",
    "generic stock-ad look, random camera whip, inconsistent wardrobe",
    "glowing light rays, sparkles, magical aura from the product",
    "invented packaging, wrong brand colors",
    presenter ? "speech after the opening hello, moving lips after the first 2 seconds" : silent ? "spoken dialogue, human voices in the audio" : undefined,
    artifactAvoid.slice(0, 3).join(", "),
  ]);

  return { campaignPrompt, negativePrompt };
}
