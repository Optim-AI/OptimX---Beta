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
import { CANVAS, laidAngle, laidPlacement, renderPackshot, scenePlacement, tintHex } from "./packshot";
import { getShot, lightingFor, modelDescription, shotDirection } from "./shots";
import { writeShotBrief, type ArtDirector } from "./art-direct";
import type { PhotoAspect, ProductProfile, ShootSettings, ShotBrief, ShotMethod } from "./types";

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
  /** A scene already written for this shot; otherwise the art director writes one */
  brief?: ShotBrief | null;
  /** Scene writer (null = use the shot's template). Default: the live art director. */
  artDirector?: ArtDirector | null;
};

/** Stronger image model for the last reshoot when the label still comes out wrong. */
export function photoProImageModel(): string {
  return process.env.PHOTO_STUDIO_PRO_IMAGE_MODEL || "gemini-3-pro-image";
}

/** A rendered shot whose label could not be kept accurate; it is never delivered. */
export class LabelDriftError extends Error {
  constructor(readonly issues: string[]) {
    super("The product's label could not be kept accurate in this shot.");
    this.name = "LabelDriftError";
  }
}

/** The scene for this shot: the art director's brief, or the shot's template. */
function direction(input: RenderInput, opts: { around?: boolean } = {}): string {
  const brief = input.brief?.scene;
  if (!brief) return shotDirection(input.shotId, input.profile, input.settings, opts);
  // Around a pasted product the brief describes the set only; a full "photograph of…" invites a redraw.
  return opts.around ? brief : `A professional product photograph. ${brief}`;
}

