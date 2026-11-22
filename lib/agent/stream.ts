/**
 * Streams a Gemini chat reply (server-sent events from streamGenerateContent).
 * Falls back to the next model when the preferred one is missing or overloaded
 * before any text has been sent.
 */
import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { SYNTHESIS_MODEL } from "@/lib/research/gemini";

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type WebSource = { title: string; url: string };
export type StreamEnd = { model: string; sources: WebSource[] };

const FALLBACKS = ["gemini-3.8-flash", "gemini-2.5-flash"];
export const AGENT_MODEL = () => process.env.AGENT_MODEL?.trim() || SYNTHESIS_MODEL();

function thinking(model: string) {
  return /gemini-2\.5/.test(model) ? { thinkingBudget: 1024 } : { thinkingLevel: "low" };
}

export class AgentModelError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

async function open(model: string, system: string, turns: ChatTurn[], signal: AbortSignal, search: boolean) {
  const key = getGeminiApiKey();
  if (!key) throw new AgentModelError("GEMINI_API_KEY is not configured");
  const res = await fetch(`${GEMINI_REST_BASE}/models/${model}:streamGenerateContent?alt=sse&key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
      ...(search ? { tools: [{ google_search: {} }] } : {}),
      generationConfig: { temperature: 0.6, maxOutputTokens: 4096, thinkingConfig: thinking(model) },
    }),
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new AgentModelError(`Gemini ${model} ${res.status}: ${text.slice(0, 160)}`, res.status);
  }
  return res.body;
}

/** Yields text chunks. Returns the model used and, when web search ran, the pages it used. */
export async function* streamReply(system: string, turns: ChatTurn[], signal: AbortSignal, opts: { search?: boolean } = {}): AsyncGenerator<string, StreamEnd> {
  let lastError: unknown;
  for (const model of [...new Set([AGENT_MODEL(), ...FALLBACKS])]) {
    let body: ReadableStream<Uint8Array>;
    try {
      body = await open(model, system, turns, signal, !!opts.search);
    } catch (e) {
      lastError = e;
      const s = (e as AgentModelError).status;
      if (s === 404 || s === 400 || s === 500 || s === 503 || s === 429) continue;
      throw e;
    }
    const sources: WebSource[] = [];
    const seen = new Set<string>();
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const json = JSON.parse(line.slice(5));
          const parts: Array<{ text?: string; thought?: boolean }> = json?.candidates?.[0]?.content?.parts || [];
          const text = parts.filter((p) => !p.thought && p.text).map((p) => p.text).join("");
          for (const c of json?.candidates?.[0]?.groundingMetadata?.groundingChunks || []) {
            const url = c?.web?.uri;
            const title = c?.web?.title || "";
            if (url && !seen.has(title || url)) { seen.add(title || url); sources.push({ title: title || url, url }); }
          }
          if (text) yield text;
        } catch {
          /* partial or keep-alive line */
        }
      }
    }
    return { model, sources };
  }
  throw lastError ?? new AgentModelError("No model available");
}

/** Short title for a new chat, from the first message (no model call). */
export function titleFrom(message: string): string {
  const t = message.replace(/\s+/g, " ").trim();
  if (t.length <= 60) return t;
  const cut = t.slice(0, 60);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 30 ? cut.lastIndexOf(" ") : 60)}…`;
}
