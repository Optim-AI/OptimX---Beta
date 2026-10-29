/**
 * Exact packshots — the real product cut-out composited on a studio background.
 * No AI touches the product, so labels and colours are pixel-identical.
 */

import sharp from "sharp";
import type { PhotoAspect } from "./types";

export const CANVAS: Record<PhotoAspect, { width: number; height: number }> = {
  "1:1": { width: 1600, height: 1600 },
  "4:5": { width: 1600, height: 2000 },
  "9:16": { width: 1152, height: 2048 },
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()) || /^#?([0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return { r: 240, g: 238, b: 234 };
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

const shade = (c: { r: number; g: number; b: number }, f: number) => ({
  r: Math.max(0, Math.min(255, Math.round(c.r * f))),
  g: Math.max(0, Math.min(255, Math.round(c.g * f))),
  b: Math.max(0, Math.min(255, Math.round(c.b * f))),
});
const css = (c: { r: number; g: number; b: number }) => `rgb(${c.r},${c.g},${c.b})`;

/** Mix a colour toward white (amount > 0) or black (amount < 0). */
export function tintHex(hex: string, amount: number): string {
  const c = hexToRgb(hex);
  const t = amount >= 0 ? 255 : 0;
  const a = Math.min(1, Math.abs(amount));
  const mix = (v: number) => Math.round(v + (t - v) * a).toString(16).padStart(2, "0");
  return `#${mix(c.r)}${mix(c.g)}${mix(c.b)}`;
}

/** A seamless paper sweep: lighter wall, a soft curve, slightly darker floor. */
function sweepSvg(width: number, height: number, hex: string, floorY: number): string {
  const base = hexToRgb(hex);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${css(shade(base, 1.06))}"/>
      <stop offset="${(floorY / height - 0.12).toFixed(3)}" stop-color="${css(base)}"/>
      <stop offset="${(floorY / height).toFixed(3)}" stop-color="${css(shade(base, 0.96))}"/>
      <stop offset="1" stop-color="${css(shade(base, 0.86))}"/>
    </linearGradient>
    <radialGradient id="v" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.10"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`;
}

async function contactShadow(productWidth: number, opacity: number): Promise<{ buf: Buffer; w: number; h: number }> {
  const w = Math.round(productWidth * 1.1);
  const h = Math.max(24, Math.round(productWidth * 0.14));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><ellipse cx="${w / 2}" cy="${h / 2}" rx="${w * 0.42}" ry="${h * 0.3}" fill="#000" fill-opacity="${opacity}"/></svg>`;
  const buf = await sharp(Buffer.from(svg)).blur(Math.max(4, h * 0.22)).png().toBuffer();
  return { buf, w, h };
}

export type PackshotStyle = "white" | "sweep" | "reflection";

/**
 * Render a packshot. `fill` is the share of the frame the product's longest
 * side takes (Amazon main image ≈ 0.85).
 */
export async function renderPackshot(opts: {
  cutout: Buffer;
  aspect: PhotoAspect;
  style: PackshotStyle;
  backdrop?: string;
  fill?: number;
}): Promise<Buffer> {
  const { width, height } = CANVAS[opts.aspect];
  const meta = await sharp(opts.cutout).metadata();
  const pw0 = meta.width || 1;
  const ph0 = meta.height || 1;
  const fill = opts.fill ?? (opts.style === "white" ? 0.85 : 0.62);
  const scale = Math.min((width * fill) / pw0, (height * fill) / ph0);
  const pw = Math.round(pw0 * scale);
  const ph = Math.round(ph0 * scale);
  const product = await sharp(opts.cutout).resize(pw, ph).png().toBuffer();
  const left = Math.round((width - pw) / 2);

  if (opts.style === "white") {
    // Marketplace main image: pure white, product centred, a faint contact shadow.
    const top = Math.round((height - ph) / 2);
    const shadow = await contactShadow(pw, 0.18);
    return sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
      .composite([
        { input: shadow.buf, left: Math.round((width - shadow.w) / 2), top: Math.min(height - shadow.h, top + ph - Math.round(shadow.h / 2)) },
        { input: product, left, top },
      ])
      .jpeg({ quality: 94 })
      .toBuffer();
  }

  const backdrop = opts.backdrop || "#EDE7DF";
  const floorY = Math.round(height * 0.74);
  const top = floorY - ph;
  const bg = await sharp(Buffer.from(sweepSvg(width, height, backdrop, floorY))).png().toBuffer();
  const shadow = await contactShadow(pw, opts.style === "reflection" ? 0.22 : 0.32);
  const layers: sharp.OverlayOptions[] = [];

  if (opts.style === "reflection") {
    // Mirror image under the product, fading out — like glossy acrylic.
    const reflH = Math.round(ph * 0.45);
    const flipped = await sharp(product).flip().extract({ left: 0, top: 0, width: pw, height: reflH }).png().toBuffer();
    const fade = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${reflH}"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#f)"/></svg>`
    );
    const reflection = await sharp(flipped).composite([{ input: fade, blend: "dest-in" }]).png().toBuffer();
    layers.push({ input: reflection, left, top: floorY });
  }
  layers.push({ input: shadow.buf, left: Math.round((width - shadow.w) / 2), top: floorY - Math.round(shadow.h / 2) });
  layers.push({ input: product, left, top });
  return sharp(bg).composite(layers).jpeg({ quality: 94 }).toBuffer();
}

/**
 * Where a scene shot places the product (bottom-centre on the set's surface). The
 * second variation sits off-centre (rule of thirds) so the two takes differ.
 */
export function scenePlacement(aspect: PhotoAspect, cutoutW: number, cutoutH: number, mode: "surface" | "float", variation = 0) {
  const { width, height } = CANVAS[aspect];
  // The product is the hero: about half the frame height on a surface.
  const target = mode === "float" ? 0.5 : variation % 2 ? 0.46 : 0.54;
  const scale = Math.min((width * target * 1.2) / cutoutW, (height * target) / cutoutH);
  const w = Math.round(cutoutW * scale);
  const h = Math.round(cutoutH * scale);
  const centre = variation % 2 ? width * 0.62 : width / 2;
  const left = Math.max(Math.round(width * 0.07), Math.min(Math.round(centre - w / 2), Math.round(width * 0.93) - w));
  const top = mode === "float" ? Math.round((height - h) / 2) : Math.round(height * 0.8) - h;
  return { left, top, width: w, height: h };
}