/** The product in words, so the model has the label's spelling as text too. */
function productInWords(p: ProductProfile): string {
  const words = (p.labelText || []).filter(Boolean).slice(0, 8);
  return [
    p.look ? `It is ${p.look.replace(/\.$/, "")}.` : "",
    words.length ? `Its label reads, spelled exactly: ${words.map((w) => `"${w}"`).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** What makes the second take different (set, props, light, angle) — same product. */
const SECOND_TAKE_SCENE =
  "SECOND TAKE — make this clearly different from a first take of the same shot: a different surface material and set palette within the same colour family, a different arrangement of props, and the key light coming from the other side.";
const SECOND_TAKE_GUIDED =
  "SECOND TAKE — make this clearly different from a first take of the same shot: a different camera angle and framing (e.g. closer, or a three-quarter view), a different location detail and a different arrangement around the product.";
const take = (input: RenderInput, text: string) => ((input.variation ?? 0) % 2 ? text : "");

export type RenderOutput = { buffer: Buffer; method: ShotMethod; fidelity: number | null };

export type FidelityResult = { checked: boolean; score: number; issues: string[]; /** Readable label words spelled wrong */ wrongWords?: string[] };
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

async function generate(input: RenderInput, prompt: string, withProduct: boolean, model?: string): Promise<Buffer> {
  return run(input, { ...request(input, prompt, withProduct ? [productRef(input.source)] : []), ...(model ? { model } : {}) });
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

function aroundPrompt(input: RenderInput, float: boolean, retry: boolean, laid = false): string {
  if (laid) {
    return [
      "Edit the BASE IMAGE into one finished, photorealistic top-down flat-lay photograph.",
      "The product in it is real and final: keep it exactly where it is, exactly the same size and angle, with its label, logo, printed text, colours and shape untouched.",
      `Replace the plain backdrop with this flat lay, arranged around the product: ${direction(input, { around: true })}`,
      "The camera looks straight down from directly overhead. The product is lying flat on the surface; give it a soft, natural contact shadow along one side, as an object lying on a table has.",
      "Everything else also lies flat on the same surface, seen from above, at a believable scale next to the product. Nothing overlaps or covers the product.",
      "One soft light from the upper left for the whole picture, with gentle shadows falling the same way.",
      PRO_PHOTO,
      FINAL_FRAME,
      "No added text, letters, logos or watermarks. No people.",
      take(input, SECOND_TAKE_SCENE),
      retry ? "IMPORTANT: the previous attempt moved or redrew the product. Leave the product's pixels exactly as they are in the BASE IMAGE." : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  return [
    "Edit the BASE IMAGE into one finished, photorealistic product photograph. This is an edit, not a new picture: only the plain backdrop changes.",
    "The product in it is real and final: keep it exactly where it is, exactly the same size and angle, with its label, logo, printed text, colours and shape untouched. Do not enlarge, move or redraw it.",
    `Replace the plain backdrop with this set, built around the product: ${direction(input, { around: true })}`,
    input.brief?.placement ? `The product is already in place on the ${input.brief.placement === "centre" ? "centre" : `${input.brief.placement} side`} of the BASE IMAGE; build the scene's other elements in the space around it.` : "",
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

/** The cut-out sized and positioned for this shot (rotated when it lies flat). */
async function placeProduct(input: RenderInput, cutout: Buffer) {
  const float = input.shotId === "levitation";
  const laid = getShot(input.shotId)?.pose === "laid";
  const variation = input.variation ?? 0;
  const source = laid
    ? await sharp(cutout).rotate(laidAngle(variation), { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
    : cutout;
  const meta = await sharp(source).metadata();
  const place = laid
    ? laidPlacement(input.aspect, meta.width || 1, meta.height || 1, variation)
    : scenePlacement(input.aspect, meta.width || 1, meta.height || 1, float ? "float" : "surface", variation, input.brief?.placement);
  const png = await sharp(source).resize(place.width, place.height).png().toBuffer();
  return { png, place, float, laid };
}

type SceneOutput = { buffer: Buffer; fidelity: number | null; redrawn: boolean };

/**
 * Set built around the product already in the frame; the exact product is put back.
 * When the model redraws the whole photo instead, that photo is kept only if its
 * label passes the same check as any AI-drawn shot. Null if neither worked.
 */
async function renderAround(input: RenderInput, cutout: Buffer): Promise<SceneOutput | null> {
  const { png, place, float, laid } = await placeProduct(input, cutout);
  const { width, height } = CANVAS[input.aspect];
  const base = await sharp({ create: { width, height, channels: 3, background: tintHex(input.settings.backdrop, 0.55) } })
    .composite([{ input: png, left: place.left, top: place.top }])
    .png()
    .toBuffer();
  // Compare the product's inner area only (its corners show backdrop, which changes).
  // (A rotated product's box has more backdrop in it, so only its middle is compared.)
  const [mx, my] = laid ? [0.32, 0.32] : [0.15, 0.1];
  const inner = {
    left: place.left + Math.round(place.width * mx),
    top: place.top + Math.round(place.height * my),
    width: Math.max(8, Math.round(place.width * (1 - 2 * mx))),
    height: Math.max(8, Math.round(place.height * (1 - 2 * my))),
  };
  for (const retry of [false, true]) {
    const lit = await run(
      input,
      {
        ...request(input, aroundPrompt(input, float, retry, laid), [
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
      // The model drew a new photo (often a good one). Its label is no longer the real pixels, so check it.
      const f = await (input.checkFidelity ?? geminiFidelityChecker)(input.source.buffer, lit);
      console.info("[photoStudio] scene redrew the product", { shot: input.shotId, similarity: +similarity.toFixed(2), checked: f.checked, score: f.score, issues: f.issues });
      if (f.checked && f.score >= MIN_FIDELITY) return { buffer: lit, fidelity: f.score, redrawn: true };
      continue;
    }
    const region = await sharp(lit).extract({ left: place.left, top: place.top, width: place.width, height: place.height }).png().toBuffer();
    const graded = await gradeCutout(png, region);
    return { buffer: await sharp(lit).composite([{ input: graded, left: place.left, top: place.top }]).png().toBuffer(), fidelity: 10, redrawn: false };
  }
  return null;
}

async function renderScene(input: RenderInput, cutout: Buffer): Promise<SceneOutput> {
  const around = await renderAround(input, cutout);
  if (around) return around;
  const setDirection = input.brief?.scene
    ? `The set for this photograph, shot with the product's spot left empty: ${input.brief.scene}`
    : shotDirection(input.shotId, input.profile, input.settings);
  const set = await generate(input, `Photorealistic professional product photography set. ${setDirection} ${PRO_PHOTO} ${NO_PRODUCT_IN_SET} ${take(input, SECOND_TAKE_SCENE)}`, false);
  const { png, place, float, laid } = await placeProduct(input, cutout);
  const layers: sharp.OverlayOptions[] = [];
  if (laid) {
    // Lying flat: a soft shadow of its own outline, offset down-right.
    const alpha = await sharp(png).ensureAlpha().extractChannel("alpha").blur(Math.max(6, place.width * 0.02)).linear(0.4, 0).toBuffer();
    const shadow = await sharp({ create: { width: place.width, height: place.height, channels: 3, background: "#000" } }).joinChannel(alpha).png().toBuffer();
    const off = Math.round(place.width * 0.025);
    layers.push({ input: shadow, left: place.left + off, top: place.top + off });
  } else if (!float) {
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
  return { buffer: lit.ok ? lit.buffer : composite, fidelity: 10, redrawn: false };
}

/** Vision model for the product read, the scene writer and the label check. */
export function photoVisionModel(): string {
  return process.env.PHOTO_STUDIO_VISION_MODEL || "gemini-3.8-flash";
}

const FIDELITY_PROMPT = `Image 1 is the real product. Image 2 is a generated product photo that must show the SAME product.
Compare only the product (ignore background, hands, people, props). In Image 2 the product may be seen from another angle, tilted, lying down, open, folded, worn or partly cropped — that is fine; judge only what is visible.
1. Check shape and proportions, colours, label layout and logo.
2. Read EVERY printed word on the product in Image 2, including the smallest print (icon captions, weight, taglines), and compare each with Image 1.
   - "wrongWords": words that are clearly readable in Image 2 but spelled differently from Image 1, or garbled into letter-like shapes that are not real words. Give them as "what Image 2 shows → what it should be".
   - Words that are simply too small or too blurred to read at all are NOT wrong words (a real camera loses them too).
3. "score" rates ONLY shape, proportions, colours, label layout and logo (never the spelling — that is what wrongWords is for):
   10 = the same product; 9 = differences only visible on very close inspection; 7-8 = small but noticeable differences; 5-6 = a shopper would notice the pack looks different; below 5 = a different product. Changes caused only by the new angle, lighting, reflections or perspective do not lower the score.
Return JSON: {"score": 0-10, "issues": ["specific differences in shape, colour, layout or logo"], "wrongWords": ["HIGH IN FIEER → HIGH IN FIBER"]}`;

/** A shot with wrong readable words on the label can never score above this. */
export const WRONG_WORDS_MAX_SCORE = 5;

async function fidelityJpeg(image: Buffer, max: number): Promise<Buffer> {
  return sharp(image).resize(max, max, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 92 }).toBuffer();
}

export const geminiFidelityChecker: FidelityChecker = async (original, generated) => {
  const key = getGeminiApiKey();
  if (!key) return { checked: false, score: 10, issues: [] };
  try {
    // Full-size images: small label print is unreadable in a shrunken copy.
    const [a, b] = await Promise.all([fidelityJpeg(original, 1600), fidelityJpeg(generated, 2048)]);
    const res = await fetchWithGeminiRateLimitRetry(
      `${GEMINI_REST_BASE}/models/${photoVisionModel()}:generateContent?key=${key}`,
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
          generationConfig: { temperature: 0, responseMimeType: "application/json", mediaResolution: "MEDIA_RESOLUTION_HIGH" },
        }),
        signal: AbortSignal.timeout(45_000),
      },
      { maxRetries: 1, operationLabel: "photo-studio-fidelity" }
    );
    if (!res.ok) return { checked: false, score: 10, issues: [] };
    const json = (await res.json()) as any;
    const parsed = parseJsonLoose<{ score?: number; issues?: string[]; wrongWords?: string[] }>(
      (json?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || "").join("")
    );
    return scoreFidelity(parsed);
  } catch {
    return { checked: false, score: 10, issues: [] };
  }
};

/** Turn the checker's answer into a result; wrong label words cap the score. */
export function scoreFidelity(parsed: { score?: number; issues?: unknown; wrongWords?: unknown } | null | undefined): FidelityResult {
  const raw = Number(parsed?.score);
  if (!Number.isFinite(raw)) return { checked: false, score: 10, issues: [] };
  const list = (v: unknown) => (Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 8) : []);
  const wrongWords = list(parsed?.wrongWords);
  const score = Math.max(0, Math.min(10, raw));
  return {
    checked: true,
    score: wrongWords.length ? Math.min(score, WRONG_WORDS_MAX_SCORE) : score,
    issues: [...wrongWords.map((w) => `label text wrong: ${w}`), ...list(parsed?.issues)].slice(0, 8),
    wrongWords,
  };
}

/** Below this the product drifted (wrong label/shape/colour) and gets one reshoot. */
export const MIN_FIDELITY = 7;

function guidedPrompt(input: RenderInput, extra = ""): string {
  const p = input.profile;
  const sceneText =
    input.shotId === "marketplace_white" || input.shotId === "color_sweep" || input.shotId === "acrylic_reflection"
      ? `A clean e-commerce studio packshot of the product on a ${input.shotId === "marketplace_white" ? "pure white (#FFFFFF) seamless" : `${input.settings.backdrop} seamless paper`} background${input.shotId === "acrylic_reflection" ? " standing on glossy acrylic with a clean mirror reflection" : ""}, soft even light, soft contact shadow, product centred and large in frame.`
      : direction(input);
  return [
    `Create a photorealistic professional product photograph. ${sceneText}`,
    `The product is the one in the attached PRODUCT photo (${p.productType || p.name}): reproduce it exactly — same shape, proportions, label artwork, logo, printed text and colours — at a realistic real-world size (${p.sizeClass}). ${productInWords(p)}`,
    "Every word printed on the product, down to the smallest caption, is spelled exactly as in the PRODUCT photo. If print would be too small to render cleanly at this distance, keep it as fine sharp detail rather than inventing letters.",
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

/** Reshoots a guided shot gets before it is dropped (the last one on the stronger model). */
export const MAX_GUIDED_ATTEMPTS = 3;

async function renderGuided(input: RenderInput): Promise<{ buffer: Buffer; fidelity: number | null }> {
  const check = input.checkFidelity ?? geminiFidelityChecker;
  let best: { buffer: Buffer; result: FidelityResult } | null = null;
  let fix = "";
  for (let attempt = 0; attempt < MAX_GUIDED_ATTEMPTS; attempt++) {
    // Last try: a stronger image model, which holds small print better.
    const model = attempt === MAX_GUIDED_ATTEMPTS - 1 ? photoProImageModel() : undefined;
    const shot = await generate(input, guidedPrompt(input, fix), true, model).catch((e) => {
      if (attempt === 0) throw e;
      return null;
    });
    if (!shot) continue;
    const result = await check(input.source.buffer, shot);
    // No checker available (no key, outage): deliver the first photo unchecked, as before.
    if (!result.checked) return best ? { buffer: best.buffer, fidelity: best.result.score } : { buffer: shot, fidelity: null };
    if (!best || result.score > best.result.score) best = { buffer: shot, result };
    if (result.score >= MIN_FIDELITY) return { buffer: shot, fidelity: result.score };
    console.info("[photoStudio] fidelity low, reshooting", { shot: input.shotId, attempt, score: result.score, issues: result.issues });
    const words = result.wrongWords?.length ? ` Spell these exactly as on the product: ${result.wrongWords.join("; ")}.` : "";
    fix = `PRODUCT FIDELITY FIX — the previous attempt changed the product: ${result.issues.join("; ") || "label and shape differed"}.${words} Match the PRODUCT photo exactly; keep the same scene and composition.`;
  }
  // Wrong words on a customer's label are worse than no photo: drop the shot.
  if (!best || best.result.wrongWords?.length) throw new LabelDriftError(best?.result.issues ?? []);
  return { buffer: best.buffer, fidelity: best.result.score };
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
  // Plan the photo for this product (the three packshot styles have one correct form).
  const packshotStyle = ["marketplace_white", "color_sweep", "acrylic_reflection"].includes(shot.id);
  if (input.brief === undefined && !packshotStyle) {
    const director = input.artDirector === undefined ? writeShotBrief : input.artDirector;
    const custom = input.settings.lighting !== "studio_soft" || shot.group === "studio";
    const brief = director
      ? await director({
          shot,
          method,
          profile: input.profile,
          settings: input.settings,
          template: shotDirection(shot.id, input.profile, input.settings, { around: method === "scene" }),
          lighting: custom ? lightingFor(input.settings.lighting) : null,
          person: shot.usesModel ? modelDescription(input.settings) : null,
          variation: input.variation,
          image: input.source.buffer,
        }).catch(() => null)
      : null;
    input = { ...input, brief };
    if (brief) console.info("[photoStudio] brief", { shot: shot.id, placement: brief.placement, scene: brief.scene.slice(0, 160) });
  }
  if (method === "scene") {
    const scene = await renderScene(input, input.cutout!);
    // A redrawn photo is an AI-drawn (guided) shot and is labelled as one.
    return { buffer: scene.buffer, method: scene.redrawn ? "guided" : "scene", fidelity: scene.fidelity };
  }
  const g = await renderGuided(input);
  return { buffer: g.buffer, method, fidelity: g.fidelity };
}
