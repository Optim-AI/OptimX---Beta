/**
 * Rendering one Photo Studio shot.
 *
 *  exact  → renderPackshot (deterministic composite of the real cut-out)
 *  scene  → the real product is placed in the frame first and the AI builds the set
 *           AROUND it (perspective, surface, contact shadow and light all made for the
 *           product), then the exact product pixels are put back (labels never
 *           redrawn). Fallback: AI shoots an empty set and the product is composited
 *           in and relit.
 *  guided → AI renders the whole shot from the product photo (held / used / flat lay),
 *           then a vision fidelity check; one corrective reshoot if the product drifted
 */

import sharp from "sharp";
import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
import { parseJsonLoose } from "@/lib/research/gemini";
import { gradeCutout, harmonizeProduct, MIN_PRODUCT_SIMILARITY, structuralSimilarity } from "@/lib/creative-studio/poster-templates/harmonize";
import type { GenerationSpecification, ImageGenerationProvider, ImageGenerationRequest } from "@/lib/creative-studio/poster-generation/types";
import { CANVAS, renderPackshot, scenePlacement, tintHex } from "./packshot";
import { getShot, shotDirection } from "./shots";
import type { PhotoAspect, ProductProfile, ShootSettings, ShotMethod } from "./types";

export type RenderInput = {
  shotId: string;
  profile: ProductProfile;
  settings: ShootSettings;
  aspect: PhotoAspect;
  /** Original product photo */
  source: { buffer: Buffer; mimeType: string };
  /** Background-removed product (null when no cut-out provider / not clean) */
  cutout: Buffer | null;
  provider: ImageGenerationProvider;
  userId: string;
  sessionId: string;
  generationId: string;
  /** 0 = first take; 1 = a clearly different second take */
  variation?: number;
  /** Inject for tests */
  checkFidelity?: FidelityChecker;
};

/** What makes the second take different (set, props, light, angle) — same product. */
const SECOND_TAKE_SCENE =
  "SECOND TAKE — make this clearly different from a first take of the same shot: a different surface material and set palette within the same colour family, a different arrangement of props, and the key light coming from the other side.";
const SECOND_TAKE_GUIDED =
  "SECOND TAKE — make this clearly different from a first take of the same shot: a different camera angle and framing (e.g. closer, or a three-quarter view), a different location detail and a different arrangement around the product.";
const take = (input: RenderInput, text: string) => ((input.variation ?? 0) % 2 ? text : "");

export type RenderOutput = { buffer: Buffer; method: ShotMethod; fidelity: number | null };

export type FidelityResult = { checked: boolean; score: number; issues: string[] };
export type FidelityChecker = (original: Buffer, generated: Buffer) => Promise<FidelityResult>;

/** The final photograph, never a behind-the-scenes view of the studio. */
const FINAL_FRAME =
  "This is the finished photograph as published: no lighting equipment, softboxes, light stands, umbrellas, reflectors, tripods or studio gear anywhere in frame.";

/** How a top product photographer shoots it — applied to every AI-made photo. */
const PRO_PHOTO =
  "Shot like a top commercial product photographer: full-frame high-resolution mirrorless camera, 90mm macro lens for product detail (85mm for people), sharp focus on the product with crisp label and edge detail, controlled key light with soft fill and a subtle rim light to separate it from the background, accurate true-to-life colour, clean professional colour grade, magazine-quality.";

const NO_PRODUCT_IN_SET =
  FINAL_FRAME +
  " IMPORTANT: the set is EMPTY — no product, packaging, bottle, jar, box or container anywhere; the centre spot is left clear for a product that will be added later. No text, letters, logos or watermarks. No people.";

/** Minimal spec the provider/harmonise pass needs (they only read ids and aspect). */
function specStub(input: RenderInput): GenerationSpecification {
  return {
    aspectRatio: input.aspect,
    sessionId: input.sessionId,
    generationId: input.generationId,
    variantId: input.generationId,
  } as unknown as GenerationSpecification;
}

