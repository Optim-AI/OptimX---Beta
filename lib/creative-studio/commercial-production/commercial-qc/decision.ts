/**
 * QC decision engine — accept | regenerate | manual_review.
 * No overall quality score. Concrete findings only.
 */

import type {
  CommercialQCDecision,
  CreativeEvaluationResult,
  DeterministicQCResult,
  QCDecisionInput,
  QCDecisionResult,
  QCStatus,
  VisualObservation,
} from "./types";
import { DEFAULT_QC_THRESHOLDS } from "./types";

function materialFromCategory(
  status: QCStatus,
  findings: VisualObservation[],
  minConf: number
): VisualObservation[] {
  if (status !== "fail") return [];
  return findings.filter(
    (f) =>
      (f.severity === "error" || f.severity === "critical") &&
      f.confidence >= minConf
  );
}

function ambiguousFromCategory(
  status: QCStatus,
  findings: VisualObservation[],
  manualBelow: number
): VisualObservation[] {
  if (status === "insufficient_evidence") {
    return findings.length
      ? findings
      : [
          {
            category: "composition",
            severity: "warning",
            observation: "Insufficient visual evidence for category",
            evidence: "Visual analysis unavailable or low confidence",
            confidence: 0.4,
          },
        ];
  }
  return findings.filter(
    (f) =>
      (f.severity === "error" || f.severity === "critical") &&
      f.confidence < manualBelow
  );
}

