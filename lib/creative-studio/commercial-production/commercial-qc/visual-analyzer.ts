/**
 * CommercialVisualAnalyzer abstraction + mock implementation for tests.
 */

import { extractJsonObject } from "../commercial-director/llm";
import {
  demoteLowConfidenceCritical,
  parseVisualAnalysisPayload,
  VisualAnalysisParseError,
} from "./validate";
import { DEFAULT_QC_THRESHOLDS } from "./types";
import type {
  CommercialVisualAnalysis,
  CommercialVisualAnalysisInput,
  CommercialVisualAnalyzer,
  VisualObservation,
} from "./types";

export class MockVisualAnalyzer implements CommercialVisualAnalyzer {
  readonly id = "mock_visual_analyzer";
  calls: CommercialVisualAnalysisInput[] = [];
  nextResult: CommercialVisualAnalysis | null = null;
  nextRawPayload: unknown = null;
  failParse = false;

  async analyze(
    input: CommercialVisualAnalysisInput
  ): Promise<CommercialVisualAnalysis> {
    this.calls.push(input);

    if (this.failParse) {
      return {
        available: false,
        observations: [],
        error: "Mock parse failure",
      };
    }

    if (this.nextResult) {
      return this.nextResult;
    }

    if (this.nextRawPayload != null) {
      try {
        const parsed = parseVisualAnalysisPayload(
          this.nextRawPayload,
          input.durationSeconds
        );
        const observations = demoteLowConfidenceCritical(
          parsed.observations,
          DEFAULT_QC_THRESHOLDS.autoDecisionMinConfidence
        );
        return {
          available: true,
          observations,
          analyzerConfidence: parsed.analyzerConfidence,
          model: this.id,
          samplingPlan: input.samplingPlan,
        };
      } catch (err) {
        return {
          available: false,
          observations: [],
          error:
            err instanceof VisualAnalysisParseError
              ? err.message
              : "Failed to parse visual analysis",
          samplingPlan: input.samplingPlan,
        };
      }
    }

    // Default clean pass — no material failures
    const observations: VisualObservation[] = [
      {
        category: "narrative",
        severity: "info",
        observation: "Sampled frames are consistent with intended beat progression",
        evidence: "Mock analyzer default: narrative structure appears preserved",
        confidence: 0.9,
        timestamp: input.samplingPlan.timestamps[Math.floor(input.samplingPlan.timestamps.length / 2)],
      },
      {
        category: "product",
        severity: "info",
        observation: "Product presence aligns with visibility intent where sampled",
        evidence: "Mock analyzer default: no product contradiction detected",
        confidence: 0.88,
      },
    ];

    return {
      available: true,
      observations,
      analyzerConfidence: 0.9,
      model: this.id,
      samplingPlan: input.samplingPlan,
    };
  }
}

/** Helper for tests that want to feed JSON-like payloads through the same parse path. */
export function analysisFromJsonText(
  text: string,
  durationSeconds: number
): CommercialVisualAnalysis {
  const raw = extractJsonObject(text);
  const parsed = parseVisualAnalysisPayload(raw, durationSeconds);
  return {
    available: true,
    observations: parsed.observations,
    analyzerConfidence: parsed.analyzerConfidence,
  };
}

export type { CommercialVisualAnalyzer, CommercialVisualAnalysisInput };
