/**
 * Gemini Vision implementation of CommercialVisualAnalyzer.
 * Reuses getGeminiApiKey + fetchWithGeminiRateLimitRetry — no second Gemini client.
 *
 * Does NOT run in default automated tests (use MockVisualAnalyzer).
 */

import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
import { extractJsonObject, StructuredGenerationError } from "../commercial-director/llm";
import {
  buildRequirementsSummary,
  buildVisualQCUserPrompt,
  VISUAL_QC_SYSTEM_PROMPT,
} from "./prompts";
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
  SampledFrame,
} from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";

export interface GeminiVisualAnalyzerOptions {
  modelId?: string;
  apiKey?: string;
}

function frameToInlinePart(frame: SampledFrame): { text: string } | { inline_data: { mime_type: string; data: string } } {
  const ref = frame.imageRef;
  if (ref.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(ref);
    if (match) {
      return {
        inline_data: {
          mime_type: match[1] || frame.mimeType || "image/jpeg",
          data: match[2],
        },
      };
    }
  }
  // URL or mock placeholder — describe only (caller should prefer data URLs for live QC)
  return {
    text: `[Frame @ ${frame.timestamp}s imageRef=${ref.slice(0, 120)}${frame.isMock ? " (mock)" : ""}]`,
  };
}

export class GeminiVisualAnalyzer implements CommercialVisualAnalyzer {
  readonly id = "gemini_visual_analyzer";
  readonly modelId: string;
  private readonly apiKey: string | undefined;

  constructor(options: GeminiVisualAnalyzerOptions = {}) {
    this.modelId =
      options.modelId ||
      process.env.COMMERCIAL_QC_VISION_MODEL ||
      process.env.COMMERCIAL_DIRECTOR_MODEL ||
      DEFAULT_MODEL;
    this.apiKey = options.apiKey ?? getGeminiApiKey();
  }

  async analyze(
    input: CommercialVisualAnalysisInput
  ): Promise<CommercialVisualAnalysis> {
    if (!this.apiKey) {
      return {
        available: false,
        observations: [],
        error:
          "GEMINI_API_KEY (or GEMINI_VEO_API_KEY / NANO_API_KEY) required for visual QC",
        samplingPlan: input.samplingPlan,
      };
    }

    if (!input.frames.length) {
      return {
        available: false,
        observations: [],
        error: "No sampled frames provided for visual analysis",
        samplingPlan: input.samplingPlan,
      };
    }

    const requirementsSummary =
      input.requirementsSummary ||
      buildRequirementsSummary(input.blueprint, input.shotPlan);

    const userText = buildVisualQCUserPrompt({
      campaignId: input.campaignId,
      generationVersion: input.generationVersion,
      durationSeconds: input.durationSeconds,
      timestamps: input.samplingPlan.timestamps,
      requirementsSummary,
      blueprint: input.blueprint,
      shotPlan: input.shotPlan,
      hasProductReference: Boolean(input.productReference),
    });

    const parts: Array<Record<string, unknown>> = [{ text: userText }];

    if (input.productReference?.url) {
      parts.push({
        text: `Canonical product reference (authoritative over generated keyframes): ${input.productReference.url}`,
      });
      if (input.productReference.url.startsWith("data:")) {
        parts.push(frameToInlinePart({
          timestamp: -1,
          imageRef: input.productReference.url,
          mimeType: input.productReference.mimeType,
        }));
      }
    }

    for (const frame of input.frames) {
      parts.push({ text: `Sampled frame at t=${frame.timestamp}s:` });
      parts.push(frameToInlinePart(frame));
    }

    const body = {
      contents: [{ parts }],
      system_instruction: { parts: [{ text: VISUAL_QC_SYSTEM_PROMPT }] },
      generation_config: {
        temperature: 0.2,
        max_output_tokens: 4096,
        response_mime_type: "application/json",
      },
    };

    try {
      const response = await fetchWithGeminiRateLimitRetry(
        `${GEMINI_REST_BASE}/models/${this.modelId}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify(body),
        },
        { operationLabel: "commercial-qc:visual", maxRetries: 3 }
      );

      if (!response.ok) {
        const errText = await response.text();
        return {
          available: false,
          observations: [],
          error: `Gemini visual QC error ${response.status}: ${errText.slice(0, 300)}`,
          samplingPlan: input.samplingPlan,
          model: this.modelId,
        };
      }

      const json = await response.json();
      const rawText =
        json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text || "")
          .join("") || "";

      if (!rawText.trim()) {
        return {
          available: false,
          observations: [],
          error: "Gemini visual QC returned empty content",
          samplingPlan: input.samplingPlan,
          model: this.modelId,
        };
      }

      const parsedObj = extractJsonObject(rawText);
      const parsed = parseVisualAnalysisPayload(parsedObj, input.durationSeconds);
      const observations = demoteLowConfidenceCritical(
        parsed.observations,
        DEFAULT_QC_THRESHOLDS.autoDecisionMinConfidence
      );

      return {
        available: true,
        observations,
        analyzerConfidence: parsed.analyzerConfidence,
        model: this.modelId,
        samplingPlan: input.samplingPlan,
      };
    } catch (err) {
      const message =
        err instanceof VisualAnalysisParseError ||
        err instanceof StructuredGenerationError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unknown visual QC error";
      return {
        available: false,
        observations: [],
        error: message,
        samplingPlan: input.samplingPlan,
        model: this.modelId,
      };
    }
  }
}

export function createGeminiVisualAnalyzer(
  options?: GeminiVisualAnalyzerOptions
): GeminiVisualAnalyzer {
  return new GeminiVisualAnalyzer(options);
}
