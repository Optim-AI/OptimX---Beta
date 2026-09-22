/**
 * Gemini-backed StructuredGenerator for Commercial Director.
 * Uses existing getGeminiApiKey + fetchWithGeminiRateLimitRetry.
 *
 * Gemini 2.5 Flash can spend budget on "thinking" and return empty/truncated JSON.
 * We disable thinking for structured blueprint output and raise the token ceiling.
 */

import {
  GEMINI_API_KEY_SETUP_MESSAGE,
  GEMINI_REST_BASE,
  getGeminiApiKey,
  getGeminiApiKeySource,
} from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
import {
  extractJsonObject,
  StructuredGenerationError,
  type StructuredGenerationRequest,
  type StructuredGenerationResult,
  type StructuredGenerator,
} from "./llm";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_MAX_OUTPUT_TOKENS = 65536;

export interface GeminiStructuredGeneratorOptions {
  modelId?: string;
  apiKey?: string;
}

function humanizeGeminiHttpError(status: number, errText: string): string {
  const lower = errText.toLowerCase();
  if (
    status === 400 &&
    (lower.includes("api_key_invalid") ||
      lower.includes("api key not valid") ||
      lower.includes("invalid api key"))
  ) {
    return GEMINI_API_KEY_SETUP_MESSAGE;
  }
  if (status === 401 || status === 403) {
    return GEMINI_API_KEY_SETUP_MESSAGE;
  }
  if (status === 429) {
    return "The planning service is temporarily rate-limited. Please wait a moment and try again.";
  }
  return "We couldn't plan this commercial right now. Please try again in a moment.";
}

function extractCandidateText(json: unknown): {
  rawText: string;
  finishReason?: string;
  blockReason?: string;
} {
  const root = json as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      finishReason?: string;
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };

  const blockReason = root?.promptFeedback?.blockReason;
  const candidate = root?.candidates?.[0];
  const finishReason = candidate?.finishReason;

  const parts = candidate?.content?.parts || [];
  // Prefer non-thought parts when present (Gemini 2.5 thinking models)
  const textParts = parts.filter((p) => !p.thought && p.text);
  const rawText =
    (textParts.length ? textParts : parts)
      .map((p) => p.text || "")
      .join("") || "";

  return { rawText, finishReason, blockReason };
}

export class GeminiStructuredGenerator implements StructuredGenerator {
  readonly modelId: string;
  private readonly apiKey: string | undefined;

  constructor(options: GeminiStructuredGeneratorOptions = {}) {
    this.modelId = options.modelId || process.env.COMMERCIAL_DIRECTOR_MODEL || DEFAULT_MODEL;
    this.apiKey = options.apiKey ?? getGeminiApiKey();
  }

  async generateJson<T>(
    request: StructuredGenerationRequest
  ): Promise<StructuredGenerationResult<T>> {
    if (!this.apiKey) {
      throw new StructuredGenerationError(GEMINI_API_KEY_SETUP_MESSAGE);
    }

    const maxOutputTokens = request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS;

    const buildBody = (includeThinkingOff: boolean) => ({
      contents: [{ parts: [{ text: request.userPrompt }] }],
      system_instruction: { parts: [{ text: request.systemPrompt }] },
      generation_config: {
        temperature: request.temperature ?? 0.9,
        max_output_tokens: maxOutputTokens,
        response_mime_type: "application/json",
        ...(includeThinkingOff
          ? { thinking_config: { thinking_budget: 0 } }
          : {}),
      },
    });

    const callGemini = async (includeThinkingOff: boolean) =>
      fetchWithGeminiRateLimitRetry(
        `${GEMINI_REST_BASE}/models/${this.modelId}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey!,
          },
          body: JSON.stringify(buildBody(includeThinkingOff)),
        },
        { operationLabel: `commercial-director:${request.schemaName}`, maxRetries: 4 }
      );

    let response = await callGemini(true);
    if (!response.ok) {
      const errText = await response.text();
      // Some API revisions reject thinking_config — retry without it once
      if (
        response.status === 400 &&
        /thinking/i.test(errText)
      ) {
        console.warn(
          "[commercial-director] thinking_config rejected; retrying without it"
        );
        response = await callGemini(false);
        if (!response.ok) {
          const errText2 = await response.text();
          console.error(
            `[commercial-director] Gemini HTTP ${response.status} key=${getGeminiApiKeySource()}:`,
            errText2.slice(0, 400)
          );
          throw new StructuredGenerationError(
            humanizeGeminiHttpError(response.status, errText2)
          );
        }
      } else {
        console.error(
          `[commercial-director] Gemini HTTP ${response.status} key=${getGeminiApiKeySource()}:`,
          errText.slice(0, 400)
        );
        throw new StructuredGenerationError(
          humanizeGeminiHttpError(response.status, errText)
        );
      }
    }

    const json = await response.json();
    const { rawText, finishReason, blockReason } = extractCandidateText(json);

    if (!rawText.trim()) {
      console.error("[commercial-director] empty Gemini content", {
        schema: request.schemaName,
        model: this.modelId,
        finishReason: finishReason || null,
        blockReason: blockReason || null,
        keySource: getGeminiApiKeySource(),
        candidateKeys: json?.candidates?.[0]
          ? Object.keys(json.candidates[0])
          : [],
      });
      if (blockReason) {
        throw new StructuredGenerationError(
          "The commercial brief was blocked by the planning safety filter. Please adjust the product description and try again."
        );
      }
      if (finishReason === "MAX_TOKENS") {
        throw new StructuredGenerationError(
          request.schemaName.startsWith("shot-plan")
            ? "Shot planning ran out of space before finishing. Please try again."
            : "Commercial planning ran out of space before finishing. Please try again."
        );
      }
      throw new StructuredGenerationError(
        "We couldn't plan this commercial right now. Please try again."
      );
    }

    try {
      const data = extractJsonObject(rawText) as T;
      return { data, model: this.modelId, rawText };
    } catch (e) {
      console.error("[commercial-director] JSON parse failed", {
        schema: request.schemaName,
        model: this.modelId,
        finishReason: finishReason || null,
        preview: rawText.slice(0, 400),
        length: rawText.length,
      });
      if (finishReason === "MAX_TOKENS") {
        throw new StructuredGenerationError(
          request.schemaName.startsWith("shot-plan")
            ? "Shot planning ran out of space before finishing a valid plan. Please try again."
            : "Commercial planning ran out of space before finishing a valid plan. Please try again.",
          e
        );
      }
      throw new StructuredGenerationError(
        "We couldn't plan this commercial right now. Please try again.",
        e
      );
    }
  }
}

export function createDefaultStructuredGenerator(): StructuredGenerator {
  return new GeminiStructuredGenerator();
}
