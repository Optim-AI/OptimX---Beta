/**
 * Product photo clean-up before video generation.
 *
 * Shop-counter photos often show other companies' packs, posters or logos around
 * the product. The video model copies them, and Runway's moderation then blocks
 * the output (SAFETY.OUTPUT.THIRD_PARTY). One Gemini vision call finds the main
 * product; when anything else branded is visible, the photo is cropped to the
 * product on a plain margin.
 *
 * Non-fatal: any failure keeps the original photo.
 */

import sharp from "sharp";
import { getGeminiApiKey, GEMINI_REST_BASE } from "@/lib/gemini-config";
import type { StoredAssetRef } from "../assets";
import { loadImageInline } from "./analyze-product";

export const PRODUCT_ISOLATION_MODEL = "gemini-3.8-flash";

const REQUEST_TIMEOUT_MS = 25_000;
/** Extra room around the product box, as a fraction of its size. */
const PADDING = 0.08;
const MAX_OUTPUT_DIM = 1600;

export interface ProductIsolationVerdict {
  /** [ymin, xmin, ymax, xmax] on a 0–1000 grid (Gemini box_2d convention). */
  box: [number, number, number, number];
  otherBrandsVisible: boolean;
  otherBrands: string[];
}

export function parseIsolationVerdict(text: string): ProductIsolationVerdict | null {
  let raw: { box_2d?: unknown; otherBrandsVisible?: unknown; otherBrands?: unknown };
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
  } catch {
    return null;
  }
  const box = Array.isArray(raw.box_2d) ? raw.box_2d.map(Number) : [];
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n) || n < 0 || n > 1000)) return null;
  const [ymin, xmin, ymax, xmax] = box;
  if (ymax - ymin < 50 || xmax - xmin < 50) return null;
  return {
    box: [ymin, xmin, ymax, xmax],
    otherBrandsVisible: raw.otherBrandsVisible === true,
    otherBrands: Array.isArray(raw.otherBrands)
      ? raw.otherBrands.map((b) => String(b).trim()).filter(Boolean).slice(0, 6)
      : [],
  };
}

/** Pixel crop for a 0–1000 box, padded and clamped to the image. */
export function cropRectForBox(
  box: [number, number, number, number],
  width: number,
  height: number
): { left: number; top: number; width: number; height: number } {
  const [ymin, xmin, ymax, xmax] = box;
  const x0 = (xmin / 1000) * width;
  const x1 = (xmax / 1000) * width;
  const y0 = (ymin / 1000) * height;
  const y1 = (ymax / 1000) * height;
  const padX = (x1 - x0) * PADDING;
  const padY = (y1 - y0) * PADDING;
  const left = Math.max(0, Math.floor(x0 - padX));
  const top = Math.max(0, Math.floor(y0 - padY));
  const right = Math.min(width, Math.ceil(x1 + padX));
  const bottom = Math.min(height, Math.ceil(y1 + padY));
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

async function askForProductBox(
  image: { mimeType: string; data: string },
  productName: string,
  apiKey: string
): Promise<ProductIsolationVerdict | null> {
  const prompt = `This photo will be the product reference for a video ad for "${productName}".
Find the main product (the one being advertised) and check the rest of the photo.

Return JSON only:
{
  "box_2d": [ymin, xmin, ymax, xmax],
  "otherBrandsVisible": true or false,
  "otherBrands": ["names of other brands, logos or printed packs visible outside the product"]
}
box_2d is the tight box around the whole main product (lid included) on a 0-1000 grid.
otherBrandsVisible is true only when another company's pack, poster, logo or readable brand text is visible anywhere outside the main product. Plain backgrounds, tables, cups and blurred shapes without readable branding are fine.`;

  const res = await fetch(`${GEMINI_REST_BASE}/models/${PRODUCT_ISOLATION_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ inline_data: { mime_type: image.mimeType, data: image.data } }, { text: prompt }],
        },
      ],
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Product isolation failed (HTTP ${res.status})`);
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return parseIsolationVerdict(text);
}

export type ProductPhotoIsolator = (input: {
  productName: string;
  image: StoredAssetRef;
}) => Promise<{ image: StoredAssetRef; otherBrands: string[] } | null>;

/**
 * Returns a cropped copy of the photo when other brands are visible around the
 * product, or null when the photo is fine as it is (or anything fails).
 */
export const isolateProductPhoto: ProductPhotoIsolator = async ({ productName, image }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  const inline = await loadImageInline(image);
  if (!inline) return null;

  const verdict = await askForProductBox(inline, productName, apiKey);
  if (!verdict?.otherBrandsVisible) return null;

  const input = Buffer.from(inline.data, "base64");
  const meta = await sharp(input).rotate().metadata();
  if (!meta.width || !meta.height) return null;
  const rect = cropRectForBox(verdict.box, meta.width, meta.height);
  // Cropping away most of a photo usually means the box is wrong; keep the original.
  if (rect.width * rect.height < 0.08 * meta.width * meta.height) return null;

  const cropped = await sharp(input)
    .rotate()
    .extract(rect)
    .resize({ width: MAX_OUTPUT_DIM, height: MAX_OUTPUT_DIM, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();

  return {
    image: {
      ...image,
      url: `data:image/jpeg;base64,${cropped.toString("base64")}`,
      mimeType: "image/jpeg",
    },
    otherBrands: verdict.otherBrands,
  };
};
