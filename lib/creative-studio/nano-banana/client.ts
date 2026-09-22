/**
 * Shared Gemini image-generation primitives used by Brand Studio posters
 * (Nano Banana 2 / gemini-3.1-flash-image via getPosterImageModel) and the
 * commercial keyframe engine (getGeminiImageModel / GEMINI_MODEL).
 *
 * Extracted from app/api/generate-campaign/route.ts so commercial production
 * does NOT duplicate API key handling, HTTP client, retries, image normalization,
 * or response extraction.
 *
 * Poster route remains the HTTP entry for credits/auth; this module is the
 * reusable generation core. Poster and video/keyframe model IDs stay independent.
 */

import axios from "axios";
import sharp from "sharp";
import { withRetryOnGeminiTransient } from "@/lib/gemini-retry";
import { GEMINI_REST_BASE } from "@/lib/gemini-config";

export const GEMINI_IMAGE_UNSUPPORTED_MIMES = [
  "image/svg+xml",
  "image/vnd.microsoft.icon",
  "image/x-icon",
  "image/ico",
];

export const GEMINI_IMAGE_ALLOWED_ASPECTS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

export type GeminiImageAspectRatio = (typeof GEMINI_IMAGE_ALLOWED_ASPECTS)[number];

/**
 * Keyframe / commercial image model (NOT posters).
 * Override with GEMINI_MODEL. Kept independent from POSTER_IMAGE_MODEL.
 */
export function getGeminiImageModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
}

/**
 * Poster generation model — Nano Banana 2.
 * Single source of truth: POSTER_IMAGE_MODEL (default gemini-3.1-flash-image).
 * Do not use GEMINI_MODEL here — video/keyframe config must stay independent.
 */
export function getPosterImageModel(): string {
  return process.env.POSTER_IMAGE_MODEL || "gemini-3.1-flash-image";
}

/**
 * Key resolution matches poster route:
 * NANO_API_KEY || GEMINI_API_KEY || GEMINI_VEO_API_KEY
 */
export function getNanoBananaApiKey(): string | undefined {
  const key =
    process.env.NANO_API_KEY || process.env.GEMINI_API_KEY || process.env.GEMINI_VEO_API_KEY;
  const trimmed = key?.trim();
  return trimmed || undefined;
}

export function getNanoBananaApiKeySource(): string | undefined {
  if (process.env.NANO_API_KEY?.trim()) return "NANO_API_KEY";
  if (process.env.GEMINI_API_KEY?.trim()) return "GEMINI_API_KEY";
  if (process.env.GEMINI_VEO_API_KEY?.trim()) return "GEMINI_VEO_API_KEY";
  return undefined;
}

export function isUnsupportedGeminiImageMime(mimeType: string): boolean {
  const normalized = mimeType.toLowerCase().trim();
  return GEMINI_IMAGE_UNSUPPORTED_MIMES.some((t) => normalized.includes(t));
}

export async function normalizeImageForGemini(
  dataUrl: string
): Promise<{ mimeType: string; base64Data: string } | null> {
  const m = dataUrl.match(/^data:(.+?);base64,(.+)$/);
  if (!m) return null;
  const mimeType = m[1].toLowerCase().split(";")[0].trim();
  const base64Data = m[2];

  const maxDim = 1600;
  const maxBytes = 4 * 1024 * 1024;

  try {
    const inputBuffer = Buffer.from(base64Data, "base64");
    const sharpInput = mimeType.includes("svg") ? { density: 144 } : undefined;
    const meta = await sharp(inputBuffer, sharpInput).metadata();
    const tooLarge =
      inputBuffer.length > maxBytes ||
      (meta.width != null && meta.width > maxDim) ||
      (meta.height != null && meta.height > maxDim);

    if (isUnsupportedGeminiImageMime(mimeType) || tooLarge) {
      const optimized = await sharp(inputBuffer, sharpInput)
        .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
      return { mimeType: "image/jpeg", base64Data: optimized.toString("base64") };
    }

    if (!isUnsupportedGeminiImageMime(mimeType)) {
      return { mimeType, base64Data };
    }
  } catch (e) {
    console.warn("Failed to normalize image for Gemini:", e);
    return null;
  }

  return null;
}

