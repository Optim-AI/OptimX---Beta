/**
 * Product understanding — read physical handling facts from the product photo.
 *
 * The Commercial Director is text-only, so without this it guesses how packaging
 * opens (e.g. a screw-cap jar shown with a peel-off foil lid). One vision call on
 * the product reference extracts container, closure and the correct opening action;
 * the director and the Seedance prompt both treat these as facts.
 *
 * Non-fatal: any failure returns null and generation continues without it.
 */

import { getGeminiApiKey, GEMINI_REST_BASE } from "@/lib/gemini-config";
import type { StoredAssetRef } from "../assets";

export const PRODUCT_UNDERSTANDING_MODEL = "gemini-3.8-flash";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 25_000;

export interface ProductPhysicalProfile {
  containerType: string;
  closureType: string;
  /** Step-by-step physical action to open it, as a person would. */
  openingAction: string;
  /** Interactions that would contradict this packaging (peel-off foil, pull tab…). */
  forbiddenInteractions: string[];
  contentsDescription?: string;
  labelDescription?: string;
}

export type ProductAnalyzer = (input: {
  productName: string;
  category?: string;
  description?: string;
  images: StoredAssetRef[];
}) => Promise<ProductPhysicalProfile | null>;

/** One prompt-ready paragraph for the director and the video model. */
export function productProfileToHandlingText(profile: ProductPhysicalProfile): string {
  const sentence = (text: string) => (/[.!?]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);
  const parts = [
    sentence(`Container: ${profile.containerType}`),
    sentence(`Closure: ${profile.closureType}`),
    sentence(`To open it: ${profile.openingAction}`),
    profile.forbiddenInteractions.length
      ? sentence(`Never show: ${profile.forbiddenInteractions.join(", ")}`)
      : "",
    profile.contentsDescription ? sentence(`Contents: ${profile.contentsDescription}`) : "",
    profile.labelDescription ? sentence(`Label: ${profile.labelDescription}`) : "",
  ];
  return parts.filter(Boolean).join(" ");
}

/** Fetch / decode a product image as base64 for a Gemini inline_data part. */
export async function loadImageInline(
  ref: StoredAssetRef
): Promise<{ mimeType: string; data: string } | null> {
  const url = ref.url?.trim();
  if (!url) return null;
  if (url.startsWith("data:image/")) {
    const comma = url.indexOf(",");
    if (comma < 0) return null;
    const mimeType = url.slice(5, url.indexOf(";")) || "image/jpeg";
    return { mimeType, data: url.slice(comma + 1) };
  }
  if (!url.startsWith("https://")) return null;
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) return null;
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || ref.mimeType || "image/jpeg";
  if (!mimeType.startsWith("image/")) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) return null;
  return { mimeType, data: buf.toString("base64") };
}

function parseProfile(text: string): ProductPhysicalProfile | null {
  let raw: Partial<ProductPhysicalProfile>;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
  } catch {
    return null;
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const profile: ProductPhysicalProfile = {
    containerType: str(raw.containerType),
    closureType: str(raw.closureType),
    openingAction: str(raw.openingAction),
    forbiddenInteractions: Array.isArray(raw.forbiddenInteractions)
      ? raw.forbiddenInteractions.map(str).filter(Boolean).slice(0, 6)
      : [],
    contentsDescription: str(raw.contentsDescription) || undefined,
    labelDescription: str(raw.labelDescription) || undefined,
  };
  return profile.containerType && profile.closureType && profile.openingAction ? profile : null;
}

/** Live analyzer (Gemini vision). Returns null when no key / no usable image. */
export const analyzeProductPhysicalProfile: ProductAnalyzer = async (input) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey || !input.images.length) return null;

  const images = (
    await Promise.all(input.images.slice(0, 2).map((ref) => loadImageInline(ref).catch(() => null)))
  ).filter((img): img is { mimeType: string; data: string } => img != null);
  if (!images.length) return null;

  const prompt = `You are preparing a product for a video commercial. Look at the product photo(s) and describe the PHYSICAL packaging exactly as it is — a video model will act out how a person handles it, so wrong details produce impossible footage.

Product: ${input.productName}
Category: ${input.category || "unspecified"}
Description: ${input.description || "not provided"}

Return JSON only:
{
  "containerType": "e.g. clear glass jar with straight sides",
  "closureType": "e.g. white plastic screw-top lid",
  "openingAction": "the physical steps to open it, e.g. hold the jar, twist the lid counter-clockwise two turns, lift it off",
  "forbiddenInteractions": ["interactions that would contradict this packaging, e.g. peeling off a foil seal, pulling a ring tab, tearing a wrapper"],
  "contentsDescription": "what is inside and its texture, if visible",
  "labelDescription": "label colours, logo position, key printed text"
}
Only describe what the photo shows. If an inner seal is not visible, do not invent one.`;

  const res = await fetch(`${GEMINI_REST_BASE}/models/${PRODUCT_UNDERSTANDING_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            ...images.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.data } })),
            { text: prompt },
          ],
        },
      ],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    throw new Error(`Product understanding failed (HTTP ${res.status})`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return parseProfile(text);
};

export const __test__ = { parseProfile };
