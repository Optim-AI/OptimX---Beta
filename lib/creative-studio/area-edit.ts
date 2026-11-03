/**
 * Area edit: change only the part of a poster the person boxed.
 *
 * The image model edits a crop around the selection (the box plus surrounding
 * context, shaped to a ratio it supports) — no outline is drawn, since models copy
 * marks into the picture. Only the box, plus a small margin for text that runs a
 * little wide, is pasted back with a soft edge; everything else stays
 * pixel-identical to the original.
 */

import sharp from "sharp";
import type { GenerationSpecification, ImageGenerationProvider } from "./poster-generation/types";

/** Box in 0–1 fractions of the poster's width and height. */
export type AreaBox = { x: number; y: number; w: number; h: number };

export function normalizeBox(box: Partial<AreaBox> | null | undefined): AreaBox | null {
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : NaN);
  let x = n(box?.x), y = n(box?.y), w = n(box?.w), h = n(box?.h);
  if ([x, y, w, h].some(Number.isNaN)) return null;
  x = Math.max(0, Math.min(1, x));
  y = Math.max(0, Math.min(1, y));
  w = Math.max(0, Math.min(1 - x, w));
  h = Math.max(0, Math.min(1 - y, h));
  // Too small to be a deliberate selection.
  if (w < 0.02 || h < 0.02) return null;
  return { x, y, w, h };
}

/** Pixel rectangle for a box, grown by `pad` (fraction of the poster) for a softer seam. */
export function boxToPixels(box: AreaBox, width: number, height: number, pad = 0) {
  const left = Math.max(0, Math.floor((box.x - pad) * width));
  const top = Math.max(0, Math.floor((box.y - pad) * height));
  const right = Math.min(width, Math.ceil((box.x + box.w + pad) * width));
  const bottom = Math.min(height, Math.ceil((box.y + box.h + pad) * height));
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

const RATIOS: Array<{ id: GenerationSpecification["aspectRatio"]; r: number }> = [
  { id: "1:1", r: 1 },
  { id: "4:5", r: 0.8 },
  { id: "9:16", r: 0.5625 },
  { id: "1.91:1", r: 1.91 },
];

/**
 * The crop the model edits: the box with context around it, grown to the nearest
 * ratio the model supports and kept inside the poster.
 */
export function contextCrop(box: AreaBox, W: number, H: number) {
  const bw = box.w * W;
  const bh = box.h * H;
  const ctx = Math.max(0.6 * Math.max(bw, bh), 0.08 * Math.min(W, H));
  let w = bw + 2 * ctx;
  let h = bh + 2 * ctx;
  const target = RATIOS.reduce((best, c) =>
    Math.abs(Math.log(c.r / (w / h))) < Math.abs(Math.log(best.r / (w / h))) ? c : best
  );
  if (w / h < target.r) w = h * target.r;
  else h = w / target.r;
  // Fit inside the poster (shrinking evenly if needed), centred on the box.
  const scale = Math.min(1, W / w, H / h);
  w = Math.round(w * scale);
  h = Math.round(h * scale);
  const cx = (box.x + box.w / 2) * W;
  const cy = (box.y + box.h / 2) * H;
  const left = Math.round(Math.max(0, Math.min(W - w, cx - w / 2)));
  const top = Math.round(Math.max(0, Math.min(H - h, cy - h / 2)));
  return { left, top, width: w, height: h, aspect: target.id };
}

const pct = (v: number) => `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

export function areaEditPrompt(instruction: string, inner: AreaBox): string {
  return [
    "This image is a section of a finished advertising poster. Edit it.",
    `The area to change is ${pct(inner.x)}–${pct(inner.x + inner.w)} across and ${pct(inner.y)}–${pct(inner.y + inner.h)} down this image. Change: ${instruction.trim()}`,
    "Keep everything outside that area exactly as it is — same scene, product, text, colours and lighting — and keep the edit inside that area.",
    "Make the edited part blend naturally (matching light, perspective, texture and style).",
    "If the change involves text, spell it exactly as written and match the existing typography.",
    "Same framing and size as this image; no borders, boxes or marks.",
  ].join("\n");
}

/**
 * Put the edited pixels back only inside the box (+ margin, feathered edge); the
 * rest of the poster is the untouched original.
 */
export async function compositeArea(original: Buffer, edited: Buffer, box: AreaBox, margin = 0.015): Promise<Buffer> {
  const meta = await sharp(original).metadata();
  const W = meta.width || 1;
  const H = meta.height || 1;
  const editedFull = await sharp(edited).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer();
  // Feather a little past the box so the seam isn't a hard line.
  const feather = Math.max(4, Math.round(Math.min(W, H) * 0.012));
  const r = boxToPixels(box, W, H, margin);
  const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/><rect x="${r.left}" y="${r.top}" width="${r.width}" height="${r.height}" fill="#fff"/></svg>`;
  const mask = await sharp(Buffer.from(maskSvg)).blur(feather / 2).greyscale().extractChannel(0).raw().toBuffer();
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgba[i * 4] = editedFull[i * 3];
    rgba[i * 4 + 1] = editedFull[i * 3 + 1];
    rgba[i * 4 + 2] = editedFull[i * 3 + 2];
    rgba[i * 4 + 3] = mask[i];
  }
  const patch = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  return sharp(original).composite([{ input: patch }]).png().toBuffer();
}

export async function editPosterArea(input: {
  poster: Buffer;
  box: AreaBox;
  instruction: string;
  provider: ImageGenerationProvider;
  userId: string;
}): Promise<Buffer> {
  const { box, instruction, provider, userId } = input;
  const png = await sharp(input.poster).png().toBuffer();
  const meta = await sharp(png).metadata();
  const W = meta.width || 1;
  const H = meta.height || 1;
  const crop = contextCrop(box, W, H);
  const section = await sharp(png).extract({ left: crop.left, top: crop.top, width: crop.width, height: crop.height }).png().toBuffer();
  // Where the box sits inside the crop, as fractions of the crop.
  const inner: AreaBox = {
    x: (box.x * W - crop.left) / crop.width,
    y: (box.y * H - crop.top) / crop.height,
    w: (box.w * W) / crop.width,
    h: (box.h * H) / crop.height,
  };
  const generationId = `area_${Date.now()}`;
  const result = await provider.generate({
    specification: { aspectRatio: crop.aspect, sessionId: "area-edit", generationId, variantId: generationId } as unknown as GenerationSpecification,
    prompt: areaEditPrompt(instruction, inner),
    aspectRatio: crop.aspect,
    referenceImages: [
      {
        role: "design_inspiration",
        kind: "design",
        label: "BASE IMAGE — poster section",
        instruction: "BASE IMAGE — PRIMARY EDIT SOURCE. Edit this exact image; keep its framing.",
        mimeType: "image/png",
        base64Data: section.toString("base64"),
      },
    ],
    mode: "edit",
    baseImage: null,
    metadata: { sessionId: "area-edit", generationId, variantId: generationId, userId },
  });
  if (!result.ok || !result.imageBuffer) throw new Error(result.errorMessage || "The edit didn't come out. Try again.");
  // Back to full-poster size: the edited section in place, then only the box (+ margin) kept.
  const sectionOut = await sharp(result.imageBuffer).resize(crop.width, crop.height, { fit: "fill" }).png().toBuffer();
  const editedFull = await sharp(png).composite([{ input: sectionOut, left: crop.left, top: crop.top }]).png().toBuffer();
  return compositeArea(png, editedFull, box);
}
