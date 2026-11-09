/**
 * Prompt builders for Commercial Director structured generation.
 * Campaign-specific creative intelligence — not generic cinematic filler.
 */

import type { CampaignBrief } from "../campaign/types";
import {
  classifyProduct,
  productIntelligenceToPromptBlock,
} from "../../product-intelligence";
import {
  usesGeminiTts,
  voiceoverLanguageDisplayName,
} from "../audio/voiceover-languages";
import {
  creativeStyleToPromptBlock,
  getCreativeStylePlaybook,
  REALISM_RULE,
} from "../campaign/creative-style";
import { adTypeToPromptBlock, getAdTypePlaybook } from "../campaign/ad-type";
import { adDirectionToPromptBlock } from "../campaign/ad-direction";
import { UGC_PRESENTER_GREETING, ugcToPromptBlock, usesExternalVoiceover } from "../campaign/ugc";

export function buildDirectorSystemPrompt(): string {
  return `You are the Commercial Director for SkalX AI Ad Video Production.

Your job is campaign-level creative direction for a finished commercial (15s or 30s).
You do NOT write shot lists. You do NOT write video-model prompts. You do NOT generate video.

You behave like a senior advertising creative director planning a commercial BEFORE production:
understand the brief, explore multiple DISTINCT creative directions, select one, then lock
visual DNA, narrative beats, editorial rhythm, product strategy, brand strategy, platform
adaptation, continuity locks, artifact risks, and QC requirements.

QUALITY BAR — avoid the failure mode where different brands/products get the same generic
"cinematic premium ad". Differentiation must come from concept, story mechanism, emotion,
visual metaphor, product interaction, environment, camera language, and editorial rhythm —
NOT from stacking adjectives.

VisualTreatment fields must be SPECIFIC multi-clause descriptions of a coherent visual system,
never single words like "cinematic", "dramatic", "dynamic", "vibrant".

Explore 4–6 meaningfully different creative directions that differ in:
- narrative idea
- emotional approach
- visual language
- product interaction
- storytelling mechanism

Then select ONE and build the full blueprint around it.

Product does NOT need to appear in every beat — only when it serves the story.

Never plan on-screen text, titles, captions, taglines or end cards in beats or shots: the video model draws them
as garbled letters. The offer, CTA and end card are added in post; beats show only images and action.

The VISUAL STYLE in the brief is the user's choice. Every explored direction must be
executable in that style — vary the idea, not the style.

${REALISM_RULE}

Do not invent brand facts that were not provided. List unknowns explicitly.

Output valid JSON only matching the required schema.`;
}

