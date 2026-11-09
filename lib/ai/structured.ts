/**
 * Structured JSON from Gemini, checked against a Zod schema. Used by the AI insights panel,
 * the Ad Studio chat, kept-poster ad copy and test-pack angles.
 *
 * - The schema is sent as JSON Schema (responseJsonSchema) and the reply is validated with Zod.
 *   If a model rejects the schema, the call is repeated with the schema written into the prompt.
 * - Conversations are append-only: retries add the model's answer and a correction message.
 * - Falls back to an older Flash model when the preferred one is missing or overloaded.
 * Server-only.
 */
import * as z from 'zod/v4';
import { GEMINI_REST_BASE, getGeminiApiKey } from '@/lib/gemini-config';
import { fetchWithGeminiRateLimitRetry } from '@/lib/gemini-retry';

/** AI_TEXT_MODEL overrides the default for every structured call. */
export const AI_TEXT_MODEL = () => process.env.AI_TEXT_MODEL?.trim() || 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash'];

export type AiImage = { mediaType: string; data: string };
export type AiPart = { text: string } | { image: AiImage };
export type AiMessage = { role: 'user' | 'model'; parts: AiPart[] };

export type StructuredRequest<S extends z.ZodType> = {
  system: string;
  messages: AiMessage[];
  schema: S;
  /** low: quick replies (chat, copy). medium: analysis that needs more thought. */
  effort: 'low' | 'medium';
  maxTokens?: number;
  timeoutMs?: number;
  label: string;
};

export type StructuredResult<T> = {
  /** Validated output, or null when the model refused, was cut off or returned invalid JSON. */
  data: T | null;
  stop: 'ok' | 'refusal' | 'cut_off' | 'invalid';
  /** The raw text, to append to the conversation for a retry. */
  text: string;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

export interface StructuredClient {
  generate<S extends z.ZodType>(req: StructuredRequest<S>): Promise<StructuredResult<z.infer<S>>>;
}

export class AiNotConfiguredError extends Error {}
export class AiRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export function aiConfigured(): boolean {
  return !!getGeminiApiKey();
}

/** JSON Schema for Gemini: drop keys its schema subset doesn't take. */
export function geminiSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) if (k !== '$schema' && k !== 'additionalProperties') out[k] = strip(val);
      return out;
    }
    return v;
  };
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>;
}

function thinkingConfig(model: string, effort: 'low' | 'medium') {
  if (/gemini-2\.5/.test(model)) return { thinkingBudget: effort === 'low' ? 512 : 4096 };
  return { thinkingLevel: effort === 'low' ? 'low' : 'high' };
}

/** Pull the JSON object out of model text (handles ``` fences and stray prose). */
export function parseJsonText(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

const toGeminiPart = (p: AiPart) => ('text' in p ? { text: p.text } : { inlineData: { mimeType: p.image.mediaType, data: p.image.data } });

const REFUSALS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);

async function callGemini(model: string, body: unknown, timeoutMs: number, label: string): Promise<any> {
  const key = getGeminiApiKey();
  if (!key) throw new AiNotConfiguredError('GEMINI_API_KEY is not configured');
  const res = await fetchWithGeminiRateLimitRetry(
    `${GEMINI_REST_BASE}/models/${model}:generateContent`,
    { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) },
    { maxRetries: 2, operationLabel: label },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AiRequestError(`Gemini ${model} ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  return res.json();
}

export const geminiStructured: StructuredClient = {
  async generate(req) {
    const preferred = AI_TEXT_MODEL();
    const models = [...new Set([preferred, ...FALLBACK_MODELS])];
    const jsonSchema = geminiSchema(req.schema);
    const contents = req.messages.map((m) => ({ role: m.role, parts: m.parts.map(toGeminiPart) }));
    const build = (model: string, withSchema: boolean) => ({
      systemInstruction: {
        parts: [{ text: withSchema ? req.system : `${req.system}\n\nReply with only a JSON object matching this JSON Schema:\n${JSON.stringify(jsonSchema)}` }],
      },
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: req.maxTokens ?? 16000,
        responseMimeType: 'application/json',
        ...(withSchema ? { responseJsonSchema: jsonSchema } : {}),
        thinkingConfig: thinkingConfig(model, req.effort),
      },
    });

    let lastError: unknown;
    for (const model of models) {
      for (const withSchema of [true, false]) {
        let json: any;
        try {
          json = await callGemini(model, build(model, withSchema), req.timeoutMs ?? 120_000, req.label);
        } catch (e) {
          lastError = e;
          const status = (e as AiRequestError).status;
          if (status === 400 && withSchema && /schema/i.test((e as Error).message)) continue; // schema not accepted: put it in the prompt
          if (status === 404 || status === 400 || status === 500 || status === 503) break; // try the next model
          throw e;
        }
        const usage = { input_tokens: json?.usageMetadata?.promptTokenCount ?? 0, output_tokens: json?.usageMetadata?.candidatesTokenCount ?? 0 };
        const cand = json?.candidates?.[0];
        const reason: string = cand?.finishReason ?? '';
        const text = ((cand?.content?.parts ?? []) as Array<{ text?: string; thought?: boolean }>).filter((p) => !p.thought && p.text).map((p) => p.text).join('');
        if (json?.promptFeedback?.blockReason || REFUSALS.has(reason)) return { data: null, stop: 'refusal', text, model, usage };
        if (reason === 'MAX_TOKENS') return { data: null, stop: 'cut_off', text, model, usage };
        const parsed = req.schema.safeParse(parseJsonText(text));
        return parsed.success ? { data: parsed.data, stop: 'ok', text, model, usage } : { data: null, stop: 'invalid', text, model, usage };
      }
    }
    throw lastError instanceof Error ? lastError : new AiRequestError('Gemini request failed');
  },
};