export function decideCommercialQC(input: QCDecisionInput): QCDecisionResult {
  const thresholds = input.thresholds ?? DEFAULT_QC_THRESHOLDS;
  const minConf = thresholds.autoDecisionMinConfidence;
  const manualBelow = thresholds.manualReviewBelowConfidence;

  // Deterministic hard failure → regenerate if fixable via re-generation, else manual
  if (!input.deterministic.passed) {
    const hard = input.deterministic.checks.filter(
      (c) =>
        !c.passed && (c.severity === "critical" || c.severity === "error")
    );
    const missingAsset = hard.some((c) => c.check === "video_exists");
    const statusFail = hard.some((c) => c.check === "generation_status");

    if (missingAsset || statusFail) {
      if (input.regenerationCount >= input.maxAutoRegenerations) {
        return {
          decision: "manual_review",
          reason:
            "Deterministic generation failure and regeneration limit reached",
          materialFailures: [],
          ambiguousFindings: [],
        };
      }
      return {
        decision: "regenerate",
        reason: hard.map((c) => c.message).join("; "),
        materialFailures: hard.map((c) => ({
          category: "composition" as const,
          severity: "critical" as const,
          observation: c.message,
          evidence: `Deterministic check ${c.check} failed`,
          confidence: 1,
        })),
        ambiguousFindings: [],
      };
    }

    // Spec mismatches (duration/aspect/provider) — regenerate if budget remains
    if (input.regenerationCount >= input.maxAutoRegenerations) {
      return {
        decision: "manual_review",
        reason: "Deterministic QC failed and regeneration limit reached",
        materialFailures: [],
        ambiguousFindings: [],
      };
    }
    return {
      decision: "regenerate",
      reason: hard.map((c) => c.message).join("; "),
      materialFailures: hard.map((c) => ({
        category: "composition" as const,
        severity: "error" as const,
        observation: c.message,
        evidence: `Deterministic check ${c.check}`,
        confidence: 1,
      })),
      ambiguousFindings: [],
    };
  }

  const creative = input.creative;
  const materialFailures: VisualObservation[] = [
    ...materialFromCategory(creative.product.status, creative.product.findings, minConf),
    ...materialFromCategory(creative.narrative.status, creative.narrative.findings, minConf),
    ...materialFromCategory(creative.continuity.status, creative.continuity.findings, minConf),
    ...materialFromCategory(creative.artifacts.status, creative.artifacts.findings, minConf),
    ...materialFromCategory(creative.ending.status, creative.ending.findings, minConf),
    ...materialFromCategory(creative.treatment.status, creative.treatment.findings, minConf),
    ...materialFromCategory(creative.brand.status, creative.brand.findings, minConf),
  ];

  const ambiguousFindings: VisualObservation[] = [
    ...ambiguousFromCategory(creative.product.status, creative.product.findings, manualBelow),
    ...ambiguousFromCategory(creative.narrative.status, creative.narrative.findings, manualBelow),
    ...ambiguousFromCategory(creative.continuity.status, creative.continuity.findings, manualBelow),
    ...ambiguousFromCategory(creative.artifacts.status, creative.artifacts.findings, manualBelow),
    ...ambiguousFromCategory(creative.ending.status, creative.ending.findings, manualBelow),
    ...ambiguousFromCategory(creative.treatment.status, creative.treatment.findings, manualBelow),
    ...ambiguousFromCategory(creative.brand.status, creative.brand.findings, manualBelow),
  ];

  // Visual analyzer unavailable after deterministic pass:
  // - Not configured / skipped → accept (deterministic-only QC)
  // - Analyzer/sampling error → manual_review (do not regenerate blindly)
  if (!input.visual.available) {
    const err = (input.visual.error || "").toLowerCase();
    const skipped =
      !err ||
      err.includes("not configured") ||
      err.includes("skipped visual");
    if (skipped) {
      return {
        decision: "accept",
        reason:
          "Deterministic QC passed; visual analysis not configured (deterministic-only)",
        materialFailures: [],
        ambiguousFindings: [],
      };
    }
    return {
      decision: "manual_review",
      reason:
        input.visual.error ||
        "Visual analysis unavailable — human review required",
      materialFailures: [],
      ambiguousFindings,
    };
  }

  // Low overall analyzer confidence with any material-looking findings → manual
  if (
    input.visual.analyzerConfidence != null &&
    input.visual.analyzerConfidence < manualBelow &&
    (materialFailures.length > 0 ||
      ambiguousFindings.length > 0 ||
      Object.values(creative).some((c) => c.status === "insufficient_evidence"))
  ) {
    return {
      decision: "manual_review",
      reason: `Analyzer confidence ${input.visual.analyzerConfidence} below ${manualBelow}`,
      materialFailures: [],
      ambiguousFindings: [...ambiguousFindings, ...materialFailures],
    };
  }

  // Ambiguous / insufficient without clear high-confidence failures
  if (
    materialFailures.length === 0 &&
    (ambiguousFindings.length > 0 ||
      Object.values(creative).some((c) => c.status === "insufficient_evidence"))
  ) {
    return {
      decision: "manual_review",
      reason: "Ambiguous or low-confidence visual evidence",
      materialFailures: [],
      ambiguousFindings,
    };
  }

  if (materialFailures.length > 0) {
    if (input.regenerationCount >= input.maxAutoRegenerations) {
      return {
        decision: "manual_review",
        reason:
          "Material QC failures remain after regeneration limit — manual review required",
        materialFailures,
        ambiguousFindings,
      };
    }
    return {
      decision: "regenerate",
      reason: materialFailures.map((f) => f.observation).join("; "),
      materialFailures,
      ambiguousFindings,
    };
  }

  // Warnings alone → accept
  return {
    decision: "accept",
    reason: "Deterministic QC passed; no material creative/production failures",
    materialFailures: [],
    ambiguousFindings: [],
  };
}

export function decisionAllowsAccept(decision: CommercialQCDecision): boolean {
  return decision === "accept";
}

export function summarizeCreativeFailures(
  creative: CreativeEvaluationResult
): string[] {
  const out: string[] = [];
  for (const [key, cat] of Object.entries(creative) as [
    string,
    CreativeEvaluationResult[keyof CreativeEvaluationResult],
  ][]) {
    if (cat.status === "fail") {
      out.push(`${key}: ${cat.summary}`);
    }
  }
  return out;
}

export type { DeterministicQCResult };
