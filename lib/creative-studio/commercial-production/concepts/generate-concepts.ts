/**
 * Idea cards — three plain-language concepts with a storyboard image each,
 * shown BEFORE the paid video generation.
 *
 * Non-technical users can't judge a prompt, but they can judge three pictures.
 * The picked concept is sent with the generate request as `approvedConcept`,
 * and the Commercial Director must build on it.
 *
 * Cost per call: one Gemini text call + three image calls (one 3-panel strip each).
 */

import sharp from "sharp";
import { getGeminiApiKey, GEMINI_REST_BASE } from "@/lib/gemini-config";
import { generateGeminiImage } from "@/lib/creative-studio/nano-banana";
import type { CampaignBrief } from "../campaign/types";
import { adTypeToPromptBlock, getAdTypePlaybook } from "../campaign/ad-type";
import { creativeStyleToPromptBlock, getCreativeStylePlaybook, REALISM_RULE } from "../campaign/creative-style";
import { loadImageInline } from "../product-understanding/analyze-product";
import { adDirectionToPromptBlock, castLine } from "../campaign/ad-direction";

export const CONCEPTS_MODEL = "gemini-3.8-flash";
const CONCEPT_COUNT = 3;
const STORYBOARD_WIDTH = 960;
const REQUEST_TIMEOUT_MS = 60_000;

export interface ConceptCard {
  id: string;
  title: string;
  /** The idea in one or two short plain sentences. */
  idea: string;
  /** 3–4 story moments, plain words. */
  beats: string[];
  /** Why this idea works for their customers, one sentence. */
  whyItWorks: string;
  /** JPEG data URL of a 3-panel storyboard strip; null when the image failed. */
  storyboardImage: string | null;
}

interface DraftConcept {
  title?: string;
  idea?: string;
  beats?: string[];
  whyItWorks?: string;
  storyboardPanels?: string[];
}

export type StoryboardRenderer = (input: {
  prompt: string;
  productImages: string[];
}) => Promise<Buffer>;

export type ConceptWriter = (input: {
  prompt: string;
  images: Array<{ mimeType: string; data: string }>;
}) => Promise<string>;

/** Owners mistype names; the photo is what the customer will actually receive. */
export const PHOTO_IS_TRUTH =
  "The real product photo(s) are attached — keep the packaging true to them. THE PHOTO IS THE TRUTH: if the typed name or description disagrees with the photo (a different flavour, variant, ingredient or pack), describe and show the product exactly as the photo shows it, never as the mistyped text says.";

function productNames(brief: CampaignBrief): string[] {
  return [brief.product, ...(brief.additionalProducts || [])].map((p) => p.name);
}

export function buildConceptsPrompt(brief: CampaignBrief): string {
  const adType = getAdTypePlaybook(brief.adType);
  const style = getCreativeStylePlaybook(brief.creativeStyle);
  return `You are a senior advertising creative director pitching ideas to a small-business owner who is not technical.
Write ${CONCEPT_COUNT} genuinely DIFFERENT ideas for a ${brief.campaignDuration}-second video ad. Make each idea use a different creative mechanism — e.g. a warm everyday moment, humour or exaggeration, a clear demonstration, a visual metaphor, a sensory close-up feast, a festive celebration — whichever fit this brief.

BRIEF
Brand: ${brief.brand.name}
Products: ${productNames(brief).join(", ")}
What the owner said: ${brief.userConcept || brief.campaignMessage || "not provided"}
Customers: ${brief.targetAudience || "infer from the product"}
Offer: ${brief.endCard?.offer || brief.offer || "none"}
${adTypeToPromptBlock(adType, { productNames: productNames(brief), occasion: brief.occasion, shopDetails: brief.shopDetails })}
${creativeStyleToPromptBlock(style, brief.campaignDuration)}
${adDirectionToPromptBlock(brief.adDirection)}
${brief.product.images?.length ? PHOTO_IS_TRUTH : ""}
${REALISM_RULE}

WRITE FOR THE OWNER
- Very simple English, short sentences, no marketing or film jargon (no "hook", "B-roll", "CTA", "POV").
- title: 2–5 words. idea: 1–2 sentences. beats: 3 or 4 short moments in order. whyItWorks: one sentence about their customers.
- storyboardPanels: exactly 3 visual descriptions (what the camera sees) for the 3 key moments, consistent people and setting across panels.
- Never invent prices, discounts or claims that were not given.

Return JSON only:
{ "concepts": [ { "title": "", "idea": "", "beats": [""], "whyItWorks": "", "storyboardPanels": ["", "", ""] } ] }`;
}

