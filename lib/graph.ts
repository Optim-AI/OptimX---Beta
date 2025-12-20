// lib/graph.ts
import type { RequestInit } from "node-fetch";

/**
 * Narrow unknown response body into a useful shape.
 * We return `any` after basic validation so callers can access fields,
 * but we still check for common Graph API error shapes.
 */
// lib/graph.ts
// --- Do NOT import node-fetch here. Use the runtime global fetch available in Next.js / Node 18+ ---

/**
 * Minimal, robust parse for fetch responses.
 */
async function parseJsonResponse(res: Response) {
  const body: unknown = await res.json();

  if (typeof body === "object" && body !== null && "error" in body) {
    const errObj = (body as any).error;
    const message = errObj?.message ?? JSON.stringify(body);
    const code = errObj?.code;
    throw new Error(`Graph API error${code ? ` (${code})` : ""}: ${message}`);
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} - ${JSON.stringify(body)}`);
  }

  return body as any;
}

/**
 * Use global fetch. We accept `init?: any` and forward to fetch as-is to avoid
 * mixing fetch type definitions (node-fetch vs global DOM fetch).
 */
export async function graphGet(url: string, init?: any) {
  // Use global fetch (Next.js provides it on server runtimes)
  const res = await (globalThis.fetch as any)(url, init);
  return parseJsonResponse(res);
}

export async function graphPost(url: string, init?: any) {
  const res = await (globalThis.fetch as any)(url, { method: "POST", ...(init ?? {}) });
  return parseJsonResponse(res);
}