export function mapToAllowedGeminiAspect(
  width: number,
  height: number
): GeminiImageAspectRatio {
  if (!width || !height) return "1:1";
  const ratio = width / height;
  const mapNum: Record<string, number> = {
    "1:1": 1.0,
    "2:3": 2 / 3,
    "3:2": 3 / 2,
    "3:4": 3 / 4,
    "4:3": 4 / 3,
    "4:5": 4 / 5,
    "5:4": 5 / 4,
    "9:16": 9 / 16,
    "16:9": 16 / 9,
    "21:9": 21 / 9,
  };
  let best: GeminiImageAspectRatio = "4:5";
  let bestDiff = Math.abs(mapNum[best] - ratio);
  for (const a of GEMINI_IMAGE_ALLOWED_ASPECTS) {
    const d = Math.abs(mapNum[a] - ratio);
    if (d < bestDiff) {
      best = a;
      bestDiff = d;
    }
  }
  return best;
}

/** Map commercial aspect labels (e.g. 9:16) to Gemini-allowed aspect strings. */
export function commercialAspectToGeminiAspect(aspectRatio: string): GeminiImageAspectRatio {
  const normalized = aspectRatio.trim();
  if ((GEMINI_IMAGE_ALLOWED_ASPECTS as readonly string[]).includes(normalized)) {
    return normalized as GeminiImageAspectRatio;
  }
  const map: Record<string, GeminiImageAspectRatio> = {
    "1.91:1": "16:9",
    "4:5": "4:5",
    "9:16": "9:16",
    "16:9": "16:9",
    "1:1": "1:1",
    "3:4": "3:4",
    "4:3": "4:3",
  };
  return map[normalized] || "9:16";
}

export function extractImageFromGeminiResponse(respJson: any): {
  kind: "inline" | "url" | null;
  data?: string;
  url?: string;
} {
  try {
    const candidates =
      respJson?.response?.candidates ??
      respJson?.candidates ??
      respJson?.result?.candidates ??
      respJson?.parts ??
      null;
    if (Array.isArray(candidates) && candidates.length > 0) {
      for (const c of candidates) {
        const parts = c?.content?.parts ?? c?.content ?? c?.parts ?? null;
        if (Array.isArray(parts)) {
          for (const p of parts) {
            if (p?.inline_data?.data) return { kind: "inline", data: p.inline_data.data };
            if (p?.inlineData?.data) return { kind: "inline", data: p.inlineData.data };
            if (p?.files && Array.isArray(p.files) && p.files.length > 0) {
              const f = p.files[0];
              if (f?.data) return { kind: "inline", data: f.data };
              if (f?.uri) return { kind: "url", url: f.uri };
            }
            if (p?.data && typeof p.data === "string") {
              const s = p.data;
              if (s.startsWith("data:")) return { kind: "inline", data: s };
              return { kind: "inline", data: s };
            }
          }
        }
      }
    }
    const topFiles =
      respJson?.files ?? respJson?.outputs ?? respJson?.generated_images ?? respJson?.images;
    if (Array.isArray(topFiles) && topFiles.length > 0) {
      const f = topFiles[0];
      if (typeof f === "string") {
        if (f.startsWith("data:")) return { kind: "inline", data: f };
        if (f.startsWith("http")) return { kind: "url", url: f };
      } else if (f?.data) {
        return { kind: "inline", data: f.data };
      } else if (f?.uri) {
        return { kind: "url", url: f.uri };
      }
    }
  } catch {
    // ignore
  }
  return { kind: null };
}

export function dataUrlToBuffer(dataUrl: string): Buffer {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  return Buffer.from(m[2], "base64");
}

