/**
 * Targeted regeneration planning — does NOT call video providers.
 * Produces a RegenerationPlan that preserves creative DNA.
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import type {
  CommercialQCDecision,
  RegenerationHistoryEntry,
  RegenerationPlan,
  VisualObservation,
} from "./types";
import { DEFAULT_MAX_AUTO_REGENERATIONS } from "./types";

/**
 * Parse version strings like v1, v2, v10 → next version.
 */
export function nextGenerationVersion(current: string): string {
  const m = /^v(\d+)$/i.exec(current.trim());
  if (m) {
    return `v${Number(m[1]) + 1}`;
  }
  // Non-standard: append .rN
  const r = /\.r(\d+)$/i.exec(current);
  if (r) {
    return current.replace(/\.r\d+$/i, `.r${Number(r[1]) + 1}`);
  }
  return `${current}.r2`;
}

export function parseGenerationVersionNumber(version: string): number {
  const m = /^v(\d+)$/i.exec(version.trim());
  return m ? Number(m[1]) : 1;
}

/**
 * How many regenerations have occurred after v1 (v2 => 1, v3 => 2).
 */
export function regenerationCountFromVersion(version: string): number {
  return Math.max(0, parseGenerationVersionNumber(version) - 1);
}

export function buildPreservedRequirements(
  blueprint: CommercialBlueprintCore,
  failingCategories: Set<string>
): string[] {
  const preserved: string[] = [];

  if (!failingCategories.has("narrative")) {
    preserved.push(
      `Narrative intent: ${blueprint.selectedConcept.coreIdea}`
    );
    preserved.push(
      `Emotional progression: ${blueprint.selectedConcept.emotionalDirection}`
    );
    if (blueprint.editorialPlan?.storyStructure) {
      preserved.push(`Story structure: ${blueprint.editorialPlan.storyStructure}`);
    }
  }

  if (!failingCategories.has("treatment")) {
    preserved.push(`Visual style: ${blueprint.visualTreatment.visualStyle}`);
    preserved.push(`Lighting: ${blueprint.visualTreatment.lighting}`);
    preserved.push(`Camera language: ${blueprint.visualTreatment.cameraLanguage}`);
    preserved.push(`Environment: ${blueprint.visualTreatment.environment}`);
  }

  if (!failingCategories.has("brand")) {
    if (blueprint.brandStrategy?.tone) {
      preserved.push(`Brand tone: ${blueprint.brandStrategy.tone}`);
    }
    if (blueprint.brandStrategy?.visualIdentity) {
      preserved.push(`Brand visual identity: ${blueprint.brandStrategy.visualIdentity}`);
    }
  }

  if (!failingCategories.has("product")) {
    if (blueprint.productStrategy?.identityLock) {
      preserved.push(`Product identity: ${blueprint.productStrategy.identityLock}`);
    }
  }

  if (!failingCategories.has("ending")) {
    if (blueprint.productStrategy?.finalCtaFrame) {
      preserved.push(`Ending structure: ${blueprint.productStrategy.finalCtaFrame}`);
    }
  }

  preserved.push(`Campaign objective: ${blueprint.creativeStrategy && "campaignGoal" in blueprint.creativeStrategy ? blueprint.creativeStrategy.campaignGoal : "per brief"}`);
  preserved.push(`Concept title: ${blueprint.selectedConcept.title}`);

  return preserved;
}

export function buildRequiredChanges(issues: VisualObservation[]): string[] {
  return issues.map((issue) => {
    const when =
      issue.timestamp != null ? ` (near t=${issue.timestamp}s)` : "";
    return `[${issue.category}/${issue.severity}]${when} ${issue.observation}. Correction: address the evidenced problem while preserving approved creative direction. Evidence: ${issue.evidence}`;
  });
}

export function buildRegenerationPlan(input: {
  decision: CommercialQCDecision;
  reason: string;
  issues: VisualObservation[];
  blueprint: CommercialBlueprintCore;
  sourceGenerationVersion: string;
  priorRegenerationCount: number;
  maxAutoRegenerations?: number;
  target?: RegenerationPlan["target"];
}): RegenerationPlan | undefined {
  if (input.decision !== "regenerate") {
    return undefined;
  }

  const max = input.maxAutoRegenerations ?? DEFAULT_MAX_AUTO_REGENERATIONS;
  if (input.priorRegenerationCount >= max) {
    return undefined;
  }

  const failingCategories = new Set(input.issues.map((i) => i.category));
  // Map treatment-related categories
  for (const c of ["camera", "environment", "composition"] as const) {
    if (failingCategories.has(c)) failingCategories.add("treatment");
  }
  if (failingCategories.has("character")) failingCategories.add("continuity");

  return {
    reason: input.reason,
    target: input.target ?? "campaign",
    issues: input.issues,
    requiredChanges: buildRequiredChanges(input.issues),
    preservedRequirements: buildPreservedRequirements(
      input.blueprint,
      failingCategories
    ),
    sourceGenerationVersion: input.sourceGenerationVersion,
    generationVersion: nextGenerationVersion(input.sourceGenerationVersion),
    priorRegenerationCount: input.priorRegenerationCount,
  };
}

export function appendRegenerationHistory(
  history: RegenerationHistoryEntry[] | undefined,
  entry: RegenerationHistoryEntry
): RegenerationHistoryEntry[] {
  return [...(history || []), entry];
}

export function regenerationLimitReached(
  priorCount: number,
  max: number = DEFAULT_MAX_AUTO_REGENERATIONS
): boolean {
  return priorCount >= max;
}

/**
 * Build a prompt fragment for the next generation from a RegenerationPlan.
 * Callers append this to the campaign compiler / executor path — this module
 * does not invoke providers.
 */
export function formatRegenerationInstruction(plan: RegenerationPlan): string {
  return [
    "TARGETED REGENERATION (preserve creative DNA)",
    `From: ${plan.sourceGenerationVersion} → ${plan.generationVersion}`,
    `Reason: ${plan.reason}`,
    "",
    "Problems to correct:",
    ...plan.requiredChanges.map((c) => `- ${c}`),
    "",
    "MUST PRESERVE (do not redesign):",
    ...plan.preservedRequirements.map((p) => `- ${p}`),
  ].join("\n");
}
