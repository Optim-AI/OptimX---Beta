/**
 * Artifact risk evaluation — uses Commercial Director / Shot Planner artifact metadata.
 * Does not invent an arbitrary AI-artifact taxonomy.
 */

import type { CommercialBlueprintCore } from "../commercial-director/types";
import type { ShotPlan, ShotArtifactRisk } from "../shot-planner/types";
import type {
  CategoryEvaluation,
  CommercialVisualAnalysis,
  VisualObservation,
} from "./types";

function riskKeywords(risk: {
  category?: string;
  description?: string;
  risk?: string;
}): RegExp {
  const words = [
    (risk.category || risk.risk || "").replace(/_/g, " "),
    ...(risk.description || risk.risk || "")
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 4),
  ];
  return new RegExp(words.slice(0, 6).join("|"), "i");
}

/**
 * Correlate visual artifact observations with known blueprint artifact risks.
 * Unknown observations in category "artifact" are still retained.
 */
export function evaluateArtifacts(input: {
  blueprint: CommercialBlueprintCore;
  shotPlan: ShotPlan;
  visual: CommercialVisualAnalysis;
}): CategoryEvaluation {
  const risks = input.blueprint.artifactRisks || [];
  const shotRisks: ShotArtifactRisk[] = input.shotPlan.shots.flatMap(
    (s) => s.artifactRisks || []
  );

  const artifactObs = (input.visual.observations || []).filter(
    (o) => o.category === "artifact"
  );

  if (!input.visual.available) {
    return {
      status: "insufficient_evidence",
      findings: [],
      summary: "Visual analysis unavailable — artifact risks not verified",
    };
  }

  const allRiskCount = risks.length + shotRisks.length;

  if (artifactObs.length === 0) {
    return {
      status: "pass",
      findings: [],
      summary:
        allRiskCount > 0
          ? `No artifact observations; ${allRiskCount} known risk(s) monitored`
          : "No artifact observations and no listed risks",
    };
  }

  const enriched: VisualObservation[] = artifactObs.map((o) => {
    const matchedBlueprint = risks.find((r) =>
      riskKeywords({ category: r.category, description: r.description }).test(
        o.observation + " " + o.evidence
      )
    );
    const matchedShot = shotRisks.find((r) =>
      riskKeywords({ risk: r.risk, description: r.reason }).test(
        o.observation + " " + o.evidence
      )
    );
    if (matchedBlueprint) {
      return {
        ...o,
        observation: `${o.observation} (matches known risk ${matchedBlueprint.id}: ${matchedBlueprint.category})`,
      };
    }
    if (matchedShot) {
      return {
        ...o,
        observation: `${o.observation} (matches shot risk ${matchedShot.id}: ${matchedShot.risk})`,
      };
    }
    return o;
  });

  const critical = enriched.filter(
    (o) => o.severity === "critical" || o.severity === "error"
  );
  if (critical.length > 0) {
    const highConf = critical.filter((o) => o.confidence >= 0.7);
    if (highConf.length === 0) {
      return {
        status: "insufficient_evidence",
        findings: enriched,
        summary: "Artifact concerns present but confidence too low for auto-fail",
      };
    }
    return {
      status: "fail",
      findings: enriched,
      summary: highConf.map((o) => o.observation).join("; "),
    };
  }

  if (enriched.some((o) => o.severity === "warning")) {
    return {
      status: "warning",
      findings: enriched,
      summary: "Artifact warnings only — acceptable for accept with caveats",
    };
  }

  return {
    status: "pass",
    findings: enriched,
    summary: "Artifact observations informational only",
  };
}
