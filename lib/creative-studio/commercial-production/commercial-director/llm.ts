/**
 * Small structured-generation interface for the Commercial Director.
 *
 * Reuses existing Gemini REST + retry infrastructure (`lib/gemini-config`,
 * `lib/gemini-retry`). Callers depend on StructuredGenerator, not Gemini SDK.
 */

export interface StructuredGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  /** Logical schema name for logs / repair context. */
  schemaName: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StructuredGenerationResult<T> {
  data: T;
  model: string;
  rawText: string;
}

export interface StructuredGenerator {
  readonly modelId: string;
  generateJson<T>(request: StructuredGenerationRequest): Promise<StructuredGenerationResult<T>>;
}

export class StructuredGenerationError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "StructuredGenerationError";
  }
}

/** Extract JSON object from model text (handles optional fences). */
export function extractJsonObject(text: string): unknown {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new StructuredGenerationError("Model response was not valid JSON");
  }
}
