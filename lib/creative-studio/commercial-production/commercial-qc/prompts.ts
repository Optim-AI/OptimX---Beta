/**
 * Visual evaluator prompts — evaluate against supplied requirements only.
 * No generic quality scores. No audio claims from frames.
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { ShotPlan } from "../shot-planner/types";

export const VISUAL_QC_SYSTEM_PROMPT = `You are a commercial production QC visual analyst for SkalX AI.

Your job is NOT to rate whether a video "looks good as AI video."
Your job is to determine whether the generated commercial fulfills the supplied creative and production specification.

Rules (mandatory):
1. Evaluate only against supplied requirements. Do not invent requirements.
2. Do not invent observations. If you cannot verify something visually, say so with low confidence.
3. Distinguish ABSENCE from CONTRADICTION. Product absent in a beat where productVisibility is "none" or "implied" is NOT a failure.
4. Do not require product visibility in every frame.
5. Do not penalize creative variation unless it contradicts the intended visual treatment, narrative, or brand/product requirements.
6. Do not infer information that cannot be visually verified from the sampled frames.
7. State uncertainty explicitly via confidence (0–1).
8. Provide evidence for every nontrivial observation — describe what was actually seen.
9. Separate observation (what you see) from interpretation (how it relates to requirements).
10. Do NOT produce a generic quality score or overall rating number.
11. Do NOT claim audio, dialogue, music, voice, or SFX quality — frames cannot verify audio.
12. Do NOT claim exact product fidelity if sampled evidence is insufficient.
13. Canonical product reference (when provided) outranks generated keyframes for product identity.
14. Only flag meaningful continuity contradictions — not frame-perfect differences.
15. Ending/CTA: if typography/CTA is specified as post-production only, do not fail for missing on-screen text.

Return JSON only matching the schema.`;

export function buildVisualQCUserPrompt(input: {
  campaignId: string;
  generationVersion: string;
  durationSeconds: number;
  timestamps: number[];
  requirementsSummary: string;
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
  hasProductReference: boolean;
}): string {
  const beats = (input.blueprint.visualBeats || [])
    .map(
      (b) =>
        `- ${b.id} [${b.zone}] ${b.timestampStartSeconds}–${b.timestampEndSeconds}s: ${b.intent}; productVisibility=${b.productVisibility ?? (b.productVisible ? "partial" : "none")}`
    )
    .join("\n");

  const shots = input.shotPlan.shots
    .map((s) => {
      const prior = input.shotPlan.shots
        .filter((x) => x.sequence < s.sequence)
        .reduce((sum, x) => sum + x.durationSeconds, 0);
      return `- ${s.id} role=${s.role} ~${prior}–${prior + s.durationSeconds}s productVisibility=${s.productVisibility}; continuity=${(s.continuity?.mustMatch || []).join(", ") || "n/a"}`;
    })
    .join("\n");

  const artifacts = (input.blueprint.artifactRisks || [])
    .map((a) => `- ${a.id} [${a.severity}] ${a.category}: ${a.description}`)
    .join("\n");

  const endingNotes = [
    input.blueprint.productStrategy?.finalCtaFrame,
    input.blueprint.platformStrategy?.ctaStrategy,
    input.blueprint.visualTreatment?.typographyDirection,
  ]
    .filter(Boolean)
    .join(" | ");

  return `Campaign: ${input.campaignId} / ${input.generationVersion}
Duration: ${input.durationSeconds}s
Sampled frame timestamps (seconds): ${input.timestamps.join(", ")}
Canonical product reference attached: ${input.hasProductReference ? "yes" : "no"}

## Requirements summary
${input.requirementsSummary}

## Selected concept
${input.blueprint.selectedConcept.title}: ${input.blueprint.selectedConcept.coreIdea}
Emotional direction: ${input.blueprint.selectedConcept.emotionalDirection}

## Visual treatment (intended)
Style: ${input.blueprint.visualTreatment.visualStyle}
Lighting: ${input.blueprint.visualTreatment.lighting}
Color: ${input.blueprint.visualTreatment.colorLanguage}
Environment: ${input.blueprint.visualTreatment.environment}
Camera: ${input.blueprint.visualTreatment.cameraLanguage}

## Narrative beats (intended)
${beats || "(none)"}

## Shot plan (creative structure — native continuous may not cut per shot)
${shots || "(none)"}

## Product strategy
Identity lock: ${input.blueprint.productStrategy?.identityLock ?? "n/a"}
Visibility: ${input.blueprint.productStrategy?.visibilityRequirements ?? "n/a"}
First appearance ~${input.blueprint.productStrategy?.firstAppearanceSeconds ?? "n/a"}s

## Brand strategy (only evaluate what is specified)
Tone: ${input.blueprint.brandStrategy?.tone ?? "n/a"}
Visual identity: ${input.blueprint.brandStrategy?.visualIdentity ?? "n/a"}
Do not look generic: ${input.blueprint.brandStrategy?.doNotLookGeneric ?? "n/a"}

## Ending / CTA intent
${endingNotes || "n/a"}

## Known artifact risks
${artifacts || "(none listed)"}

## QC requirements stub
${JSON.stringify(input.blueprint.commercialQCRequirements ?? {}, null, 0)}

Return JSON:
{
  "analyzerConfidence": number,
  "observations": [
    {
      "category": "product"|"brand"|"character"|"environment"|"narrative"|"camera"|"continuity"|"composition"|"artifact"|"ending"|"treatment",
      "severity": "info"|"warning"|"error"|"critical",
      "timestamp": number|null,
      "observation": string,
      "evidence": string,
      "confidence": number
    }
  ]
}

If everything substantially matches requirements, return mostly info/warning observations and high analyzerConfidence.
Do not invent failures.`;
}

export function buildRequirementsSummary(
  blueprint: CommercialBlueprintCore,
  shotPlan: ShotPlan
): string {
  const productMoments = shotPlan.shots
    .filter((s) => s.productVisibility && s.productVisibility !== "none")
    .map((s) => `${s.role}:${s.productVisibility}`)
    .join(", ");

  return [
    `Concept: ${blueprint.selectedConcept.oneLinePitch}`,
    `Story: ${blueprint.editorialPlan?.storyStructure ?? "n/a"}`,
    `Product moments: ${productMoments || "none required in shot plan"}`,
    `Treatment: ${blueprint.visualTreatment.visualStyle}`,
  ].join("\n");
}
