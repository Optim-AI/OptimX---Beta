/**
 * Creative / product / brand / narrative / continuity / ending / treatment evaluation.
 * Maps visual observations + blueprint/shot-plan intent into category statuses.
 *
 * Absence ≠ failure when product was not required.
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { ShotPlan } from "../shot-planner/types";
import type {
  CategoryEvaluation,
  CommercialVisualAnalysis,
  CreativeEvaluationResult,
  QCStatus,
  VisualObservation,
  VisualObservationCategory,
} from "./types";

function worstStatus(a: QCStatus, b: QCStatus): QCStatus {
  const rank: Record<QCStatus, number> = {
    pass: 0,
    not_applicable: 0,
    insufficient_evidence: 1,
    warning: 2,
    fail: 3,
  };
  return rank[a] >= rank[b] ? a : b;
}

function statusFromObservations(
  observations: VisualObservation[],
  opts?: { notApplicable?: boolean }
): QCStatus {
  if (opts?.notApplicable) return "not_applicable";
  if (observations.length === 0) return "pass";

  const material = observations.filter(
    (o) => o.severity === "error" || o.severity === "critical"
  );
  if (material.length > 0) {
    const allLowConf = material.every((o) => o.confidence < 0.7);
    if (allLowConf) return "insufficient_evidence";
    return "fail";
  }
  if (observations.some((o) => o.severity === "warning")) return "warning";
  return "pass";
}

function byCategory(
  observations: VisualObservation[],
  categories: VisualObservationCategory[]
): VisualObservation[] {
  const set = new Set(categories);
  return observations.filter((o) => set.has(o.category));
}

function evalCategory(
  observations: VisualObservation[],
  categories: VisualObservationCategory[],
  summaryPass: string,
  opts?: { notApplicable?: boolean; naReason?: string }
): CategoryEvaluation {
  const findings = byCategory(observations, categories);
  if (opts?.notApplicable) {
    return {
      status: "not_applicable",
      findings,
      summary: opts.naReason || "Not applicable for this campaign",
    };
  }
  const status = statusFromObservations(findings);
  const summary =
    status === "pass"
      ? summaryPass
      : status === "fail"
        ? findings
            .filter((f) => f.severity === "error" || f.severity === "critical")
            .map((f) => f.observation)
            .join("; ") || "Category failed"
        : status === "insufficient_evidence"
          ? "Insufficient confidence to decide"
          : findings
              .filter((f) => f.severity === "warning")
              .map((f) => f.observation)
              .join("; ") || "Warnings present";
  return { status, findings, summary };
}

/**
 * Whether any beat/shot requires visible product (not none/implied).
 */
export function campaignRequiresVisibleProduct(
  blueprint: CommercialBlueprintCore,
  shotPlan: ShotPlan
): boolean {
  const beatRequires = (blueprint.visualBeats || []).some((b) => {
    const v = b.productVisibility;
    if (v === "none" || v === "implied") return false;
    if (b.productVisible === true) return true;
    return Boolean(v);
  });
  const shotRequires = shotPlan.shots.some((s) => {
    const v = s.productVisibility;
    return (
      v === "hero" ||
      v === "prominent" ||
      v === "in-use" ||
      v === "pack-shot" ||
      v === "partial"
    );
  });
  return beatRequires || shotRequires;
}

