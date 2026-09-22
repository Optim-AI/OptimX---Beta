/**
 * Reference Poster Analyzer
 * Extracts design PRINCIPLES (grammar), not pixel templates.
 * Uses Gemini vision/text — does NOT consume image generation credits.
 */

import {
  GEMINI_API_KEY_SETUP_MESSAGE,
  GEMINI_REST_BASE,
  getGeminiApiKey,
} from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
import { normalizeImageForGemini } from "@/lib/creative-studio/nano-banana";
import { extractJsonObject } from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import type { ReferencePosterAnalysis } from "./reference-types";

const MODEL = process.env.REFERENCE_POSTER_ANALYZER_MODEL || "gemini-2.5-flash";

/** In-memory cache keyed by content hash (process lifetime) */
const analysisCache = new Map<string, ReferencePosterAnalysis>();

const SYSTEM_PROMPT = `You are a senior art director analyzing an advertising poster for DESIGN LANGUAGE only.

Extract reusable DESIGN PRINCIPLES — not pixel instructions, not clone recipes.

GOOD:
- "Product anchored in the lower-right region, partially overlapping a decorative foreground."
- "Large editorial headline with intentional typographic stack and strong contrast."

BAD:
- "Put the product at x=72%, y=68%."
- "Use exactly this headline layout."
- "Reproduce Apple's logo and product."

Never invent brand names from the reference as requirements.
Never instruct copying logos, trademarks, characters, or verbatim copy.

Return JSON only matching the schema.`;

const USER_PROMPT = `Analyze this REFERENCE POSTER as design inspiration.

Return JSON:
{
  "composition": "how space is organized — regions, balance, focal structure",
  "layout": "structural layout behavior (e.g. editorial split, centered hero, typographic-led)",
  "typography": "type hierarchy, case, scale relationships, stacking — principles not fonts to clone",
  "colorStrategy": "palette relationships, contrast, accent role",
  "imagery": "photographic/graphic treatment of subjects (not the specific subject to copy)",
  "graphicLanguage": "shapes, lines, frames, decorative devices if any",
  "hierarchy": "what the eye should see 1st → 2nd → 3rd… as a principle",
  "spacing": "negative space and rhythm principles",
  "visualTreatment": "lighting, texture, finish, mood as design language",
  "designMechanism": "the core visual device (e.g. minimal editorial statement, product-as-object study)",
  "avoid": ["list of things that must NOT be copied: logos, brands, exact products, characters, verbatim text…"],
  "styleTags": ["3-5 short tags e.g. editorial", "minimal", "high-contrast"],
  "suggestedTheme": "one of: minimal|professional|commercial|premium|bold|playful|trendy|festive|dynamic|null",
  "summary": "one sentence describing the design grammar"
}`;

export function hashReferenceImagePayload(dataUrlOrBase64: string): string {
  // Fast non-crypto fingerprint for cache (length + samples)
  const s = dataUrlOrBase64.slice(0, 2000) + dataUrlOrBase64.slice(-500);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `rp_${(h >>> 0).toString(16)}_${dataUrlOrBase64.length}`;
}

export function getCachedReferenceAnalysis(
  hash: string
): ReferencePosterAnalysis | null {
  return analysisCache.get(hash) || null;
}

export function setCachedReferenceAnalysis(
  hash: string,
  analysis: ReferencePosterAnalysis
): void {
  analysisCache.set(hash, analysis);
  if (analysisCache.size > 64) {
    const first = analysisCache.keys().next().value;
    if (first) analysisCache.delete(first);
  }
}

