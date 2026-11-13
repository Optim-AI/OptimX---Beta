/**
 * Photo Studio edit: change a delivered photo from a plain-words request
 * ("model scooping powder out with a spoon"). The request is first rewritten as a
 * product photographer's brief (pose, hands, camera, light), the photo is edited with
 * the real product attached, and the same fidelity check as a shoot runs (one
 * corrective retry). The edited photo is added next to the original, never over it.
 * Like any new photo it is a free draft: 1 image credit only if it is kept.
 */

import { randomUUID } from "crypto";
import sharp from "sharp";
import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
import { parseJsonLoose } from "@/lib/research/gemini";
import { getDefaultPosterImageProvider } from "@/lib/creative-studio/poster-generation/generation/provider-router";
import { dataUrlToBuffer, detectImageMimeType, fetchUrlToBuffer } from "@/lib/creative-studio/nano-banana";
import type { GenerationSpecification, ImageGenerationProvider, ImageGenerationRequest } from "@/lib/creative-studio/poster-generation/types";
import { CANVAS } from "./packshot";
import { geminiFidelityChecker, MIN_FIDELITY, type FidelityChecker } from "./render";
import { appendResults, assertCanShoot, PhotoStudioError, type PhotoShootState, type ShootLimitDeps } from "./shoot";
import { loadDraftPhoto, photoId, storeDraftPhoto, toPhotoViews } from "./drafts";
import { getShot } from "./shots";
import type { PhotoView, ProductProfile, ShotResult } from "./types";

export const MAX_EDIT_CHARS = 500;

export type BriefWriter = (input: { request: string; profile: ProductProfile; shotLabel: string; photo: Buffer }) => Promise<string | null>;

const BRIEF_PROMPT = (request: string, profile: ProductProfile, shotLabel: string) => `You are a senior commercial product photographer briefing a retoucher.
The attached image is a "${shotLabel}" photo of ${profile.productType || profile.name} (${profile.name}).
The client asked, in plain words (any language): "${request}"

Rewrite the request as a precise English edit brief for this exact photo:
- Say exactly what changes: pose, which hand does what, where the product is held and at what height, gaze, expression, camera angle and distance, framing, lighting direction and mood, props and set.
- Say what stays: same person (face, skin, hair, clothes) unless asked otherwise, same location and overall look unless asked otherwise.
- The product must stay identical: same shape, label, logo, printed text and colours, label facing the camera and readable.
- Keep it physically believable (natural hands, five fingers, realistic grip and scale).
- 3 to 6 short sentences. No preamble.
Return JSON: {"brief": "..."}`;

