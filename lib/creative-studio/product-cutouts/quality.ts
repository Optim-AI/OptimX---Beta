/**
 * Cut-out quality checks. A bad cut-out (background left in, product clipped,
 * almost nothing kept) must never reach a poster — the caller falls back to
 * letting the image model place the product instead.
 */

import sharp from "sharp";

export type CutoutQuality = {
  ok: boolean;
  /** 0–1, higher is better */
  score: number;
  /** Share of the canvas that is opaque */
  coverage: number;
  /** Share of border pixels that are opaque (background not removed / product clipped) */
  borderOpaque: number;
  /** Half-transparent pixels relative to opaque ones (noise / leftover shadow) */
  partialRatio: number;
  reasons: string[];
};

export async function assessCutout(png: Buffer): Promise<CutoutQuality> {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .resize({ width: 512, height: 512, fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const alpha = (x: number, y: number) => data[(y * w + x) * 4 + 3];

  let opaque = 0;
  let partial = 0;
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    if (a > 128) opaque++;
    if (a > 24 && a < 232) partial++;
  }
  const coverage = opaque / (w * h);
  // Clean mattes have a thin soft edge; leftover shadows/noise leave large half-transparent areas.
  const partialRatio = opaque ? partial / opaque : 1;

  let borderTotal = 0;
  let borderOpaqueCount = 0;
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) { borderTotal++; if (alpha(x, y) > 128) borderOpaqueCount++; }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) { borderTotal++; if (alpha(x, y) > 128) borderOpaqueCount++; }
  }
  const borderOpaque = borderOpaqueCount / borderTotal;

  const reasons: string[] = [];
  if (coverage < 0.04) reasons.push("Almost nothing was kept — the product may have been removed with the background.");
  if (coverage > 0.92) reasons.push("The background was not removed.");
  // Cropped cut-outs touch the border on the bottom edge (standing product) — allow one edge's worth.
  if (borderOpaque > 0.3) reasons.push("Too much of the image edge is solid — background left in or product clipped.");
  if (partialRatio > 0.25) reasons.push("The edges are noisy — leftover shadow or background.");

  const score = Math.max(0, Math.min(1, 1 - reasons.length * 0.5 - Math.max(0, borderOpaque - 0.25)));
  return { ok: reasons.length === 0, score: Math.round(score * 100) / 100, coverage, borderOpaque, partialRatio, reasons };
}