function normalizeAnalysis(raw: any): ReferencePosterAnalysis {
  const str = (v: unknown, fallback: string) =>
    typeof v === "string" && v.trim() ? v.trim() : fallback;
  const avoid = Array.isArray(raw?.avoid)
    ? raw.avoid.map((a: unknown) => String(a).trim()).filter(Boolean).slice(0, 12)
    : [
        "Do not copy logos or trademarks from the reference",
        "Do not reproduce exact artwork or characters",
        "Do not copy verbatim headlines or CTAs",
      ];
  const tags = Array.isArray(raw?.styleTags)
    ? raw.styleTags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 6)
    : undefined;
  const suggested =
    typeof raw?.suggestedTheme === "string" && raw.suggestedTheme !== "null"
      ? raw.suggestedTheme.trim().toLowerCase()
      : null;

  return {
    composition: str(raw?.composition, "Balanced advertising composition with a clear focal structure"),
    layout: str(raw?.layout, "Intentional layout with clear regions for hero and type"),
    typography: str(
      raw?.typography,
      "Strong typographic hierarchy with a dominant headline and quieter support"
    ),
    colorStrategy: str(
      raw?.colorStrategy,
      "Controlled palette with high-contrast type and a purposeful accent"
    ),
    imagery: str(raw?.imagery, "Art-directed imagery treatment supporting the idea"),
    graphicLanguage: str(raw?.graphicLanguage, "Restrained graphic language — only purposeful elements"),
    hierarchy: str(
      raw?.hierarchy,
      "1. Primary visual/headline 2. Product 3. Supporting claim 4. CTA/brand"
    ),
    spacing: str(raw?.spacing, "Generous negative space around primary type and hero"),
    visualTreatment: str(raw?.visualTreatment, "Premium, coherent lighting and finish"),
    designMechanism: str(raw?.designMechanism, "Editorial advertising composition"),
    avoid,
    styleTags: tags,
    suggestedTheme: suggested,
    summary: str(raw?.summary, "Design grammar extracted for inspiration only"),
  };
}

export async function analyzeReferencePoster(options: {
  dataUrl: string;
  contentHash?: string;
}): Promise<{
  analysis: ReferencePosterAnalysis;
  contentHash: string;
  cached: boolean;
  model: string;
}> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error(GEMINI_API_KEY_SETUP_MESSAGE);
  }

  const hash =
    options.contentHash || hashReferenceImagePayload(options.dataUrl);
  const cached = getCachedReferenceAnalysis(hash);
  if (cached) {
    return { analysis: cached, contentHash: hash, cached: true, model: MODEL };
  }

  const normalized = await normalizeImageForGemini(options.dataUrl);
  if (!normalized) {
    throw new Error("Could not process reference poster image");
  }

  const body = {
    contents: [
      {
        parts: [
          { text: USER_PROMPT },
          {
            inline_data: {
              mimeType: normalized.mimeType,
              data: normalized.base64Data,
            },
          },
        ],
      },
    ],
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    generation_config: {
      temperature: 0.35,
      max_output_tokens: 4096,
      response_mime_type: "application/json",
      thinking_config: { thinking_budget: 0 },
    },
  };

  let response = await fetchWithGeminiRateLimitRetry(
    `${GEMINI_REST_BASE}/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
    { operationLabel: "reference-poster-analyzer", maxRetries: 3 }
  );

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 400 && /thinking/i.test(errText)) {
      const { thinking_config: _, ...gen } = body.generation_config as any;
      body.generation_config = gen;
      response = await fetchWithGeminiRateLimitRetry(
        `${GEMINI_REST_BASE}/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify(body),
        },
        { operationLabel: "reference-poster-analyzer-retry", maxRetries: 2 }
      );
    }
    if (!response.ok) {
      const err2 = await response.text();
      console.error("[referencePosterAnalyzer] Gemini HTTP", response.status, err2.slice(0, 300));
      throw new Error("Could not analyze reference poster. Please try again.");
    }
  }

  const json = await response.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  const rawText = parts
    .filter((p: any) => !p.thought && p.text)
    .map((p: any) => p.text || "")
    .join("") || parts.map((p: any) => p.text || "").join("");

  let parsed: unknown;
  try {
    parsed = extractJsonObject(rawText);
  } catch {
    throw new Error("Reference analysis returned invalid JSON");
  }

  const analysis = normalizeAnalysis(parsed);
  setCachedReferenceAnalysis(hash, analysis);

  return { analysis, contentHash: hash, cached: false, model: MODEL };
}
