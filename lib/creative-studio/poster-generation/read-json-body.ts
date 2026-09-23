/**
 * Shared JSON body reader for Pages API routes.
 * Next can leave large/mis-typed bodies as raw strings (char-indexed objects).
 */

import type { NextApiRequest } from "next";

export function readJsonBody(req: NextApiRequest): Record<string, unknown> {
  const raw = req.body;
  if (raw == null) return {};

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) {
    try {
      const parsed = JSON.parse(raw.toString("utf8"));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const keys = Object.keys(raw as object);
    // String mistaken for object: only numeric keys, no real fields
    if (
      keys.length > 50 &&
      keys.slice(0, 30).every((k) => /^\d+$/.test(k)) &&
      !("action" in (raw as object)) &&
      !("sessionId" in (raw as object))
    ) {
      try {
        const asString = keys
          .sort((a, b) => Number(a) - Number(b))
          .map((k) => (raw as Record<string, string>)[k])
          .join("");
        const parsed = JSON.parse(asString);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    }
    return raw as Record<string, unknown>;
  }

  return {};
}

export function readStringField(
  body: Record<string, unknown>,
  key: string
): string | null {
  const v = body[key];
  return typeof v === "string" && v.trim() ? v : null;
}
