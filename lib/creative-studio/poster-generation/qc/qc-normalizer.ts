/**
 * Merge deterministic + vision QC into canonical PosterQcResult — Phase 7.
 */

import type {
  PosterQcCheck,
  PosterQcChecks,
  PosterQcIssue,
  PosterQcResult,
  QcDecision,
  QcFailureType,
  QcRecommendedAction,
  QcResultStatus,
} from "../types";
import type { DeterministicQcResult } from "./deterministic-checks";
import type { PosterQcVisionEvaluation } from "./vision-evaluator";

function defaultPass(summary: string): PosterQcCheck {
  return { status: "pass", severity: "none", summary };
}

function worstStatus(
  a: PosterQcCheck["status"],
  b: PosterQcCheck["status"]
): PosterQcCheck["status"] {
  const rank = { pass: 0, warn: 1, fail: 2 };
  return rank[a] >= rank[b] ? a : b;
}

function decide(options: {
  checks: PosterQcChecks;
  issues: PosterQcIssue[];
  failureType: QcFailureType;
  visionAvailable: boolean;
}): {
  status: QcResultStatus;
  decision: QcDecision;
  recommendedAction: QcRecommendedAction;
  passed: boolean;
} {
  const criticalFails = options.issues.filter((i) => i.severity === "critical");
  const highFails = options.issues.filter((i) => i.severity === "high");
  const checkFails = Object.values(options.checks).filter((c) => c.status === "fail");

  const productFail = options.checks.productFidelity.status === "fail";
  const copyFail = options.checks.copyAccuracy.status === "fail";
  const claimFail = options.checks.claimSafety.status === "fail";
  const conceptFail = options.checks.conceptExecution.status === "fail";
  const techFail = options.checks.technicalQuality.status === "fail";

  // Specification failure: image may look fine but plan was wrong — recommend review, not blind regen
  if (options.failureType === "specification" && !techFail && !productFail) {
    return {
      status: "fail",
      decision: "regenerate",
      recommendedAction: "review",
      passed: false,
    };
  }

  if (techFail || criticalFails.length) {
    return {
      status: "fail",
      decision: "regenerate",
      recommendedAction: "regenerate",
      passed: false,
    };
  }

  if (productFail || copyFail || claimFail || conceptFail) {
    return {
      status: "regenerate",
      decision: "regenerate",
      recommendedAction: "regenerate",
      passed: false,
    };
  }

  if (checkFails.length || highFails.length) {
    const localCategories = new Set(["copy", "text", "design", "composition"]);
    const onlyLocal = options.issues.every((i) => localCategories.has(i.category));
    if (onlyLocal && !productFail) {
      return {
        status: "fix_local",
        decision: "fix",
        recommendedAction: "local_fix",
        passed: false,
      };
    }
    return {
      status: "regenerate",
      decision: "regenerate",
      recommendedAction: "regenerate",
      passed: false,
    };
  }

  const hasWarn =
    Object.values(options.checks).some((c) => c.status === "warn") ||
    options.issues.some((i) => i.severity === "medium" || i.severity === "low");

  if (hasWarn && !options.visionAvailable) {
    return {
      status: "pass",
      decision: "pass",
      recommendedAction: "review",
      passed: true,
    };
  }

  return {
    status: "pass",
    decision: "pass",
    recommendedAction: hasWarn ? "review" : "accept",
    passed: true,
  };
}

export function buildPosterQcResult(options: {
  generationId: string;
  assetId: string;
  deterministic: DeterministicQcResult;
  vision: PosterQcVisionEvaluation | null;
}): PosterQcResult {
  const { deterministic, vision } = options;

  const checks: PosterQcChecks = {
    productFidelity:
      vision?.checks.productFidelity ||
      defaultPass(deterministic.skipVision ? "Skipped — technical failure" : "Not evaluated"),
    copyAccuracy:
      vision?.checks.copyAccuracy ||
      defaultPass(deterministic.skipVision ? "Skipped — technical failure" : "Not evaluated"),
    visualHierarchy:
      vision?.checks.visualHierarchy || defaultPass("Not evaluated"),
    composition: vision?.checks.composition || defaultPass("Not evaluated"),
    conceptExecution:
      vision?.checks.conceptExecution || defaultPass("Not evaluated"),
    strategyAlignment:
      vision?.checks.strategyAlignment || defaultPass("Not evaluated"),
    brandCompliance:
      vision?.checks.brandCompliance || defaultPass("Not evaluated"),
    referenceCompliance:
      vision?.checks.referenceCompliance || defaultPass("Not evaluated"),
    technicalQuality: deterministic.technicalCheck,
    artifactDetection:
      vision?.checks.artifactDetection || defaultPass("Not evaluated"),
    claimSafety: vision?.checks.claimSafety || defaultPass("Not evaluated"),
  };

  // If vision unavailable but tech passed — mark visual checks as warn/insufficient
  if (vision && !vision.available && !deterministic.skipVision) {
    for (const key of Object.keys(checks) as (keyof PosterQcChecks)[]) {
      if (key === "technicalQuality") continue;
      checks[key] = {
        status: "warn",
        severity: "medium",
        summary: vision.error || "Vision QC unavailable",
      };
    }
  }

  const issues: PosterQcIssue[] = [
    ...deterministic.issues,
    ...(vision?.issues || []),
  ];
  const warnings: PosterQcIssue[] = [
    ...deterministic.warnings,
    ...(vision?.warnings || []),
  ];

  let failureType: QcFailureType = vision?.failureType || "none";
  if (deterministic.skipVision) failureType = "technical";

  const decision = decide({
    checks,
    issues,
    failureType,
    visionAvailable: !!vision?.available,
  });

  const summary =
    vision?.summary ||
    (deterministic.skipVision
      ? "Technical QC failed — vision skipped"
      : "Deterministic QC passed");

  const recommendedFixes = [
    ...issues,
    ...warnings,
  ]
    .map((i) => i.recommendedFix)
    .filter((x): x is string => !!x?.trim())
    .slice(0, 10);

  return {
    id: `qc_${Math.random().toString(36).slice(2, 10)}`,
    generationId: options.generationId,
    assetId: options.assetId,
    createdAt: new Date().toISOString(),
    passed: decision.passed,
    decision: decision.decision,
    status: decision.status,
    recommendedAction: decision.recommendedAction,
    summary,
    confidence: vision?.available ? vision.confidence : deterministic.passed ? 0.5 : 0.9,
    failureType,
    checks,
    score: null,
    issues,
    warnings,
    recommendedFixes,
  };
}

export { worstStatus };
