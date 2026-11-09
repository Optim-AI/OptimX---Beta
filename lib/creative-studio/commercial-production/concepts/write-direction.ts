/**
 * "Help me write it" — turns the owner's tap-only answers (who, where, feeling,
 * what viewers should do) plus the product photo into a short plain-language
 * description for the "In your own words" box. The owner can edit it before
 * asking for ideas or generating.
 *
 * Cost per call: one Gemini text call (sees the product photo). No images.
 */

import { getGeminiApiKey, GEMINI_REST_BASE } from "@/lib/gemini-config";
import type { CampaignBrief } from "../campaign/types";
import { adTypeToPromptBlock, getAdTypePlaybook } from "../campaign/ad-type";
import { getCreativeStylePlaybook } from "../campaign/creative-style";
import { adDirectionToPromptBlock } from "../campaign/ad-direction";
import { ugcToPromptBlock } from "../campaign/ugc";
import { loadImageInline } from "../product-understanding/analyze-product";
import { PHOTO_IS_TRUTH, type ConceptWriter } from "./generate-concepts";

export const WRITE_DIRECTION_MODEL = "gemini-3.8-flash";
const REQUEST_TIMEOUT_MS = 45_000;
const MIN_CHARS = 30;
const MAX_CHARS = 1200;

export function buildWriteDirectionPrompt(brief: CampaignBrief): string {
  const names = [brief.product, ...(brief.additionalProducts || [])].map((p) => p.name);
  const style = getCreativeStylePlaybook(brief.creativeStyle);
  return `You help a small-business owner who is not technical describe the video ad they want.
Write what they would say if they could explain it well: 3 to 5 short, simple sentences in plain everyday English.
Describe: who is in the ad and where, what happens (a small, believable story around the product), how it should feel, and what viewers should do at the end.

BRIEF
Brand: ${brief.brand.name}
Products: ${names.join(", ")}
Product details: ${brief.product.category || ""} ${brief.product.description && brief.product.description !== brief.userConcept ? brief.product.description : ""}
Ad length: ${brief.campaignDuration} seconds
Look: ${style.label}
Offer: ${brief.endCard?.offer || brief.offer || "none"}
What the owner already wrote (keep every idea in it): ${brief.userConcept || "nothing yet"}
${adTypeToPromptBlock(getAdTypePlaybook(brief.adType), { productNames: names, occasion: brief.occasion, shopDetails: brief.shopDetails })}
${adDirectionToPromptBlock(brief.adDirection)}
${ugcToPromptBlock(brief.ugc)}
${brief.product.images?.length ? PHOTO_IS_TRUTH : ""}

RULES
- Follow every choice the owner made above exactly (who is on screen, where, the feeling, what viewers should do).
- Name the real product. Never invent prices, discounts, ingredients or health claims that were not given.
- No film or marketing jargon (no "hook", "B-roll", "CTA", "shot", "cinematic", "POV"). No lists, no headings, no quotes.
- People in the ad do not speak on camera; any words come from a voiceover.

Return ONLY the description text.`;
}

export function sanitizeDirectionText(raw: string): string | null {
  let text = raw.trim();
  if (text.startsWith("```")) text = text.replace(/^```(?:\w+)?\s*/i, "").replace(/\s*```$/i, "").trim();
  text = text.replace(/^["'“]|["'”]$/g, "").replace(/\n{3,}/g, "\n\n").trim();
  // A reply cut off mid-sentence ends at its last full sentence.
  if (!/[.!?।…"”)]$/.test(text)) {
    const lastStop = Math.max(text.lastIndexOf(". "), text.lastIndexOf("! "), text.lastIndexOf("? "));
    if (lastStop > 0) text = text.slice(0, lastStop + 1);
  }
  if (text.length < MIN_CHARS) return null;
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS).replace(/\s+\S*$/, "")}…` : text;
}

const liveDirectionWriter: ConceptWriter = async ({ prompt, images }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is required to write the ad description.");
  const res = await fetch(`${GEMINI_REST_BASE}/models/${WRITE_DIRECTION_MODEL}:generateContent`, {
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
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`Writing failed (HTTP ${res.status})`);
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
};

export async function writeAdDirection(
  brief: CampaignBrief,
  options: { writer?: ConceptWriter } = {}
): Promise<string> {
  const writer = options.writer ?? liveDirectionWriter;
  const ref = brief.product.images?.[0];
  const photo = ref ? await loadImageInline(ref).catch(() => null) : null;
  const text = sanitizeDirectionText(
    await writer({ prompt: buildWriteDirectionPrompt(brief), images: photo ? [photo] : [] })
  );
  if (!text) throw new Error("We couldn't write that right now. Please try again.");
  return text;
}
