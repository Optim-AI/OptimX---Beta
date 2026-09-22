/**
 * Parse / validate visual analyzer structured output.
 */

import {
  QC_SEVERITIES,
  VISUAL_OBSERVATION_CATEGORIES,
  type CommercialVisualAnalysis,
  type VisualObservation,
  type VisualObservationCategory,
  type QCSeverity,
} from "./types";

export class VisualAnalysisParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisualAnalysisParseError";
  }
}

function isCategory(v: unknown): v is VisualObservationCategory {
  return (
    typeof v === "string" &&
    (VISUAL_OBSERVATION_CATEGORIES as readonly string[]).includes(v)
  );
}

function isSeverity(v: unknown): v is QCSeverity {
  return typeof v === "string" && (QC_SEVERITIES as readonly string[]).includes(v);
}

export function parseVisualObservation(
  raw: unknown,
  durationSeconds?: number
): VisualObservation {
  if (!raw || typeof raw !== "object") {
    throw new VisualAnalysisParseError("Observation is not an object");
  }
  const o = raw as Record<string, unknown>;
  if (!isCategory(o.category)) {
    throw new VisualAnalysisParseError(
      `Unsupported observation category: ${String(o.category)}`
    );
  }
  if (!isSeverity(o.severity)) {
    throw new VisualAnalysisParseError(
      `Invalid severity: ${String(o.severity)}`
    );
  }
  if (typeof o.observation !== "string" || !o.observation.trim()) {
    throw new VisualAnalysisParseError("observation text required");
  }
  if (typeof o.evidence !== "string" || !o.evidence.trim()) {
    throw new VisualAnalysisParseError("evidence text required");
  }
  const confidence = Number(o.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new VisualAnalysisParseError(
      `confidence must be 0–1, got ${String(o.confidence)}`
    );
  }

  let timestamp: number | undefined;
  if (o.timestamp != null && o.timestamp !== "") {
    const t = Number(o.timestamp);
    if (!Number.isFinite(t)) {
      throw new VisualAnalysisParseError(`Invalid timestamp: ${String(o.timestamp)}`);
    }
    if (durationSeconds != null && (t < 0 || t > durationSeconds + 0.5)) {
      throw new VisualAnalysisParseError(
        `Timestamp ${t} outside duration ${durationSeconds}`
      );
    }
    timestamp = t;
  }

  return {
    category: o.category,
    severity: o.severity,
    timestamp,
    observation: o.observation.trim(),
    evidence: o.evidence.trim(),
    confidence,
  };
}

export function parseVisualAnalysisPayload(
  raw: unknown,
  durationSeconds?: number
): Pick<CommercialVisualAnalysis, "observations" | "analyzerConfidence"> {
  if (!raw || typeof raw !== "object") {
    throw new VisualAnalysisParseError("Visual analysis payload must be an object");
  }
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.observations)) {
    throw new VisualAnalysisParseError("observations array required");
  }

  const observations = data.observations.map((item) =>
    parseVisualObservation(item, durationSeconds)
  );

  let analyzerConfidence: number | undefined;
  if (data.analyzerConfidence != null) {
    const c = Number(data.analyzerConfidence);
    if (!Number.isFinite(c) || c < 0 || c > 1) {
      throw new VisualAnalysisParseError("analyzerConfidence must be 0–1");
    }
    analyzerConfidence = c;
  } else if (observations.length > 0) {
    analyzerConfidence =
      observations.reduce((s, o) => s + o.confidence, 0) / observations.length;
  }

  return { observations, analyzerConfidence };
}

/**
 * Low-confidence findings must not be promoted to critical for auto decisions.
 * Returns a copy with severity capped to warning when confidence is below threshold.
 */
export function demoteLowConfidenceCritical(
  observations: VisualObservation[],
  minConfidenceForCritical: number
): VisualObservation[] {
  return observations.map((o) => {
    if (
      (o.severity === "critical" || o.severity === "error") &&
      o.confidence < minConfidenceForCritical
    ) {
      return {
        ...o,
        severity: "warning" as const,
        observation: `${o.observation} [severity demoted: confidence ${o.confidence} < ${minConfidenceForCritical}]`,
      };
    }
    return o;
  });
}