export async function fetchUrlToBuffer(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

export async function fetchUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SkalX AI/1.0)", Accept: "image/*" },
    });
    if (!resp.ok) return null;
    const contentType = resp.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return null;
    const base64 = Buffer.from(await resp.arrayBuffer()).toString("base64");
    return `data:${contentType.split(";")[0]};base64,${base64}`;
  } catch {
    return null;
  }
}

export interface GeminiImageReferencePart {
  /** data: URL or will be fetched if http(s) */
  dataUrlOrHttp: string;
  /** Instruction text appended after the inline image. */
  instruction: string;
}

export interface GenerateGeminiImageInput {
  prompt: string;
  aspectRatio: string;
  /** Ordered reference images (product first recommended). Max 4 including product. */
  references?: GeminiImageReferencePart[];
  operationLabel?: string;
  maxRetries?: number;
  apiKey?: string;
  model?: string;
}

export interface GenerateGeminiImageResult {
  buffer: Buffer;
  dataUrl: string;
  model: string;
  provider: "nano_banana";
  aspectRatio: GeminiImageAspectRatio;
  rawResponse?: unknown;
}

/**
 * Core Gemini flash-image call — same transport as Brand Studio posters.
 */
export async function generateGeminiImage(
  input: GenerateGeminiImageInput
): Promise<GenerateGeminiImageResult> {
  const apiKey = input.apiKey ?? getNanoBananaApiKey();
  if (!apiKey) {
    throw new Error(
      "NANO_API_KEY or GEMINI_API_KEY is required for Nano Banana / Gemini image generation"
    );
  }

  const model = input.model || getGeminiImageModel();
  const aspectRatio = commercialAspectToGeminiAspect(input.aspectRatio);

  const parts: any[] = [{ text: input.prompt }];

  const refs = input.references || [];
  let added = 0;
  for (const ref of refs) {
    if (added >= 4) break;
    let dataUrl = ref.dataUrlOrHttp;
    if (dataUrl.startsWith("http://") || dataUrl.startsWith("https://")) {
      const fetched = await fetchUrlToDataUrl(dataUrl);
      if (!fetched) continue;
      dataUrl = fetched;
    }
    if (!dataUrl.startsWith("data:")) continue;
    const normalized = await normalizeImageForGemini(dataUrl);
    if (!normalized || isUnsupportedGeminiImageMime(normalized.mimeType)) continue;
    parts.push({
      inline_data: {
        mimeType: normalized.mimeType,
        data: normalized.base64Data,
      },
    });
    parts.push({ text: ref.instruction });
    added += 1;
  }

  parts.push({ text: `Aspect ratio hint: ${aspectRatio}` });

  const payload = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["Image"],
      imageConfig: { aspectRatio },
      candidateCount: 1,
    },
  };

  const url = `${GEMINI_REST_BASE}/models/${encodeURIComponent(model)}:generateContent`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    "x-goog-api-key": apiKey,
  };

  const createResp = await withRetryOnGeminiTransient(
    () => axios.post(url, payload, { headers }),
    {
      maxRetries: input.maxRetries ?? 4,
      operationLabel: input.operationLabel || "gemini-image-generate",
    }
  );

  const createJson = createResp.data;
  let imageBuffer: Buffer | null = null;

  const extracted = extractImageFromGeminiResponse(createJson);
  if (extracted.kind === "inline" && extracted.data) {
    const maybe = extracted.data;
    if (typeof maybe === "string" && maybe.startsWith("data:")) {
      imageBuffer = dataUrlToBuffer(maybe);
    } else {
      imageBuffer = Buffer.from(maybe, "base64");
    }
  } else if (extracted.kind === "url" && extracted.url) {
    imageBuffer = await fetchUrlToBuffer(extracted.url);
  }

  if (!imageBuffer) {
    const asString = JSON.stringify(createJson || {});
    const dataUrlMatch = asString.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
    if (dataUrlMatch) {
      imageBuffer = dataUrlToBuffer(dataUrlMatch[0]);
    }
  }

  if (!imageBuffer) {
    throw new Error("No image returned from Gemini (unable to extract).");
  }

  const dataUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
  return {
    buffer: imageBuffer,
    dataUrl,
    model,
    provider: "nano_banana",
    aspectRatio,
    rawResponse: createJson,
  };
}
