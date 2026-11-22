/**
 * One-shot Gemini JSON call that can include a file (PDF, image, text) inline.
 * Used to read uploaded context files and to pick facts worth remembering.
 */
import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
import { parseJsonLoose } from "@/lib/research/gemini";
import { AGENT_MODEL } from "./stream";

const FALLBACKS = ["gemini-3.8-flash", "gemini-2.5-flash"];

export async function agentJson<T>(prompt: string, opts: { file?: { mime: string; base64: string }; timeoutMs?: number; label?: string } = {}): Promise<T> {
  const key = getGeminiApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const parts: unknown[] = [];
  if (opts.file) parts.push({ inline_data: { mime_type: opts.file.mime, data: opts.file.base64 } });
  parts.push({ text: prompt });
  let lastError: unknown;
  for (const model of [...new Set([AGENT_MODEL(), ...FALLBACKS])]) {
    const res = await fetchWithGeminiRateLimitRetry(
      `${GEMINI_REST_BASE}/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            thinkingConfig: /gemini-2\.5/.test(model) ? { thinkingBudget: 0 } : { thinkingLevel: "low" },
          },
        }),
      },
      { maxRetries: 2, operationLabel: opts.label ?? "agent-json" }
    );
    if (!res.ok) {
      lastError = new Error(`Gemini ${model} ${res.status}`);
      if ([400, 404, 500, 503].includes(res.status)) continue;
      throw lastError;
    }
    const json: any = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts || []).filter((p: any) => !p.thought && p.text).map((p: any) => p.text).join("");
    const parsed = parseJsonLoose<T>(text);
    if (parsed === null) throw new Error("Model returned invalid JSON");
    return parsed;
  }
  throw lastError ?? new Error("No model available");
}