function request(input: RenderInput, prompt: string, refs: ImageGenerationRequest["referenceImages"]): ImageGenerationRequest {
  return {
    specification: specStub(input),
    prompt,
    aspectRatio: input.aspect,
    referenceImages: refs,
    mode: "generate",
    baseImage: null,
    metadata: { sessionId: input.sessionId, generationId: input.generationId, variantId: input.generationId, userId: input.userId },
  };
}

async function generate(input: RenderInput, prompt: string, withProduct: boolean): Promise<Buffer> {
  return run(input, request(input, prompt, withProduct ? [productRef(input.source)] : []));
}

function productRef(source: { buffer: Buffer; mimeType: string }): ImageGenerationRequest["referenceImages"][number] {
  return {
    role: "product_packshot",
    kind: "product",
    label: "PRODUCT (exact appearance)",
    instruction: "The real product. Reproduce it exactly: same shape, proportions, label artwork, logo, printed text and colours.",
    mimeType: source.mimeType,
    base64Data: source.buffer.toString("base64"),
  };
}

async function run(input: RenderInput, req: ImageGenerationRequest): Promise<Buffer> {
  const result = await input.provider.generate(req);
  if (!result.ok || !result.imageBuffer) throw new Error(result.errorMessage || result.errorCode || "Image generation failed");
  const { width, height } = CANVAS[input.aspect];
  return sharp(result.imageBuffer).resize(width, height, { fit: "cover" }).png().toBuffer();
}