/** Gemini text pass; null when it isn't available, so the raw request is used instead. */
export const geminiBriefWriter: BriefWriter = async ({ request, profile, shotLabel, photo }) => {
  const key = getGeminiApiKey();
  if (!key) return null;
  try {
    const img = await sharp(photo).resize(768, 768, { fit: "inside" }).jpeg().toBuffer();
    const res = await fetchWithGeminiRateLimitRetry(
      `${GEMINI_REST_BASE}/models/${process.env.PHOTO_STUDIO_VISION_MODEL || "gemini-2.5-flash"}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mime_type: "image/jpeg", data: img.toString("base64") } },
                { text: BRIEF_PROMPT(request, profile, shotLabel) },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(30_000),
      },
      { maxRetries: 1, operationLabel: "photo-studio-edit-brief" }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const parsed = parseJsonLoose<{ brief?: string }>((json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join(""));
    const brief = typeof parsed?.brief === "string" ? parsed.brief.trim() : "";
    return brief ? brief.slice(0, 1500) : null;
  } catch {
    return null;
  }
};

export function editPrompt(brief: string, request: string, fix = ""): string {
  return [
    "Edit the BASE PHOTO into a new finished, photorealistic commercial product photograph.",
    `Make this change: ${brief}`,
    brief === request ? "" : `(The client's own words: "${request}")`,
    "Keep everything the change does not mention as it is in the BASE PHOTO: the same person, styling, location, colour grade and quality.",
    "The product is the one in the PRODUCT photo: reproduce it exactly — same shape, proportions, label artwork, logo, printed text and colours — at its real size, label facing the camera.",
    "Natural, anatomically correct hands and a realistic grip. Sharp focus on the product, accurate true-to-life colour, magazine-quality.",
    "This is the finished photograph as published: no lighting equipment or studio gear in frame. No added text, graphics, borders or watermarks.",
    fix,
  ]
    .filter(Boolean)
    .join("\n");
}

async function load(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const buffer = url.startsWith("data:") ? dataUrlToBuffer(url) : await fetchUrlToBuffer(url);
  return { buffer, mimeType: detectImageMimeType(buffer) || "image/png" };
}

/** Full-size PNGs make multi-MB data URLs that overflow the provider's parsing; send a sharp JPEG instead. */
async function forModel(img: { buffer: Buffer; mimeType: string }): Promise<{ buffer: Buffer; mimeType: string }> {
  const buffer = await sharp(img.buffer).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
  return { buffer, mimeType: "image/jpeg" };
}

export type EditPhotoDeps = {
  provider?: ImageGenerationProvider;
  writeBrief?: BriefWriter;
  checkFidelity?: FidelityChecker;
  loadImage?: (url: string) => Promise<{ buffer: Buffer; mimeType: string }>;
  /** Full file of a draft photo (private storage) */
  loadDraft?: (storagePath: string) => Promise<Buffer>;
  store?: (userId: string, sessionId: string, id: string, buffer: Buffer) => Promise<{ storagePath: string; previewPath: string }>;
  save?: (userId: string, sessionId: string, results: ShotResult[]) => Promise<void>;
  view?: (results: ShotResult[]) => Promise<PhotoView[]>;
  limits?: ShootLimitDeps;
};

/** Edit one photo of a saved shoot; returns the new photo (added after the others). */
export async function editPhoto(
  params: { userId: string; sessionId: string; /** The photo's id (older photos: its address) */ photoId: string; request: string; state: PhotoShootState },
  deps: EditPhotoDeps = {}
): Promise<PhotoView> {
  const { userId, sessionId, state } = params;
  const request = params.request.trim().slice(0, MAX_EDIT_CHARS);
  if (!request) throw new PhotoStudioError("Say what you'd like to change.", 400, "VALIDATION");
  // Only photos this shoot produced — never an arbitrary URL.
  const original = state.results.find((r) => photoId(r) === params.photoId);
  if (!original) throw new PhotoStudioError("That photo isn't part of this shoot.", 404, "NOT_FOUND");

  await assertCanShoot(userId, state, 1, deps.limits);

  const loadImage = deps.loadImage ?? load;
  // A draft's full file is private: read it from storage, never from its preview.
  const loadOriginal = async () => {
    if (original.storagePath && !original.published) {
      const buffer = await (deps.loadDraft ?? loadDraftPhoto)(original.storagePath);
      return { buffer, mimeType: detectImageMimeType(buffer) || "image/png" };
    }
    return loadImage(original.url);
  };
  const [photo, product] = await Promise.all([
    loadOriginal().then(forModel),
    loadImage(state.masterUrl || state.sourceUrl).then(forModel),
  ]);
  const shotLabel = getShot(original.shotId)?.label || "product";
  const brief = (await (deps.writeBrief ?? geminiBriefWriter)({ request, profile: state.profile, shotLabel, photo: photo.buffer }).catch(() => null)) || request;

  const provider = deps.provider ?? getDefaultPosterImageProvider();
  const aspect = original.aspect;
  const generationId = `photo_edit_${randomUUID().slice(0, 12)}`;
  const render = async (fix: string): Promise<Buffer> => {
    const req: ImageGenerationRequest = {
      specification: { aspectRatio: aspect, sessionId, generationId, variantId: generationId } as unknown as GenerationSpecification,
      prompt: editPrompt(brief, request, fix),
      aspectRatio: aspect,
      referenceImages: [
        {
          role: "design_inspiration",
          kind: "design",
          label: "BASE PHOTO",
          instruction: "BASE PHOTO — PRIMARY EDIT SOURCE. Edit this photo as asked; keep what the change does not mention.",
          mimeType: photo.mimeType,
          base64Data: photo.buffer.toString("base64"),
        },
        {
          role: "product_packshot",
          kind: "product",
          label: "PRODUCT (exact appearance)",
          instruction: "The real product. Reproduce it exactly: same shape, proportions, label artwork, logo, printed text and colours.",
          mimeType: product.mimeType,
          base64Data: product.buffer.toString("base64"),
        },
      ],
      mode: "edit",
      baseImage: null,
      metadata: { sessionId, generationId, variantId: generationId, userId },
    };
    const result = await provider.generate(req);
    if (!result.ok || !result.imageBuffer) throw new Error(result.errorMessage || result.errorCode || "Image generation failed");
    const { width, height } = CANVAS[aspect];
    return sharp(result.imageBuffer).resize(width, height, { fit: "cover" }).png().toBuffer();
  };

  const check = deps.checkFidelity ?? geminiFidelityChecker;
  let buffer: Buffer;
  let fidelity: number | null;
  try {
    const first = await render("");
    const f1 = await check(product.buffer, first);
    buffer = first;
    fidelity = f1.checked ? f1.score : null;
    if (f1.checked && f1.score < MIN_FIDELITY) {
      console.info("[photoStudio] edit fidelity low, retrying", { score: f1.score, issues: f1.issues });
      const fix = `PRODUCT FIDELITY FIX — the previous attempt changed the product: ${f1.issues.join("; ") || "label and shape differed"}. Match the PRODUCT photo exactly; keep the requested change.`;
      const second = await render(fix).catch(() => null);
      if (second) {
        const f2 = await check(product.buffer, second);
        if (f2.checked && f2.score > f1.score) {
          buffer = second;
          fidelity = f2.score;
        }
      }
    }
  } catch (e) {
    console.error("[photoStudio] edit failed", { sessionId, error: (e as Error)?.message });
    throw new PhotoStudioError("This edit didn't come out. Try again.", 502, "GENERATION_FAILED");
  }

  const stored = await (deps.store ?? storeDraftPhoto)(userId, sessionId, generationId, buffer);
  const result: ShotResult = {
    id: generationId,
    shotId: original.shotId,
    url: "",
    kept: false,
    ...stored,
    method: "guided",
    aspect,
    fidelity,
    createdAt: new Date().toISOString(),
    editedFrom: photoId(original),
    editRequest: request,
  };
  await (deps.save ?? appendResults)(userId, sessionId, [result]);
  return (await (deps.view ?? toPhotoViews)([result]))[0];
}