export function evaluateCreativeCategories(input: {
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
  visual: CommercialVisualAnalysis;
}): CreativeEvaluationResult {
  const observations = input.visual.observations || [];
  const productRequired = campaignRequiresVisibleProduct(
    input.blueprint,
    input.shotPlan
  );

  // If visual unavailable, mark categories insufficient rather than inventing pass/fail
  if (!input.visual.available) {
    const insufficient = (summary: string): CategoryEvaluation => ({
      status: "insufficient_evidence",
      findings: [],
      summary,
    });
    return {
      product: productRequired
        ? insufficient("Visual analysis unavailable — product fidelity not verified")
        : {
            status: "not_applicable",
            findings: [],
            summary: "Product visibility not required for all beats; visual unavailable",
          },
      brand: insufficient("Visual analysis unavailable"),
      narrative: insufficient("Visual analysis unavailable"),
      continuity: insufficient("Visual analysis unavailable"),
      treatment: insufficient("Visual analysis unavailable"),
      ending: insufficient("Visual analysis unavailable"),
      artifacts: insufficient("Visual analysis unavailable"),
    };
  }

  const product = evalCategory(
    observations,
    ["product"],
    productRequired
      ? "Product fidelity consistent with requirements where visibility intended"
      : "Product absence allowed where not required — no contradiction flagged",
    !productRequired &&
      !observations.some(
        (o) =>
          o.category === "product" &&
          (o.severity === "error" || o.severity === "critical")
      )
      ? undefined
      : undefined
  );

  // Explicit: product-not-visible info observations should not fail when not required
  if (
    !productRequired &&
    product.status === "fail" &&
    product.findings.every(
      (f) =>
        /absent|not visible|missing product/i.test(f.observation) &&
        f.severity !== "critical"
    )
  ) {
    product.status = "pass";
    product.summary =
      "Product absent where not required — not treated as failure";
  }

  const brandSpecified = Boolean(
    input.blueprint.brandStrategy?.visualIdentity ||
      input.blueprint.brandStrategy?.tone ||
      input.blueprint.brandStrategy?.doNotLookGeneric
  );

  const brand = evalCategory(
    observations,
    ["brand"],
    "Brand requirements satisfied where specified",
    !brandSpecified
      ? {
          notApplicable: true,
          naReason: "No brand visual requirements specified to evaluate",
        }
      : undefined
  );

  const narrative = evalCategory(
    observations,
    ["narrative"],
    "Narrative substantially follows intended beat progression"
  );

  const continuitySpecified =
    Boolean(input.blueprint.continuityLock) ||
    input.shotPlan.shots.some((s) => Boolean(s.continuity));

  const continuity = evalCategory(
    observations,
    ["continuity", "character"],
    "No meaningful continuity contradictions detected",
    !continuitySpecified
      ? {
          notApplicable: true,
          naReason: "No continuity requirements specified",
        }
      : undefined
  );

  const treatment = evalCategory(
    observations,
    ["treatment", "camera", "environment", "composition"],
    "Visual treatment broadly consistent with intended language"
  );

  const typographyDeferred = /no on-screen|post-?production|no text|optional/i.test(
    [
      input.blueprint.visualTreatment?.typographyDirection,
      input.blueprint.platformStrategy?.ctaStrategy,
      input.blueprint.productStrategy?.finalCtaFrame,
    ]
      .filter(Boolean)
      .join(" ")
  );

  let ending = evalCategory(
    observations,
    ["ending"],
    "Ending / resolve / product hero intent substantially present"
  );

  if (
    typographyDeferred &&
    ending.status === "fail" &&
    ending.findings.every((f) =>
      /cta|text|typography|caption|logo overlay/i.test(f.observation)
    )
  ) {
    ending = {
      status: "pass",
      findings: ending.findings,
      summary:
        "On-screen CTA/typography deferred to post-production — not a generation failure",
    };
  }

  const artifacts = evalCategory(
    observations,
    ["artifact"],
    "No material artifact failures relative to known risks"
  );

  return {
    product,
    brand,
    narrative,
    continuity,
    treatment,
    ending,
    artifacts,
  };
}

export function mergeCategoryStatus(
  creative: CreativeEvaluationResult
): Record<keyof CreativeEvaluationResult, QCStatus> {
  return {
    product: creative.product.status,
    brand: creative.brand.status,
    narrative: creative.narrative.status,
    continuity: creative.continuity.status,
    treatment: creative.treatment.status,
    ending: creative.ending.status,
    artifacts: creative.artifacts.status,
  };
}

export { worstStatus };