function aroundPrompt(input: RenderInput, float: boolean, retry: boolean): string {
  return [
    "Edit the BASE IMAGE into one finished, photorealistic product photograph.",
    "The product in it is real and final: keep it exactly where it is, exactly the same size and angle, with its label, logo, printed text, colours and shape untouched.",
    `Replace the plain backdrop with this set, built around the product: ${shotDirection(input.shotId, input.profile, input.settings, { around: true })}`,
    "The camera is at the product's height looking straight at it, so the set's perspective, horizon and scale match the product exactly.",
    float
      ? "The product floats in mid-air with nothing under it; the elements around it are frozen at the same moment."
      : "Build the surface it stands on right under its base so it rests on it firmly, with a natural contact shadow and the reflection that surface would show.",
    "Light the set from the same direction and colour temperature as the light on the product. Props may sit beside or behind the product but never in front of it.",
    PRO_PHOTO,
    FINAL_FRAME,
    "No added text, letters, logos or watermarks. No people.",
    take(input, SECOND_TAKE_SCENE),
    retry ? "IMPORTANT: the previous attempt moved or redrew the product. Leave the product's pixels exactly as they are in the BASE IMAGE." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Set built around the product already in the frame; the exact product is put back. Null if the model moved it. */
async function renderAround(input: RenderInput, cutout: Buffer): Promise<Buffer | null> {
  const meta = await sharp(cutout).metadata();
  const float = input.shotId === "levitation";
  const place = scenePlacement(input.aspect, meta.width || 1, meta.height || 1, float ? "float" : "surface", input.variation ?? 0);
  const png = await sharp(cutout).resize(place.width, place.height).png().toBuffer();
  const { width, height } = CANVAS[input.aspect];
  const base = await sharp({ create: { width, height, channels: 3, background: tintHex(input.settings.backdrop, 0.55) } })
    .composite([{ input: png, left: place.left, top: place.top }])
    .png()
    .toBuffer();
  // Compare the product's inner area only (its corners show backdrop, which changes).
  const inner = {
    left: place.left + Math.round(place.width * 0.15),
    top: place.top + Math.round(place.height * 0.1),
    width: Math.max(8, Math.round(place.width * 0.7)),
    height: Math.max(8, Math.round(place.height * 0.8)),
  };
  for (const retry of [false, true]) {
    const lit = await run(
      input,
      {
        ...request(input, aroundPrompt(input, float, retry), [
          {
            role: "design_inspiration",
            kind: "design",
            label: "BASE IMAGE — product in frame",
            instruction: "BASE IMAGE — PRIMARY EDIT SOURCE. Edit this exact image as instructed; keep its framing and the product.",
            mimeType: "image/png",
            base64Data: base.toString("base64"),
          },
          { ...productRef({ buffer: png, mimeType: "image/png" }), instruction: "The product as it really looks. It must stay exactly like this." },
        ]),
        mode: "edit",
      }
    ).catch(() => null);
    if (!lit) continue;
    const [before, after] = await Promise.all([
      sharp(base).extract(inner).png().toBuffer(),
      sharp(lit).extract(inner).png().toBuffer(),
    ]);
    const similarity = await structuralSimilarity(before, after);
    if (similarity < MIN_PRODUCT_SIMILARITY) {
      console.info("[photoStudio] scene moved the product", { shot: input.shotId, similarity: +similarity.toFixed(2) });
      continue;
    }
    const region = await sharp(lit).extract({ left: place.left, top: place.top, width: place.width, height: place.height }).png().toBuffer();
    const graded = await gradeCutout(png, region);
    return sharp(lit).composite([{ input: graded, left: place.left, top: place.top }]).png().toBuffer();
  }
  return null;
}

async function renderScene(input: RenderInput, cutout: Buffer): Promise<Buffer> {
  const around = await renderAround(input, cutout);
  if (around) return around;
  const direction = shotDirection(input.shotId, input.profile, input.settings);
  const set = await generate(input, `Photorealistic professional product photography set. ${direction} ${PRO_PHOTO} ${NO_PRODUCT_IN_SET} ${take(input, SECOND_TAKE_SCENE)}`, false);
  const meta = await sharp(cutout).metadata();
  const float = input.shotId === "levitation";
  const place = scenePlacement(input.aspect, meta.width || 1, meta.height || 1, float ? "float" : "surface", input.variation ?? 0);
  const png = await sharp(cutout).resize(place.width, place.height).png().toBuffer();
  const layers: sharp.OverlayOptions[] = [];
  if (!float) {
    const sw = Math.round(place.width * 1.05);
    const sh = Math.max(20, Math.round(place.width * 0.12));
    const shadow = await sharp(
      Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh}"><ellipse cx="${sw / 2}" cy="${sh / 2}" rx="${sw * 0.42}" ry="${sh * 0.3}" fill="#000" fill-opacity="0.35"/></svg>`)
    )
      .blur(Math.max(4, sh * 0.25))
      .png()
      .toBuffer();
    layers.push({ input: shadow, left: place.left + Math.round((place.width - sw) / 2), top: place.top + place.height - Math.round(sh / 2) });
  }
  layers.push({ input: png, left: place.left, top: place.top });
  const composite = await sharp(set).composite(layers).png().toBuffer();
  const lit = await harmonizeProduct({
    base: composite,
    product: { png, ...place },
    canvas: CANVAS[input.aspect],
    spec: specStub(input),
    provider: input.provider,
    userId: input.userId,
  });
  if (!lit.ok) console.info("[photoStudio] harmonise skipped", { shot: input.shotId, reason: lit.reason });
  return lit.ok ? lit.buffer : composite;
}

const FIDELITY_PROMPT = `Image 1 is the real product. Image 2 is a generated product photo that must show the SAME product.
Compare only the product (ignore background, hands, people, props). Check shape and proportions, colours, label layout, logo, and printed text (spelling).
Return JSON: {"score": 0-10 (10 = identical product), "issues": ["specific differences, e.g. 'label text says Crunchie instead of Crunchy'"]}`;

export const geminiFidelityChecker: FidelityChecker = async (original, generated) => {
  const key = getGeminiApiKey();
  if (!key) return { checked: false, score: 10, issues: [] };
  try {
    const [a, b] = await Promise.all([
      sharp(original).resize(768, 768, { fit: "inside" }).jpeg().toBuffer(),
      sharp(generated).resize(1024, 1024, { fit: "inside" }).jpeg().toBuffer(),
    ]);
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
                { inline_data: { mime_type: "image/jpeg", data: a.toString("base64") } },
                { inline_data: { mime_type: "image/jpeg", data: b.toString("base64") } },
                { text: FIDELITY_PROMPT },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(30_000),
      },
      { maxRetries: 1, operationLabel: "photo-studio-fidelity" }
    );
    if (!res.ok) return { checked: false, score: 10, issues: [] };
    const json = (await res.json()) as any;
    const parsed = parseJsonLoose<{ score?: number; issues?: string[] }>(
      (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("")
    );
    const score = Number(parsed?.score);
    return {
      checked: Number.isFinite(score),
      score: Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 10,
      issues: Array.isArray(parsed?.issues) ? parsed!.issues.map(String).slice(0, 6) : [],
    };
  } catch {
    return { checked: false, score: 10, issues: [] };
  }
};