export function buildStoryboardPrompt(brief: CampaignBrief, draft: DraftConcept): string {
  const panels = (draft.storyboardPanels || []).slice(0, 3);
  return `A clean storyboard strip of exactly 3 panels side by side, separated by thin white gutters, for a video ad.
Panel 1: ${panels[0] || draft.beats?.[0] || ""}
Panel 2: ${panels[1] || draft.beats?.[1] || ""}
Panel 3: ${panels[2] || draft.beats?.[2] || ""}
Style: polished colour storyboard illustration, cinematic framing, consistent characters and setting across panels.
${castLine(brief.adDirection) ? `People: ${castLine(brief.adDirection)}.` : ""}
${brief.product.images?.length ? "The product must look exactly like the attached product photo (same packaging, label colours, label artwork and shape). If a panel description names a different flavour or variant than the photo shows, draw what the photo shows." : ""}
No text, captions, letters, numbers or speech bubbles anywhere.`;
}

function parseDrafts(text: string): DraftConcept[] {
  try {
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) as {
      concepts?: DraftConcept[];
    };
    return (parsed.concepts || []).filter((c) => c?.title && c?.idea).slice(0, CONCEPT_COUNT);
  } catch {
    return [];
  }
}

const liveConceptWriter: ConceptWriter = async ({ prompt, images }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error("GEMINI_API_KEY is required to write ad ideas.");
  const res = await fetch(`${GEMINI_REST_BASE}/models/${CONCEPTS_MODEL}:generateContent`, {
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
      generationConfig: { temperature: 0.95, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) throw new Error(`Idea generation failed (HTTP ${res.status})`);
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
};

const liveStoryboardRenderer: StoryboardRenderer = async ({ prompt, productImages }) => {
  const result = await generateGeminiImage({
    prompt,
    aspectRatio: "16:9",
    references: productImages.slice(0, 3).map((src, i) => ({
      dataUrlOrHttp: src,
      instruction: `Product reference ${i + 1}: match this packaging exactly.`,
    })),
    operationLabel: "commercial-concept-storyboard",
    maxRetries: 2,
  });
  return result.buffer;
};

/** Crop the plain white/flat bands image models sometimes leave around the strip. */
async function trimFlatBorders(buffer: Buffer): Promise<Buffer> {
  try {
    const { data, info } = await sharp(buffer).trim({ threshold: 40 }).toBuffer({ resolveWithObject: true });
    const original = await sharp(buffer).metadata();
    // Never trim away most of the picture (e.g. a mostly-white scene).
    if (original.width && original.height && info.width * info.height < original.width * original.height * 0.5) {
      return buffer;
    }
    return data;
  } catch {
    return buffer;
  }
}

export async function toJpegDataUrl(buffer: Buffer): Promise<string> {
  const jpeg = await sharp(await trimFlatBorders(buffer)).resize({ width: STORYBOARD_WIDTH, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

export async function generateConceptCards(
  brief: CampaignBrief,
  options: { writer?: ConceptWriter; renderer?: StoryboardRenderer } = {}
): Promise<ConceptCard[]> {
  const writer = options.writer ?? liveConceptWriter;
  const renderer = options.renderer ?? liveStoryboardRenderer;

  const refs = [brief.product, ...(brief.additionalProducts || [])]
    .map((p) => p.images?.[0])
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .slice(0, 3);
  const inline = (await Promise.all(refs.map((r) => loadImageInline(r).catch(() => null)))).filter(
    (img): img is { mimeType: string; data: string } => img != null
  );

  const drafts = parseDrafts(await writer({ prompt: buildConceptsPrompt(brief), images: inline }));
  if (!drafts.length) {
    throw new Error("We couldn't come up with ideas right now. Please try again.");
  }

  const productImages = inline.map((img) => `data:${img.mimeType};base64,${img.data}`);
  return Promise.all(
    drafts.map(async (draft, i): Promise<ConceptCard> => {
      let storyboardImage: string | null = null;
      try {
        storyboardImage = await toJpegDataUrl(
          await renderer({ prompt: buildStoryboardPrompt(brief, draft), productImages })
        );
      } catch (err) {
        console.warn("[concepts] storyboard failed", err instanceof Error ? err.message : err);
      }
      return {
        id: `idea-${i + 1}`,
        title: String(draft.title).trim(),
        idea: String(draft.idea).trim(),
        beats: (draft.beats || []).map((b) => String(b).trim()).filter(Boolean).slice(0, 4),
        whyItWorks: String(draft.whyItWorks || "").trim(),
        storyboardImage,
      };
    })
  );
}

export const __test__ = { parseDrafts };
