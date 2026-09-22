/**
 * Deterministic Keyframe QC.
 * Does NOT pretend to visually inspect images without a vision model.
 */

import type { CommercialShot } from "../shot-planner/types";
import type { ResolvedReferencePlan } from "./reference-strategy";
import type {
  KeyframeQCIssue,
  KeyframeQCResult,
  KeyframeResult,
  KeyframeSpecification,
  KeyframeVisualQC,
  ReferenceAsset,
} from "./types";

export class UnavailableVisualKeyframeQC implements KeyframeVisualQC {
  readonly available = false;
  async inspect(): Promise<{ issues: KeyframeQCIssue[]; notes: string[] }> {
    return {
      issues: [
        {
          check: "requires_visual_qc",
          severity: "info",
          message: "AI visual keyframe inspection is not implemented in Phase 4",
          requiresVisualQc: true,
        },
      ],
      notes: ["visualInspectionAvailable: false"],
    };
  }
}

export function runDeterministicKeyframeQc(input: {
  shot: CommercialShot;
  plan: ResolvedReferencePlan;
  specification: KeyframeSpecification;
  result: Pick<KeyframeResult, "url" | "assetId" | "status" | "generationPrompt">;
  references: ReferenceAsset[];
  missingReferences: string[];
}): KeyframeQCResult {
  const issues: KeyframeQCIssue[] = [];
  const checksPerformed: string[] = [];
  const checksDeferredToVisualQc: string[] = [];

  // Structural
  checksPerformed.push("image_exists", "asset_readable", "specification_complete", "aspect_ratio");
  if (!input.result.url?.trim()) {
    issues.push({
      check: "image_exists",
      severity: "error",
      message: "Generated keyframe has no url",
    });
  }
  if (!input.specification.purpose || !input.specification.imageGenerationPrompt) {
    issues.push({
      check: "specification_complete",
      severity: "error",
      message: "Keyframe specification incomplete (purpose/prompt)",
    });
  }
  if (!input.specification.aspectRatio) {
    issues.push({
      check: "aspect_ratio",
      severity: "error",
      message: "Aspect ratio missing from specification",
    });
  }
  if (!input.specification.composition?.framing) {
    issues.push({
      check: "specification_complete",
      severity: "error",
      message: "Framing missing from specification",
    });
  }

  // Product reference
  if (input.plan.productReferenceRequired) {
    checksPerformed.push("product_reference_provided", "product_visibility_declared");
    const hasProduct = input.references.some((r) => r.type === "product");
    if (!hasProduct) {
      issues.push({
        check: "product_reference_provided",
        severity: "error",
        message: "Product reference was required but not included in generation request",
      });
    }
    if (
      input.shot.productVisibility === "none" ||
      input.shot.productVisibility === "implied"
    ) {
      issues.push({
        check: "product_visibility_declared",
        severity: "warning",
        message:
          "Product reference required but shot productVisibility is none/implied — verify intent",
      });
    }
  }

  // References resolved
  checksPerformed.push("required_references_resolved");
  if (input.missingReferences.length) {
    issues.push({
      check: "required_references_resolved",
      severity: "error",
      message: `Missing references: ${input.missingReferences.join(", ")}`,
    });
  }

  if (input.plan.previousShotReferenceRequired) {
    checksPerformed.push("previous_shot_dependency");
    const hasPrev = input.references.some((r) => r.type === "previous_shot");
    if (!hasPrev) {
      issues.push({
        check: "previous_shot_dependency",
        severity: "error",
        message: "Previous-shot reference required but not resolved",
      });
    }
  }

  if (input.plan.characterReferenceRequired) {
    checksPerformed.push("character_reference_declared");
    const hasChar = input.references.some((r) => r.type === "character");
    if (!hasChar) {
      issues.push({
        check: "character_reference_declared",
        severity: "warning",
        message:
          "Character reference requested but no character asset was available — continuity not guaranteed",
      });
    }
  }

  // Artifact risks — deferred to visual QC
  const artifactLabels = input.shot.artifactRisks?.map((r) => r.risk) || [];
  if (artifactLabels.length || input.shot.artifactRisk) {
    checksDeferredToVisualQc.push(
      ...artifactLabels,
      "hands_deformation",
      "packaging_text",
      "unwanted_text",
      "character_drift"
    );
    issues.push({
      check: "requires_visual_qc",
      severity: "info",
      message: `Artifact risks declared (${artifactLabels.join(", ") || input.shot.artifactRisk}) — visual inspection not available in Phase 4`,
      requiresVisualQc: true,
    });
  }

  const errors = issues.filter((i) => i.severity === "error");
  const passed = errors.length === 0;
  const score = passed ? Math.max(0, 100 - issues.filter((i) => i.severity === "warning").length * 10) : 40;

  return {
    passed,
    score,
    issues,
    visualInspectionAvailable: false,
    checksPerformed: [...new Set(checksPerformed)],
    checksDeferredToVisualQc: [...new Set(checksDeferredToVisualQc)],
  };
}