/** Below this the product drifted (wrong label/shape/colour) and gets one reshoot. */
export const MIN_FIDELITY = 7;

function guidedPrompt(input: RenderInput, extra = ""): string {
  const p = input.profile;
  const direction =
    input.shotId === "marketplace_white" || input.shotId === "color_sweep" || input.shotId === "acrylic_reflection"
      ? `A clean e-commerce studio packshot of the product on a ${input.shotId === "marketplace_white" ? "pure white (#FFFFFF) seamless" : `${input.settings.backdrop} seamless paper`} background${input.shotId === "acrylic_reflection" ? " standing on glossy acrylic with a clean mirror reflection" : ""}, soft even light, soft contact shadow, product centred and large in frame.`
      : shotDirection(input.shotId, p, input.settings);
  return [
    `Create a photorealistic professional product photograph. ${direction}`,
    `The product is the one in the attached PRODUCT photo (${p.productType || p.name}): reproduce it exactly — same shape, proportions, label artwork, logo, printed text and colours — at a realistic real-world size (${p.sizeClass}).`,
    "Commercial photography quality: sharp focus on the product, accurate colour, natural skin and hands, believable materials and shadows.",
    PRO_PHOTO,
    "No added text, graphics, borders or watermarks.",
    FINAL_FRAME,
    take(input, SECOND_TAKE_GUIDED),
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

async function renderGuided(input: RenderInput): Promise<{ buffer: Buffer; fidelity: number | null }> {
  const check = input.checkFidelity ?? geminiFidelityChecker;
  const first = await generate(input, guidedPrompt(input), true);
  const f1 = await check(input.source.buffer, first);
  if (!f1.checked || f1.score >= MIN_FIDELITY) return { buffer: first, fidelity: f1.checked ? f1.score : null };
  console.info("[photoStudio] fidelity low, reshooting", { shot: input.shotId, score: f1.score, issues: f1.issues });
  const fix = `PRODUCT FIDELITY FIX — the previous attempt changed the product: ${f1.issues.join("; ") || "label and shape differed"}. Match the PRODUCT photo exactly; keep the same scene and composition.`;
  const second = await generate(input, guidedPrompt(input, fix), true).catch(() => null);
  if (!second) return { buffer: first, fidelity: f1.score };
  const f2 = await check(input.source.buffer, second);
  return f2.checked && f2.score > f1.score ? { buffer: second, fidelity: f2.score } : { buffer: first, fidelity: f1.score };
}

export async function renderShot(input: RenderInput): Promise<RenderOutput> {
  const shot = getShot(input.shotId);
  if (!shot) throw new Error(`Unknown shot ${input.shotId}`);
  // Exact and scene shots need the real cut-out; without one they're shot guided.
  const method: ShotMethod = shot.method !== "guided" && !input.cutout ? "guided" : shot.method;

  if (method === "exact") {
    const style = shot.id === "marketplace_white" ? "white" : shot.id === "acrylic_reflection" ? "reflection" : "sweep";
    // Second take: a paler sweep with the product smaller, or a deep-toned reflection set.
    const second = (input.variation ?? 0) % 2 === 1 && style !== "white";
    const backdrop = second ? tintHex(input.settings.backdrop, style === "reflection" ? -0.65 : 0.55) : input.settings.backdrop;
    const buffer = await renderPackshot({ cutout: input.cutout!, aspect: input.aspect, style, backdrop, fill: second && style === "sweep" ? 0.5 : undefined });
    return { buffer, method, fidelity: 10 };
  }
  if (method === "scene") {
    return { buffer: await renderScene(input, input.cutout!), method, fidelity: 10 };
  }
  const g = await renderGuided(input);
  return { buffer: g.buffer, method, fidelity: g.fidelity };
}
