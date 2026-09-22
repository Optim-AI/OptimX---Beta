/**
 * Prompt builders for Commercial Director structured generation.
 * Campaign-specific creative intelligence — not generic cinematic filler.
 */

import type { CampaignBrief } from "../campaign/types";
import {
  classifyProduct,
  productIntelligenceToPromptBlock,
} from "../../product-intelligence";

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
hasProductReferenceImages: ${brief.product.images?.length ? "yes" : "no"}
offer: ${brief.product.offer || "not provided"}

PRODUCT INTELLIGENCE (heuristic, verify against brief):
${productIntelligenceToPromptBlock(intel)}

EXISTING STRATEGY (if any — honor without copying generically):
${brief.creativeStrategy ? JSON.stringify(brief.creativeStrategy) : "none"}
SELECTED PERFORMANCE CONCEPT (if any — may inform but you still explore alternatives):
${brief.selectedConcept ? JSON.stringify(brief.selectedConcept) : "none"}

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
    "typographyDirection": "on-screen text policy for this campaign",
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
