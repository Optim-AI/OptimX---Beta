/**
 * Product/scene harmonising: one image-model pass relights the composited
 * product and grounds it (contact shadow, reflection, surface), then the exact
 * cut-out pixels are pasted back, colour-graded to the new light. The model
 * never gets the final say over the product's label or shape.
 */

import sharp from "sharp";
import type {
  GenerationSpecification,
  ImageGenerationProvider,
  ImageGenerationRequest,
} from "../poster-generation/types";

export type ProductPlacement = { png: Buffer; left: number; top: number; width: number; height: number };

export type HarmonizeResult =
  | { ok: true; buffer: Buffer; similarity: number }
  | { ok: false; reason: string; similarity?: number };

/** Below this, the model moved or redrew the product — keep the plain composite. */
export const MIN_PRODUCT_SIMILARITY = 0.72;
/** Below this, the model changed the scene itself (added objects, text, reframed). */
export const MIN_SCENE_SIMILARITY = 0.55;

export const HARMONIZE_PROMPT =
  "Edit the BASE IMAGE. It is a product photo composited into a background photograph. Make it look like a single real photograph: " +
  "relight the product so its light direction, colour temperature, contrast and highlights match the scene; " +
  "add a natural contact shadow where it touches the surface and any soft reflection that surface would show; " +
  "make the product sit firmly on the surface, extending or adjusting the surface under it if needed. " +
  "Keep the product exactly where it is and exactly the same size; keep its label, text, logo, colours of the packaging and shape unchanged. " +
  "Do not add, remove or move anything else. Do not add any text, graphics or logos. Keep empty areas empty.";

/** Normalised cross-correlation of two greyscale crops (1 = identical structure). Insensitive to brightness changes. */
export async function structuralSimilarity(a: Buffer, b: Buffer, size = 96): Promise<number> {
  const grey = (img: Buffer) =>
    sharp(img).resize(size, size, { fit: "fill" }).greyscale().raw().toBuffer();
  const [x, y] = await Promise.all([grey(a), grey(b)]);
  const n = x.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
}

/**
 * Colour-grade the cut-out toward how the model lit the product (per-channel
 * mean/std transfer inside the product mask, partially applied and clamped).
 */
export async function gradeCutout(cutout: Buffer, litRegion: Buffer, strength = 0.65): Promise<Buffer> {
  const meta = await sharp(cutout).metadata();
  const w = meta.width!, h = meta.height!;
  const [src, lit] = await Promise.all([
    sharp(cutout).ensureAlpha().raw().toBuffer(),
    sharp(litRegion).resize(w, h, { fit: "fill" }).removeAlpha().raw().toBuffer(),
  ]);
  const sums = [0, 0, 0].map(() => ({ s: 0, ss: 0, l: 0, ll: 0 }));
  let count = 0;
  for (let p = 0, q = 0; p < src.length; p += 4, q += 3) {
    if (src[p + 3] < 200) continue;
    count++;
    for (let c = 0; c < 3; c++) {
      const v = src[p + c], u = lit[q + c];
      sums[c].s += v; sums[c].ss += v * v; sums[c].l += u; sums[c].ll += u * u;
    }
  }
  if (count < 100) return cutout;
  const a: number[] = [], b: number[] = [];
  for (const { s, ss, l, ll } of sums) {
    const m1 = s / count, m2 = l / count;
    const sd1 = Math.sqrt(Math.max(1, ss / count - m1 * m1));
    const sd2 = Math.sqrt(Math.max(1, ll / count - m2 * m2));
    const gain = Math.min(1.25, Math.max(0.8, 1 + strength * (sd2 / sd1 - 1)));
    const targetMean = m1 + strength * (m2 - m1);
    a.push(gain);
    b.push(targetMean - m1 * gain);
  }
  return sharp(cutout).ensureAlpha().linear([...a, 1], [...b, 0]).png().toBuffer();
}

export async function harmonizeProduct(opts: {
  base: Buffer;
  product: ProductPlacement;
  canvas: { width: number; height: number };
  spec: GenerationSpecification;
  provider: ImageGenerationProvider;
  userId: string;
  /** Pixel regions restored from the original composite (e.g. a split layout's brand panel) */
  preserve?: Array<{ left: number; top: number; width: number; height: number }>;
}): Promise<HarmonizeResult> {
  const { base, product, canvas, spec } = opts;
  const request: ImageGenerationRequest = {
    specification: spec,
    prompt: HARMONIZE_PROMPT,
    aspectRatio: spec.aspectRatio,
    referenceImages: [
      {
        role: "design_inspiration",
        kind: "design",
        label: "BASE POSTER — composited scene",
        instruction: "BASE IMAGE — PRIMARY EDIT SOURCE. Edit this exact image as instructed; keep its framing.",
        mimeType: "image/png",
        base64Data: base.toString("base64"),
      },
      {
        role: "product_packshot",
        kind: "product",
        label: "PRODUCT (exact appearance)",
        instruction: "The product as it really looks. Its label and shape must stay exactly like this.",
        mimeType: "image/png",
        base64Data: product.png.toString("base64"),
      },
    ],
    mode: "edit",
    baseImage: null,
    metadata: {
      sessionId: spec.sessionId,
      generationId: `${spec.generationId}-harmonize`,
      variantId: spec.variantId,
      userId: opts.userId,
    },
  };
  const result = await opts.provider.generate(request);
  if (!result.ok || !result.imageBuffer) return { ok: false, reason: result.errorMessage || "harmonize call failed" };

  try {
    const lit = await sharp(result.imageBuffer).resize(canvas.width, canvas.height, { fit: "fill" }).png().toBuffer();
    const scene = await structuralSimilarity(base, lit, 64);
    if (scene < MIN_SCENE_SIMILARITY) return { ok: false, reason: "scene changed", similarity: scene };
    const region = { left: product.left, top: product.top, width: product.width, height: product.height };
    const [before, after] = await Promise.all([
      sharp(base).extract(region).png().toBuffer(),
      sharp(lit).extract(region).png().toBuffer(),
    ]);
    const similarity = await structuralSimilarity(before, after);
    if (similarity < MIN_PRODUCT_SIMILARITY) return { ok: false, reason: "product moved or was redrawn", similarity };
    const graded = await gradeCutout(product.png, after);
    // The model may paint over areas it shouldn't own (a brand panel); put them back, then the exact product.
    const restored = await Promise.all(
      (opts.preserve ?? [])
        .filter((r) => r.width > 0 && r.height > 0)
        .map(async (r) => ({ input: await sharp(base).extract(r).png().toBuffer(), left: r.left, top: r.top }))
    );
    const buffer = await sharp(lit)
      .composite([...restored, { input: graded, left: product.left, top: product.top }])
      .png()
      .toBuffer();
    return { ok: true, buffer, similarity };
  } catch (e) {
    return { ok: false, reason: `harmonize result unusable: ${(e as Error).message}` };
  }
}
