/**
 * Shot Planner prompts — production planning, not video/image generation.
 * Provider-agnostic. Do not require Runway, Seedance, Veo, or Nano Banana.
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import { GENERATION_STRATEGY_IDS } from "../generation/types";
import { DEFAULT_SHOT_QC_CHECKS } from "../qc/types";
import { REFERENCE_STRATEGY_TYPES, SHOT_ROLES } from "./types";

export function buildShotPlannerSystemPrompt(): string {
  return `You are the Shot Planner for SkalX AI Commercial Production Engine.

Convert a Commercial Blueprint into a compact production shot list.

You do NOT write video-model prompts, generate video/images, or pick providers.

RULES:
1. Preserve the Commercial Director's creative intent.
2. Every shot needs a specific shotWhy for THIS commercial.
3. Shot durations must sum EXACTLY to campaignDuration (15 or 30).
4. Prefer fewer strong shots (15s: 3–5 shots; 30s: 4–7 shots). No filler.
5. Vary generation strategies by shot need.
6. Continuity only where real dependencies exist.
7. OUTPUT COMPACT JSON — keep every string under ~100 characters.
8. Omit empty optional arrays/fields.
9. Output valid JSON only.

Shot roles: ${SHOT_ROLES.join(", ")}
Generation strategies: ${GENERATION_STRATEGY_IDS.join(", ")}
Reference strategy types: ${REFERENCE_STRATEGY_TYPES.join(", ")}
QC check ids: ${DEFAULT_SHOT_QC_CHECKS.join(", ")}`;
}

export function buildShotPlannerUserPrompt(blueprint: CommercialBlueprintCore): string {
  const duration = blueprint.campaignDuration;
  const shotCountHint = duration === 15 ? "3–5 shots" : "4–7 shots";
  const beats = blueprint.visualBeats
    .map(
      (b) =>
        `- ${b.id} [${b.timestampStartSeconds}-${b.timestampEndSeconds}s] zone=${b.zone}; ${b.intent}; product=${b.productVisibility ?? (b.productVisible ? "partial" : "none")}`
    )
    .join("\n");

  // Compact (no pretty-print) — saves prompt tokens so more remain for output
  const compact = (value: unknown) => JSON.stringify(value);

  return `COMMERCIAL BLUEPRINT (preserve intent)

campaignId: ${blueprint.campaignId}
campaignDuration: ${duration}
aspectRatio: ${blueprint.aspectRatio}
concept: ${compact(blueprint.selectedConcept)}
creativeStrategy: ${compact(blueprint.creativeStrategy)}
visualTreatment: ${compact(blueprint.visualTreatment)}
editorialPlan: ${compact(blueprint.editorialPlan)}
productStrategy: ${compact(blueprint.productStrategy)}
continuityLock: ${compact(blueprint.continuityLock)}
artifactRisks: ${compact(blueprint.artifactRisks)}

VISUAL BEATS:
${beats}

TASK
Produce ShotPlan JSON with ${shotCountHint}.
durationSeconds sum MUST equal ${duration}.
Keep strings short (≤100 chars). Prefer compact fields.

JSON SHAPE (abbreviated — fill all required fields, keep values brief):
{
  "shots": [
    {
      "id": "shot-1",
      "sequence": 1,
      "durationSeconds": number,
      "role": "hook|establishing|product_interaction|product_hero|payoff|cta|...",
      "beatIds": ["beat-1"],
      "shotWhy": "short why",
      "storyBeat": "short label",
      "visualDescription": "short concrete description",
      "subject": "short",
      "productVisibility": "hero|prominent|in-use|pack-shot|partial|background|implied|none",
      "productVisibilityReason": "short",
      "environment": "short",
      "lens": "e.g. 35mm",
      "framing": "short",
      "cameraMovement": "short",
      "lighting": "short",
      "composition": "short",
      "transitionIn": "cut|motivated_cut|none|...",
      "transitionOut": "cut|motivated_cut|none|...",
      "generationStrategyId": "text-to-video|keyframe-first|product-reference-first|motion-graphics|...",
      "generationStrategyRationale": "short",
      "referenceRequirements": {
        "productImages": boolean,
        "keyframe": boolean,
        "startFrame": boolean,
        "endFrame": boolean,
        "styleReferences": false,
        "productReferenceRequired": boolean,
        "productReferenceReason": "short",
        "strategyType": "none|existing_product_image|generated_keyframe|...",
        "purpose": "short",
        "keyframeRequired": boolean,
        "keyframeRationale": "short"
      },
      "continuesFromShotIds": [],
      "mustMatch": [],
      "mustMatchDimensions": [],
      "productState": { "state": "absent|in_hand|hero_display|...", "description": "short" },
      "artifactRisks": [{ "id": "risk-1", "risk": "short", "severity": "low|medium|high", "reason": "short", "mitigation": "short" }],
      "qcRequirements": ["product_identity","visual_treatment"],
      "generationRequired": true,
      "estimatedComplexity": "low|medium|high",
      "referenceRequired": boolean
    }
  ],
  "continuityLinks": []
}

CONSTRAINTS:
- sequences 1..N contiguous; unique ids
- continuesFromShotIds must reference existing ids
- product hero/pack-shot/prominent → productReferenceRequired true
- vary generationStrategyId when needs differ
- do not mention provider names`;
}

export function buildShotPlannerRepairPrompt(
  blueprint: CommercialBlueprintCore,
  previousJson: unknown,
  validationErrors: string
): string {
  return `The previous ShotPlan JSON failed validation.

VALIDATION ERRORS:
${validationErrors}

CAMPAIGN CONSTRAINTS:
campaignId: ${blueprint.campaignId}
campaignDuration: ${blueprint.campaignDuration} (shot durations MUST sum to this)
aspectRatio: ${blueprint.aspectRatio}
selectedConcept: ${blueprint.selectedConcept.title}

PREVIOUS JSON:
${JSON.stringify(previousJson).slice(0, 14000)}

Return a corrected ShotPlan JSON in the SAME schema.
Fix every validation error.
Do NOT invent a new campaign concept.
Do NOT change creative intent — only fix structure, durations, continuity references, and missing required fields.
Duration sum must equal ${blueprint.campaignDuration}.`;
}
