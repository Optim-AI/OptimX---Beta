/**
 * Gemini calls for market research.
 *
 * - groundedResearch: Gemini with the Google Search tool. Live web results,
 *   returns the model's answer plus the web sources it actually used.
 * - generateResearchJson: plain JSON generation for synthesis steps.
 *
 * Server-only. Model defaults to RESEARCH_MODEL, falling back to an older
 * Flash model when the preferred one is unavailable for the key.
 */

import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";

export type ResearchSource = { title: string; url: string };

export type GroundedResult = {
  text: string;
  sources: ResearchSource[];
  queries: string[];
  model: string;
};

const FALLBACK_MODELS = ["gemini-3.8-flash", "gemini-2.5-flash"];

/** Synthesis model (reasoning) and search model (speed); both overridable. */
export const SYNTHESIS_MODEL = () => process.env.RESEARCH_MODEL?.trim() || "gemini-3.8-flash";
// 2.5 Flash reliably runs the search tool; 3.x at low thinking often answers from memory.
export const SEARCH_MODEL = () => process.env.RESEARCH_SEARCH_MODEL?.trim() || "gemini-2.5-flash";

function modelChain(preferred: string): string[] {
  return [...new Set([preferred, ...FALLBACK_MODELS])];
}

/** Gemini 3.x takes a thinking level; 2.5 takes a budget. */
function thinkingConfig(model: string, level: "low" | "high") {
  if (/gemini-2\.5/.test(model)) return { thinkingBudget: level === "low" ? 512 : -1 };
  return { thinkingLevel: level };
}

export class ResearchModelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ResearchModelError";
  }
}

type GeminiBody = Record<string, unknown>;

async function callModel(model: string, body: GeminiBody, timeoutMs: number, label: string) {
  const key = getGeminiApiKey();
  if (!key) throw new ResearchModelError("GEMINI_API_KEY is not configured");
  const res = await fetchWithGeminiRateLimitRetry(
    `${GEMINI_REST_BASE}/models/${model}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    },
    { maxRetries: 2, operationLabel: label }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ResearchModelError(`Gemini ${model} ${res.status}: ${text.slice(0, 200)}`, res.status);
  }
  return res.json() as Promise<any>;
}

/** Try each model in turn; move on only when a model is missing or overloaded. */
async function callWithFallback(
  preferred: string,
  build: (model: string) => GeminiBody,
  timeoutMs: number,
  label: string
) {
  let lastError: unknown;
  for (const model of modelChain(preferred)) {
    try {
      return { json: await callModel(model, build(model), timeoutMs, label), model };
    } catch (e) {
      lastError = e;
      const status = (e as ResearchModelError).status;
      if (status !== 404 && status !== 400 && status !== 503 && status !== 500) throw e;
    }
  }
  throw lastError;
}

function candidateText(json: any): string {
  const parts: Array<{ text?: string; thought?: boolean }> = json?.candidates?.[0]?.content?.parts || [];
  return parts
    .filter((p) => !p.thought && p.text)
    .map((p) => p.text)
    .join("");
}

/** Pull the first JSON object or array out of model text (handles ``` fences and prose). */
export function parseJsonLoose<T = unknown>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const starts = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0);
    if (!starts.length) return null;
    const start = Math.min(...starts);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    } catch {
      return null;
    }
  }
}

export async function groundedResearch(
  prompt: string,
  opts: { timeoutMs?: number; label?: string; model?: string; thinking?: "low" | "high" } = {}
): Promise<GroundedResult> {
  const { json, model } = await callWithFallback(
    opts.model ?? SEARCH_MODEL(),
    (m) => ({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        thinkingConfig: thinkingConfig(m, opts.thinking ?? "low"),
      },
    }),
    opts.timeoutMs ?? 60_000,
    opts.label ?? "research-grounded"
  );
  const meta = json?.candidates?.[0]?.groundingMetadata || {};
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const chunk of meta.groundingChunks || []) {
    const url = chunk?.web?.uri;
    const title = chunk?.web?.title || "";
    if (!url || seen.has(title || url)) continue;
    seen.add(title || url);
    sources.push({ title: title || url, url });
  }
  return {
    text: candidateText(json),
    sources,
    queries: Array.isArray(meta.webSearchQueries) ? meta.webSearchQueries : [],
    model,
  };
}

export async function generateResearchJson<T = unknown>(
  prompt: string,
  opts: {
    system?: string;
    temperature?: number;
    timeoutMs?: number;
    label?: string;
    model?: string;
    thinking?: "low" | "high";
  } = {}
): Promise<T> {
  const { json } = await callWithFallback(
    opts.model ?? SYNTHESIS_MODEL(),
    (m) => ({
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        maxOutputTokens: 16384,
        responseMimeType: "application/json",
        thinkingConfig: thinkingConfig(m, opts.thinking ?? "low"),
      },
    }),
    opts.timeoutMs ?? 60_000,
    opts.label ?? "research-json"
  );
  const parsed = parseJsonLoose<T>(candidateText(json));
  if (parsed === null) throw new ResearchModelError("Model returned invalid JSON");
  return parsed;
}
