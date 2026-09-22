/**
 * POST /api/commercial/enhance-prompt
 *
 * Lightweight Gemini rewrite of the user's Creative Direction prompt.
 * Does NOT call Commercial Director, shot planner, or Runway.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getGeminiApiKey, GEMINI_REST_BASE, GEMINI_API_KEY_SETUP_MESSAGE } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";

export const config = {
  api: {
    bodyParser: { sizeLimit: "1mb" },
  },
  maxDuration: 60,
};

const MODEL = "gemini-2.5-flash";

const SYSTEM_INSTRUCTION = `You are an expert commercial creative writer and advertising creative director.

Rewrite the user's rough creative idea into a concise, visually clear, commercially compelling video-generation prompt.

The user's original idea is the source of truth. Preserve the original story, characters, actions, setting, mood, product, brand, dialogue, and important details.

Use the provided brand and product context to make the enhanced prompt explicitly brand- and product-oriented. If a product name is available, naturally mention the specific product rather than replacing it with a generic category such as coffee, perfume, protein bar, phone, or skincare.

Make the product meaningfully part of the story rather than simply appending the product name.

Improve clarity, visual storytelling, emotional progression, atmosphere, pacing, transitions, and commercial quality where appropriate.

Do not invent product claims, benefits, ingredients, specifications, statistics, or other factual information that was not provided.

Do not invent major story elements, characters, locations, or actions.

Do not turn the response into a shot list, storyboard, technical production document, or overly long filmmaking prompt.

Avoid generic AI prompt filler and unnecessary technical jargon.

Keep the final prompt concise and natural, generally around 60–120 words depending on the complexity of the user's idea.

The result should read like a strong creative direction for a premium commercial video.

Return ONLY the enhanced prompt.`;

const MIN_ENHANCED_CHARS = 20;
const MAX_ENHANCED_CHARS = 2000;

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function sanitizeEnhancedPrompt(raw: string): string | null {
  let text = raw.trim();
  if (!text) return null;

  // Strip common wrappers (markdown fences / JSON accidental output)
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:\w+)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }
  if (
    (text.startsWith("{") && text.endsWith("}")) ||
    (text.startsWith("[") && text.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed === "string") text = parsed.trim();
      else if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        const candidate =
          (typeof obj.enhancedPrompt === "string" && obj.enhancedPrompt) ||
          (typeof obj.prompt === "string" && obj.prompt) ||
          (typeof obj.text === "string" && obj.text) ||
          "";
        if (candidate.trim()) text = candidate.trim();
      }
    } catch {
      // keep stripped text
    }
  }

  text = text.replace(/^["']|["']$/g, "").trim();
  if (text.length < MIN_ENHANCED_CHARS || text.length > MAX_ENHANCED_CHARS) return null;
  return text;
}

function buildUserMessage(input: {
  prompt: string;
  brand?: string;
  product?: string;
  productDescription?: string;
  campaignContext?: Record<string, unknown>;
}): string {
  const lines = [
    "Rewrite the following creative direction into an enhanced commercial video prompt.",
    "",
    "ORIGINAL USER PROMPT:",
    input.prompt,
    "",
  ];

  if (input.brand) lines.push(`Brand: ${input.brand}`);
  if (input.product) lines.push(`Product: ${input.product}`);
  if (input.productDescription) lines.push(`Product description: ${input.productDescription}`);

  const ctx = input.campaignContext;
  if (ctx && typeof ctx === "object") {
    const bits: string[] = [];
    if (typeof ctx.category === "string" && ctx.category.trim()) {
      bits.push(`Category: ${ctx.category.trim()}`);
    }
    if (typeof ctx.audience === "string" && ctx.audience.trim() && ctx.audience !== "Auto") {
      bits.push(`Audience: ${ctx.audience.trim()}`);
    }
    if (typeof ctx.campaignGoal === "string" && ctx.campaignGoal.trim()) {
      bits.push(`Campaign goal: ${ctx.campaignGoal.trim()}`);
    }
    if (typeof ctx.platform === "string" && ctx.platform.trim()) {
      bits.push(`Platform: ${ctx.platform.trim()}`);
    }
    if (typeof ctx.duration === "number") bits.push(`Duration: ${ctx.duration}s`);
    if (bits.length) {
      lines.push("", "Campaign context:", ...bits);
    }
  }

  lines.push(
    "",
    "If brand/product are provided, weave the specific product name into the story naturally (usually once or twice). Do not invent claims. Return only the enhanced prompt text."
  );

  return lines.join("\n");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { getUserIdFromRequest } = await import("@/auth/request");
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  try {
    const body = req.body || {};
    const prompt = asOptionalString(body.prompt);
    if (!prompt) {
      return res.status(400).json({
        ok: false,
        error: "prompt is required",
        code: "EMPTY_PROMPT",
      });
    }

    const brand = asOptionalString(body.brand);
    const product = asOptionalString(body.product);
    const productDescription = asOptionalString(body.productDescription);
    const campaignContext =
      body.campaignContext && typeof body.campaignContext === "object"
        ? (body.campaignContext as Record<string, unknown>)
        : undefined;

    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      return res.status(503).json({
        ok: false,
        error: GEMINI_API_KEY_SETUP_MESSAGE,
        code: "GEMINI_NOT_CONFIGURED",
      });
    }

    const userMessage = buildUserMessage({
      prompt,
      brand,
      product,
      productDescription,
      campaignContext,
    });

    const url = `${GEMINI_REST_BASE}/models/${MODEL}:generateContent`;
    const response = await fetchWithGeminiRateLimitRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
      { operationLabel: "commercial.enhance-prompt" }
    );

    const json = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    if (!response.ok) {
      const message = json?.error?.message || `Gemini request failed (${response.status})`;
      console.error("[api/commercial/enhance-prompt] gemini.error", {
        status: response.status,
        message,
      });
      return res.status(502).json({
        ok: false,
        error: message,
        code: "GEMINI_REQUEST_FAILED",
      });
    }

    const rawText =
      json.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim() || "";

    const enhancedPrompt = sanitizeEnhancedPrompt(rawText);
    if (!enhancedPrompt) {
      console.warn("[api/commercial/enhance-prompt] invalid.output", {
        rawLength: rawText.length,
      });
      return res.status(502).json({
        ok: false,
        error: "Enhancement returned an invalid prompt. Your original text was kept.",
        code: "INVALID_ENHANCED_PROMPT",
      });
    }

    console.log("[api/commercial/enhance-prompt] success", {
      userId,
      inputChars: prompt.length,
      outputChars: enhancedPrompt.length,
      hasBrand: Boolean(brand),
      hasProduct: Boolean(product),
    });

    return res.status(200).json({
      ok: true,
      enhancedPrompt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/commercial/enhance-prompt] failed", { message });
    return res.status(500).json({
      ok: false,
      error: message || "Failed to enhance prompt",
      code: "ENHANCE_PROMPT_FAILED",
    });
  }
}
