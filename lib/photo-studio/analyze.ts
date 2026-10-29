/** Product read: what's in the photo, so the shot list and each shot's set fit the product. */

import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
import { parseJsonLoose } from "@/lib/research/gemini";
import type { ProductProfile } from "./types";

const PROMPT = `You are a product photographer preparing a shoot. Look at this product photo and describe the product.
Return JSON:
{
  "name": "product name as on the packaging, or a short descriptive name",
  "productType": "what it is, e.g. 'jar of fried anchovy snack', 'serum bottle', 'running shoe'",
  "category": "e.g. food & snacks, skincare, apparel, electronics, home",
  "finish": "packaging/surface finish: glossy plastic, matte paper, clear glass, brushed metal, fabric…",
  "sizeClass": "tiny|handheld|tabletop|large",
  "colors": ["dominant product colours"],
  "usageContexts": ["2-3 real places it is used, e.g. 'a home kitchen counter', 'a bathroom vanity'"],
  "audience": "who typically buys it",
  "storyProps": ["3-6 props or ingredients that tell what it is, e.g. 'dried red chillies', 'whole anchovies'"],
  "isFood": true,
  "isWearable": false,
  "viewAngle": "front|three_quarter|top_down|side|unknown",
  "plainBackground": true,
  "obstructed": false,
  "notes": "anything a photographer should know (reflective, transparent, label details to protect)"
}
"obstructed" is true when anything other than the product is touching or in front of it — a hand or fingers holding it, another object overlapping it.`;

function normalize(raw: any): ProductProfile {
  const s = (v: unknown, n = 160) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const list = (v: unknown, n = 6) => (Array.isArray(v) ? v.map((x) => s(x, 80)).filter(Boolean).slice(0, n) : []);
  const size = ["tiny", "handheld", "tabletop", "large"].includes(raw?.sizeClass) ? raw.sizeClass : "handheld";
  const angle = ["front", "three_quarter", "top_down", "side"].includes(raw?.viewAngle) ? raw.viewAngle : "unknown";
  return {
    name: s(raw?.name, 100) || "Product",
    productType: s(raw?.productType),
    category: s(raw?.category, 60),
    finish: s(raw?.finish, 80),
    sizeClass: size,
    colors: list(raw?.colors, 5),
    usageContexts: list(raw?.usageContexts, 3),
    audience: s(raw?.audience),
    storyProps: list(raw?.storyProps, 6),
    isFood: raw?.isFood === true,
    isWearable: raw?.isWearable === true,
    viewAngle: angle,
    plainBackground: raw?.plainBackground !== false,
    obstructed: raw?.obstructed === true,
    notes: s(raw?.notes, 300),
  };
}

export async function analyzeProduct(image: { base64: string; mimeType: string }): Promise<ProductProfile> {
  const key = getGeminiApiKey();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const res = await fetchWithGeminiRateLimitRetry(
    `${GEMINI_REST_BASE}/models/${process.env.PHOTO_STUDIO_VISION_MODEL || "gemini-2.5-flash"}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: image.mimeType, data: image.base64 } }, { text: PROMPT }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
      }),
      signal: AbortSignal.timeout(45_000),
    },
    { maxRetries: 1, operationLabel: "photo-studio-analyze" }
  );
  if (!res.ok) throw new Error(`Product read failed (${res.status})`);
  const json = (await res.json()) as any;
  const text = (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("");
  return normalize(parseJsonLoose(text) ?? {});
}

// Exported for tests.
export { normalize as normalizeProductProfile };