export function buildDirectorUserPrompt(brief: CampaignBrief): string {
  const intel = classifyProduct(
    brief.product.name,
    brief.product.category,
    brief.product.description || brief.userConcept
  );

  const brandUnknowns: string[] = [];
  if (!brief.brand.personality) brandUnknowns.push("brand personality not provided");
  if (!brief.brand.tone && !brief.brand.voice) brandUnknowns.push("brand tone/voice not provided");
  if (!brief.brand.visualPreferences) brandUnknowns.push("visual preferences not provided");
  if (!brief.brand.primaryColors?.length) brandUnknowns.push("brand colors not provided");
  if (!brief.brand.tagline) brandUnknowns.push("tagline not provided");

  const duration = brief.campaignDuration;
  const beatHint =
    duration === 30
      ? "Use 5–7 visual beats spanning 0–30s"
      : "Use 4–6 visual beats spanning 0–15s";

  const externalTts = usesExternalVoiceover(brief);
  const voLanguage = voiceoverLanguageDisplayName(brief.voiceover?.language);
  const voiceoverBlock = externalTts
    ? `VOICEOVER ROUTING (CRITICAL):
language: ${voLanguage}
provider: Gemini 3.8 Flash TTS (post-production)
Seedance must NOT invent spoken dialogue or English/native voiceover.
In soundDesignIntent.voiceover write: "none — external ${voLanguage} TTS added after generation".
${brief.ugc?.speech === "presenter"
  ? `The creator faces the camera like a vlogger. They say ONLY "${UGC_PRESENTER_GREETING}" in English at 0–2s; after that nobody speaks on camera —
the ${voLanguage} voice-over carries the words while they show and react with closed-mouth expressions.`
  : `No character may speak on camera in any beat — no testimonials, no talking to camera,
no dialogue. The ${voLanguage} narrator is never seen, so any moving lips will not match.`}
Show reactions silently (smiles, nods, savouring with lips closed).
The final beat is a product hero shot with no faces, held for the narrator's closing line.
Music + ambience only in the video model.
CTA enabled: ${brief.voiceover?.ctaEnabled !== false ? "yes" : "no"}${
        brief.voiceover?.cta ? `\npreferred CTA: ${brief.voiceover.cta}` : ""
      }`
    : `VOICEOVER ROUTING:
language: English
provider: Seedance native spoken audio
Plan for a clear English commercial VO in soundDesignIntent.
CTA enabled: ${brief.voiceover?.ctaEnabled !== false ? "yes" : "no"}${
        brief.voiceover?.cta ? `\npreferred CTA: ${brief.voiceover.cta}` : ""
      }`;

  return `CAMPAIGN BRIEF
campaignId: ${brief.campaignId}
durationSeconds: ${duration} (finished commercial length — NOT a single provider clip)
aspectRatio: ${brief.aspectRatio}
platform: ${brief.platform || "unspecified"}
marketingObjective: ${brief.marketingObjective || brief.creativeStrategy?.campaignGoal || "unspecified"}
targetAudience: ${brief.targetAudience || brief.creativeStrategy?.targetAudience || "infer carefully from product; state uncertainty if needed"}
campaignMessage: ${brief.campaignMessage || "not provided"}
offer: ${brief.offer || brief.product.offer || "not provided"}
userConcept: ${brief.userConcept || "not provided"}
hookType: ${brief.hookType || brief.creativeStrategy?.hookType || "not provided"}

${voiceoverBlock}

VISUAL STYLE (user's choice — all concepts, beats and visualTreatment must follow it):
${creativeStyleToPromptBlock(getCreativeStylePlaybook(brief.creativeStyle), duration)}

AD TYPE (user's choice — the story structure and product presence must follow it):
${adTypeToPromptBlock(getAdTypePlaybook(brief.adType), {
  productNames: [brief.product.name, ...(brief.additionalProducts || []).map((p) => p.name)],
  occasion: brief.occasion,
  shopDetails: brief.shopDetails,
})}

${adDirectionToPromptBlock(brief.adDirection)}

${ugcToPromptBlock(brief.ugc, { hasProductPhotos: Boolean(brief.product.images?.length) })}

BRAND
name: ${brief.brand.name}
personality: ${brief.brand.personality || "UNKNOWN — do not invent"}
voice: ${brief.brand.voice || "UNKNOWN"}
tone: ${brief.brand.tone || "UNKNOWN"}
visualPreferences: ${brief.brand.visualPreferences || "UNKNOWN"}
primaryColors: ${brief.brand.primaryColors?.join(", ") || "UNKNOWN"}
tagline: ${brief.brand.tagline || "UNKNOWN"}
websiteUrl: ${brief.brand.websiteUrl || "not provided"}
knownGaps: ${brandUnknowns.join("; ") || "none listed"}

PRODUCT
name: ${brief.product.name}
category: ${brief.product.category || "unspecified"}
description: ${brief.product.description || "not provided"}
hasProductReferenceImages: ${brief.product.images?.length ? "yes (attached above — study the real packaging, colours and size before planning. The photo is the truth: if the typed name or description disagrees with it — a different flavour, variant or pack — plan around what the photo shows)" : "no"}
physicalHandling: ${brief.product.handling || "not analysed — do not invent seals, tabs or wrappers; keep handling simple"}
(physicalHandling is read from the product photo. Every interaction you plan — opening, pouring, serving — MUST match it. Put the correct opening action in productStrategy.interaction.)
offer: ${brief.product.offer || "not provided"}
${(brief.additionalProducts || [])
  .map(
    (p, i) => `
ADDITIONAL PRODUCT ${i + 2}
name: ${p.name}
hasProductReferenceImage: ${p.images?.length ? "yes (attached above, in product order)" : "no"}
physicalHandling: ${p.handling || "not analysed — keep handling simple"}`
  )
  .join("\n")}

PRODUCT INTELLIGENCE (heuristic, verify against brief):
${productIntelligenceToPromptBlock(intel)}

EXISTING STRATEGY (if any — honor without copying generically):
${brief.creativeStrategy ? JSON.stringify(brief.creativeStrategy) : "none"}
SELECTED PERFORMANCE CONCEPT (if any — may inform but you still explore alternatives):
${brief.selectedConcept ? JSON.stringify(brief.selectedConcept) : "none"}
${
  brief.approvedConcept
    ? `
APPROVED CONCEPT (CRITICAL — the client already picked this idea from a storyboard):
title: ${brief.approvedConcept.title}
idea: ${brief.approvedConcept.idea}
story moments: ${brief.approvedConcept.beats.map((b, i) => `${i + 1}. ${b}`).join(" ")}
selectedConcept MUST be this idea and visualBeats MUST follow these moments in order.
Explore alternatives only in exploredConcepts; refine and strengthen, never replace.`
    : ""
}
TASK
1. Internally explore 4–6 DISTINCT creative directions for THIS brief.
2. Select the strongest for the objective, audience, and product truth.
3. Produce the campaign Commercial Blueprint JSON.

${beatHint}. Beats are narrative/visual moments, NOT shots.

JSON SCHEMA (return exactly this shape):
{
  "exploredConcepts": [
    {
      "id": "explore-1",
      "title": string,
      "coreIdea": string,
      "creativeConcept": string,
      "emotionalDirection": string,
      "visualMetaphor": string | null,
      "oneLinePitch": string,
      "narrativeMechanism": string,
      "productInteraction": string,
      "visualLanguage": string,
      "campaignFitNotes": string
    }
  ],
  "selectedConceptId": "explore-N",
  "rationale": "why this concept wins for this campaign",
  "selectedConcept": {
    "title": string,
    "coreIdea": string,
    "creativeConcept": string,
    "emotionalDirection": string,
    "visualMetaphor": string | null,
    "oneLinePitch": string,
    "campaignFitRationale": string
  },
  "creativeStrategy": {
    "campaignGoal": string,
    "targetAudience": string,
    "creativeAngle": string,
    "coreMessage": string,
    "corePainPoint": string,
    "coreDesire": string,
    "biggestObjection": string,
    "hookType": string,
    "cta": string,
    "conversionObjective": string
  },
  "visualTreatment": {
    "visualStyle": "specific multi-clause visual system",
    "lighting": "specific",
    "colorLanguage": "specific",
    "environment": "specific",
    "cameraLanguage": "specific",
    "lensLanguage": "specific",
    "texture": "specific",
    "productionDesign": "specific",
    "typographyDirection": "always: no on-screen text in the generated video (offers, CTA and end card are added in post)",
    "motionLanguage": "specific",
    "pacing": "specific rhythm description"
  },
  "visualBeats": [
    {
      "id": "beat-1",
      "zone": string,
      "purpose": string,
      "timestampStartSeconds": number,
      "timestampEndSeconds": number,
      "emotion": string,
      "intent": string,
      "productVisible": boolean,
      "productVisibility": "none" | "implied" | "partial" | "hero"
    }
  ],
  "editorialPlan": {
    "storyStructure": string,
    "pacing": string,
    "transitionStrategy": string,
    "cuttingRhythm": string,
    "heroMomentSeconds": number
  },
  "soundDesignIntent": {
    "music": string,
    "voiceover": string,
    "soundEffects": string,
    "silenceStrategy": string
  },
  "productStrategy": {
    "visibilityRequirements": string,
    "heroMoments": [string],
    "identityLock": string,
    "avoidRegeneratingProductWhenReferenceExists": true,
    "firstAppearanceSeconds": number,
    "becomesImportantSeconds": number,
    "prominence": string,
    "interaction": string,
    "packagingVisibility": string,
    "revealStrategy": string,
    "finalCtaFrame": string
  },
  "brandStrategy": {
    "personality": string,
    "message": string,
    "doNotLookGeneric": string,
    "differentiation": string,
    "tone": string,
    "visualIdentity": string,
    "communicationStyle": string,
    "constraints": [string],
    "unknowns": [string]
  },
  "platformStrategy": {
    "platform": ${brief.platform ? `"${brief.platform}"` : "null"},
    "aspectRatio": "${brief.aspectRatio}",
    "safeAreas": string,
    "firstFrameHook": string,
    "framing": string,
    "pacingInfluence": string,
    "textUsage": "prefer no on-screen text overlays unless essential",
    "hookTiming": string,
    "composition": string,
    "ctaStrategy": string
  },
  "continuityLock": {
    "character": string,
    "wardrobe": string,
    "location": string,
    "lighting": string,
    "timeOfDay": string,
    "product": string,
    "colorGrade": string,
    "visualTreatmentSummary": string
  },
  "artifactRisks": [
    {
      "id": "risk-1",
      "category": "product_packaging|text_logo|hands_interaction|reflections|food_texture|character_consistency|physics_interaction|other",
      "description": string,
      "severity": "low|medium|high",
      "mitigation": string
    }
  ],
  "commercialQCRequirements": {
    "checks": ["product_identity","brand_consistency_via_campaign_relevance","visual_treatment","continuity","product_visibility","artifact_risk","campaign_relevance"],
    "productIdentity": string,
    "brandConsistency": string,
    "visualContinuity": string,
    "conceptAdherence": string,
    "productVisibility": string,
    "visualTreatmentConsistency": string,
    "artifactRiskChecks": [string]
  }
}

Use only these QC check ids in checks array:
product_visibility, product_identity, composition, continuity, visual_treatment,
subject_consistency, motion_quality, artifact_risk, unwanted_text, malformed_objects,
camera_consistency, campaign_relevance`;
}

export function buildRepairUserPrompt(
  brief: CampaignBrief,
  previousJson: unknown,
  validationErrors: string
): string {
  return `The previous Commercial Blueprint JSON failed validation.

VALIDATION ERRORS:
${validationErrors}

CAMPAIGN CONSTRAINTS (must honor):
campaignId: ${brief.campaignId}
campaignDuration: ${brief.campaignDuration}
aspectRatio: ${brief.aspectRatio}
platform: ${brief.platform || "unspecified"}
brand: ${brief.brand.name}
product: ${brief.product.name}

PREVIOUS JSON:
${JSON.stringify(previousJson).slice(0, 12000)}

Return a corrected JSON object in the SAME schema.
Fix every validation error.
Keep the creative concept campaign-specific — do not collapse into generic cinematic filler.
VisualTreatment fields must remain specific multi-clause descriptions (not single adjectives).`;
}
