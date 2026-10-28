/**
 * Composition renderer: scene / brand fill + product cut-out + code-drawn
 * type, badge, CTA and logo. Text is drawn as vector paths from the real font
 * (opentype.js), so spelling is always exact and what we measure is what we draw.
 */

import sharp from "sharp";
import type opentype from "opentype.js";
import type { PosterAspectRatio } from "../poster-generation/types";
import { contrastRatio, hexToRgb, pickReadable, relativeLuminance } from "./color";
import type { LoadedFont } from "./fonts";
import type { ProductPlacement } from "./harmonize";
import { fitText, linePathData, measureLine } from "./text-fit";
import type {
  BadgeSlot,
  Box,
  CompositionManifest,
  CtaSlot,
  ManifestLayer,
  Palette,
  PosterTemplate,
  RenderCopy,
  TextSlot,
} from "./types";

export const CANVAS_SIZES: Record<PosterAspectRatio, { width: number; height: number }> = {
  "1:1": { width: 2048, height: 2048 },
  "4:5": { width: 1600, height: 2000 },
  "9:16": { width: 1152, height: 2048 },
  "1.91:1": { width: 2048, height: 1072 },
};

export type RenderInput = {
  template: PosterTemplate;
  aspect: PosterAspectRatio;
  palette: Palette;
  fonts: { heading: LoadedFont; body: LoadedFont };
  copy: RenderCopy;
  /** Text-free AI scene (required for scene / split templates) */
  scene?: Buffer | null;
  /** Trimmed product PNG with alpha */
  cutout?: Buffer | null;
  logo?: { light: Buffer; dark?: Buffer | null } | null;
  /**
   * Optional pass over the composed scene + product (before any text) that
   * returns an integrated version, or null to keep the plain composite.
   */
  harmonize?: (args: {
    base: Buffer;
    product: ProductPlacement;
    /** Regions the pass must leave as they are (pixels) */
    preserve: Array<{ left: number; top: number; width: number; height: number }>;
  }) => Promise<Buffer | null>;
};

export type RenderResult = { png: Buffer; manifest: CompositionManifest };

type Px = { x: number; y: number; w: number; h: number };

const toPx = (b: Box, W: number, H: number): Px => ({ x: b.x * W, y: b.y * H, w: b.w * W, h: b.h * H });
const r = (n: number) => Math.round(n * 100) / 100;

const WHITE = "#ffffff";
const INK = "#111111";

/** Mean luminance and busyness of a region of the composed base image. */
async function sampleRegion(base: Buffer, px: Px, W: number, H: number) {
  const left = Math.max(0, Math.floor(px.x));
  const top = Math.max(0, Math.floor(px.y));
  const width = Math.max(1, Math.min(W - left, Math.ceil(px.w)));
  const height = Math.max(1, Math.min(H - top, Math.ceil(px.h)));
  // stats() reads the input image, not the pipeline output, so extract to a buffer first.
  const region = await sharp(base).extract({ left, top, width, height }).toBuffer();
  const { channels } = await sharp(region).stats();
  const [rc, gc, bc] = channels;
  const lum = relativeLuminance([rc.mean, gc.mean, bc.mean]);
  const busy = (rc.stdev + gc.stdev + bc.stdev) / 3;
  return { lum, busy };
}

/** Mean luminance of a logo's opaque pixels (null when it is mostly transparent). */
async function logoInk(png: Buffer): Promise<number | null> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 200) continue;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  return n < 50 ? null : relativeLuminance([r / n, g / n, b / n]);
}

function lineMetrics(font: opentype.Font, size: number) {
  const upm = font.unitsPerEm || 1000;
  return { ascent: (font.ascender / upm) * size, descent: (-font.descender / upm) * size };
}

/** SVG path data for fitted lines placed inside a box. */
function linesToPath(opts: {
  font: opentype.Font;
  lines: string[];
  size: number;
  box: Px;
  align: TextSlot["align"];
  valign: NonNullable<TextSlot["valign"]>;
  lineHeight: number;
  tracking: number;
}): string {
  const { font, lines, size, box, align, valign, lineHeight, tracking } = opts;
  const { ascent, descent } = lineMetrics(font, size);
  const lh = size * lineHeight;
  const blockH = lines.length * lh;
  const top = valign === "top" ? box.y : valign === "bottom" ? box.y + box.h - blockH : box.y + (box.h - blockH) / 2;
  return lines
    .map((line, i) => {
      const width = measureLine(font, line, size, tracking);
      const x = align === "left" ? box.x : align === "right" ? box.x + box.w - width : box.x + (box.w - width) / 2;
      const baseline = top + i * lh + (lh - (ascent + descent)) / 2 + ascent;
      return linePathData(font, line, x, baseline, size, tracking);
    })
    .join(" ");
}

function starPoints(cx: number, cy: number, outer: number, inner: number, spikes: number): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${r(cx + rad * Math.cos(a))},${r(cy + rad * Math.sin(a))}`);
  }
  return pts.join(" ");
}

export async function renderPoster(input: RenderInput): Promise<RenderResult> {
  const layout = input.template.layouts[input.aspect];
  if (!layout) throw new Error(`Template ${input.template.id} has no ${input.aspect} layout`);
  const { width: W, height: H } = CANVAS_SIZES[input.aspect];
  const pal = input.palette;
  const layers: ManifestLayer[] = [];
  const warnings: string[] = [];
  const full: Box = { x: 0, y: 0, w: 1, h: 1 };

  // ── 1. Background ───────────────────────────────────────────
  const fill = pal[input.template.fill];
  const fillLum = relativeLuminance(hexToRgb(fill));
  // A soft highlight keeps flat brand fills from looking like a placeholder.
  const glow = fillLum > 0.5 ? "#000000" : "#ffffff";
  const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><radialGradient id="g" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${glow}" stop-opacity="${fillLum > 0.5 ? 0.0 : 0.12}"/>
      <stop offset="100%" stop-color="${glow}" stop-opacity="${fillLum > 0.5 ? 0.08 : 0}"/>
    </radialGradient></defs>
    <rect width="100%" height="100%" fill="${fill}"/><rect width="100%" height="100%" fill="url(#g)"/></svg>`;
  const baseLayers: sharp.OverlayOptions[] = [];
  const background = sharp(Buffer.from(bgSvg));

  if (input.template.background !== "brand_solid") {
    if (!input.scene) throw new Error(`Template ${input.template.id} needs a scene image`);
    const sceneBox = toPx(layout.sceneBox ?? full, W, H);
    const scene = await sharp(input.scene)
      .resize(Math.round(sceneBox.w), Math.round(sceneBox.h), { fit: "cover", position: "attention" })
      .toBuffer();
    baseLayers.push({ input: scene, left: Math.round(sceneBox.x), top: Math.round(sceneBox.y) });
    layers.push({ kind: "background", fill, sceneBox: layout.sceneBox ?? full });
  } else {
    layers.push({ kind: "background", fill });
  }

  if (layout.panel) {
    // Split panel sits above the scene and below the product, with a crisp edge.
    const p = toPx(layout.panel, W, H);
    baseLayers.push({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${r(p.x)}" y="${r(p.y)}" width="${r(p.w)}" height="${r(p.h)}" fill="${fill}"/></svg>`),
      left: 0,
      top: 0,
    });
  }

  // ── 2. Product cut-out with contact shadow ──────────────────
  let placement: ProductPlacement | null = null;
  if (layout.product && input.cutout) {
    const pbox = toPx(layout.product.box, W, H);
    const meta = await sharp(input.cutout).metadata();
    const scale = Math.min(pbox.w / (meta.width || 1), pbox.h / (meta.height || 1));
    const pw = Math.max(1, Math.round((meta.width || 1) * scale));
    const ph = Math.max(1, Math.round((meta.height || 1) * scale));
    const left = Math.round(pbox.x + (pbox.w - pw) / 2);
    const top = Math.round(layout.product.anchor === "bottom" ? pbox.y + pbox.h - ph : pbox.y + (pbox.h - ph) / 2);
    const product = await sharp(input.cutout).resize(pw, ph).png().toBuffer();
    const shadowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
      <defs><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${r(pw * 0.04)}"/></filter></defs>
      <ellipse cx="${r(left + pw / 2)}" cy="${r(top + ph - ph * 0.01)}" rx="${r(pw * 0.42)}" ry="${r(Math.max(6, ph * 0.035))}" fill="#000" opacity="0.32" filter="url(#b)"/></svg>`;
    baseLayers.push({ input: Buffer.from(shadowSvg), left: 0, top: 0 });
    baseLayers.push({ input: product, left, top });
    placement = { png: product, left, top, width: pw, height: ph };
    layers.push({ kind: "product", box: { x: left / W, y: top / H, w: pw / W, h: ph / H }, width: pw, height: ph });
  }

  let base = await background.composite(baseLayers).png().toBuffer();
  let harmonized = false;
  if (input.harmonize && placement) {
    const preserve = layout.panel
      ? [(() => {
          const p = toPx(layout.panel, W, H);
          const left = Math.max(0, Math.round(p.x));
          const top = Math.max(0, Math.round(p.y));
          return { left, top, width: Math.min(W - left, Math.round(p.w)), height: Math.min(H - top, Math.round(p.h)) };
        })()]
      : [];
    const integrated = await input.harmonize({ base, product: placement, preserve }).catch(() => null);
    if (integrated) {
      base = integrated;
      harmonized = true;
    }
  }

  // ── 3. Type, badge, CTA (legibility-checked) ────────────────
  const overlay: string[] = [];
  const textCandidates = (role: TextSlot["color"]) => [pal[role], pal.text, pal.background, WHITE, INK];

  async function drawText(slotName: string, slot: TextSlot, text: string) {
    const font = (slot.fontRole === "heading" ? input.fonts.heading : input.fonts.body).font;
    const fontName = slot.fontRole === "heading" ? input.fonts.heading.family : input.fonts.body.family;
    const value = slot.uppercase ? text.toUpperCase() : text;
    const px = toPx(slot.box, W, H);
    const lineHeight = slot.lineHeight ?? (slot.fontRole === "heading" ? 1.08 : 1.3);
    const fit = fitText({
      font,
      text: value,
      boxWidth: px.w,
      boxHeight: px.h,
      minSize: slot.minSize * H,
      maxSize: slot.maxSize * H,
      maxLines: slot.maxLines,
      lineHeight,
      tracking: slot.tracking,
    });
    if (!fit.fits) warnings.push(`${slotName} did not fit its box at the minimum size`);

    const large = fit.fontSize >= H * 0.03;
    const minContrast = large ? 3 : 4.5;
    const region = await sampleRegion(base, px, W, H);
    let pick = pickReadable(region.lum, textCandidates(slot.color), minContrast);
    if (!pick.meets || region.busy > 48) {
      // Scrim: a soft gradient behind the text, dark for light text and vice versa.
      const lightText = contrastRatio(1, region.lum) >= contrastRatio(0, region.lum);
      const scrimColor = lightText ? "#000000" : "#ffffff";
      const opacity = region.busy > 70 ? 0.62 : 0.5;
      const pad = fit.fontSize * 0.6;
      const sx = Math.max(0, px.x - pad);
      const sy = Math.max(0, px.y - pad);
      const sw = Math.min(W - sx, px.w + pad * 2);
      const sh = Math.min(H - sy, px.h + pad * 2);
      overlay.push(`<defs><filter id="s${slotName}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${r(pad * 0.6)}"/></filter></defs>
        <rect x="${r(sx)}" y="${r(sy)}" width="${r(sw)}" height="${r(sh)}" rx="${r(pad)}" fill="${scrimColor}" opacity="${opacity}" filter="url(#s${slotName})"/>`);
      layers.push({ kind: "scrim", box: { x: sx / W, y: sy / H, w: sw / W, h: sh / H }, color: scrimColor, opacity });
      const blended = region.lum * (1 - opacity) + (lightText ? 0 : 1) * opacity;
      pick = pickReadable(blended, lightText ? [pal[slot.color], WHITE] : [pal[slot.color], INK], minContrast);
    }
    overlay.push(
      `<path d="${linesToPath({ font, lines: fit.lines, size: fit.fontSize, box: px, align: slot.align, valign: slot.valign ?? "center", lineHeight, tracking: slot.tracking ?? 0 })}" fill="${pick.color}"/>`
    );
    layers.push({ kind: "text", slot: slotName, box: slot.box, lines: fit.lines, fontSize: fit.fontSize, color: pick.color, font: fontName });
  }

  async function drawBadge(slot: BadgeSlot, text: string) {
    const px = toPx(slot.box, W, H);
    const fillColor = pal[slot.fill];
    const fl = relativeLuminance(hexToRgb(fillColor));
    const textColor = pickReadable(fl, [pal[slot.color], WHITE, INK], 4.5).color;
    const cx = px.x + px.w / 2;
    const cy = px.y + px.h / 2;
    const rad = Math.min(px.w, px.h) / 2;
    let shape: string;
    let inner: Px;
    if (slot.shape === "burst") {
      shape = `<polygon points="${starPoints(cx, cy, rad, rad * 0.86, 18)}" fill="${fillColor}"/>`;
      inner = { x: cx - rad * 0.6, y: cy - rad * 0.5, w: rad * 1.2, h: rad * 1.0 };
    } else if (slot.shape === "seal") {
      shape = `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rad)}" fill="${fillColor}"/><circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rad * 0.88)}" fill="none" stroke="${textColor}" stroke-opacity="0.5" stroke-width="${r(rad * 0.02)}"/>`;
      inner = { x: cx - rad * 0.62, y: cy - rad * 0.5, w: rad * 1.24, h: rad * 1.0 };
    } else {
      shape = `<rect x="${r(px.x)}" y="${r(px.y)}" width="${r(px.w)}" height="${r(px.h)}" rx="${r(px.h / 2)}" fill="${fillColor}"/>`;
      inner = { x: px.x + px.h * 0.4, y: px.y + px.h * 0.15, w: px.w - px.h * 0.8, h: px.h * 0.7 };
    }
    const font = (slot.fontRole === "heading" ? input.fonts.heading : input.fonts.body).font;
    const value = slot.uppercase ? text.toUpperCase() : text;
    const lineHeight = slot.lineHeight ?? 1.0;
    const fit = fitText({ font, text: value, boxWidth: inner.w, boxHeight: inner.h, minSize: slot.minSize * H, maxSize: slot.maxSize * H, maxLines: slot.maxLines, lineHeight, tracking: slot.tracking });
    if (!fit.fits) {
      // An overflowing badge looks broken; the offer still reads from the headline.
      warnings.push(`badge "${text}" did not fit its shape and was left out`);
      return;
    }
    overlay.push(shape);
    overlay.push(`<path d="${linesToPath({ font, lines: fit.lines, size: fit.fontSize, box: inner, align: "center", valign: "center", lineHeight, tracking: slot.tracking ?? 0 })}" fill="${textColor}"/>`);
    layers.push({ kind: "badge", box: slot.box, lines: fit.lines, fontSize: fit.fontSize, color: textColor, fill: fillColor, font: slot.fontRole === "heading" ? input.fonts.heading.family : input.fonts.body.family });
  }

  async function drawCta(slot: CtaSlot, text: string) {
    const px = toPx(slot.box, W, H);
    const font = (slot.fontRole === "heading" ? input.fonts.heading : input.fonts.body).font;
    const value = slot.uppercase ? text.toUpperCase() : text;
    const padY = px.h * 0.24;
    const fit = fitText({ font, text: value, boxWidth: px.w - px.h, boxHeight: px.h - padY * 2, minSize: slot.minSize * H, maxSize: slot.maxSize * H, maxLines: 1, lineHeight: 1, tracking: slot.tracking });
    if (!fit.fits) warnings.push("cta did not fit its box at the minimum size");
    const textW = measureLine(font, fit.lines[0] ?? "", fit.fontSize, slot.tracking ?? 0);
    const bw = Math.min(px.w, textW + fit.fontSize * 2.4);
    const bx = slot.align === "left" ? px.x : slot.align === "right" ? px.x + px.w - bw : px.x + (px.w - bw) / 2;
    const button: Px = { x: bx, y: px.y, w: bw, h: px.h };
    const region = await sampleRegion(base, button, W, H);
    // The button must stand out from what's behind it; fall back through the palette.
    const fillPick = slot.style === "solid" ? pickReadable(region.lum, [pal[slot.fill], pal.accent, pal.primary, INK, WHITE], 2.2) : null;
    const fillColor = fillPick?.color ?? "none";
    const behind = fillPick ? relativeLuminance(hexToRgb(fillPick.color)) : region.lum;
    const textColor = pickReadable(behind, [pal.background, WHITE, INK], 4.5).color;
    const stroke = slot.style === "outline" ? ` stroke="${textColor}" stroke-width="${r(px.h * 0.05)}"` : "";
    overlay.push(`<rect x="${r(button.x)}" y="${r(button.y)}" width="${r(button.w)}" height="${r(button.h)}" rx="${r(button.h / 2)}" fill="${fillColor}"${stroke}/>`);
    overlay.push(`<path d="${linesToPath({ font, lines: fit.lines, size: fit.fontSize, box: button, align: "center", valign: "center", lineHeight: 1, tracking: slot.tracking ?? 0 })}" fill="${textColor}"/>`);
    layers.push({ kind: "cta", box: { x: button.x / W, y: button.y / H, w: button.w / W, h: button.h / H }, lines: fit.lines, fontSize: fit.fontSize, color: textColor, fill: fillColor, font: slot.fontRole === "heading" ? input.fonts.heading.family : input.fonts.body.family });
  }

  await drawText("headline", layout.headline, input.copy.headline);
  if (layout.supporting) {
    const sup = layout.supporting;
    const { productLine, supporting } = input.copy;
    if (productLine && supporting) {
      // Both lines share the slot: product name on top (heading face), supporting line below.
      const top = { ...sup.box, h: sup.box.h * 0.45 };
      const rest = { ...sup.box, y: sup.box.y + sup.box.h * 0.45, h: sup.box.h * 0.55 };
      await drawText("productLine", { ...sup, box: top, fontRole: "heading", maxLines: 1, maxSize: sup.maxSize * 1.2, valign: "bottom" }, productLine);
      await drawText("supporting", { ...sup, box: rest, valign: "top" }, supporting);
    } else if (productLine || supporting) {
      await drawText(productLine ? "productLine" : "supporting", sup, (productLine || supporting)!);
    }
  }
  if (layout.labels && input.copy.labels?.length) {
    for (let i = 0; i < Math.min(layout.labels.length, input.copy.labels.length); i++) {
      await drawText(`label${i + 1}`, layout.labels[i], input.copy.labels[i]);
    }
  }
  if (layout.badge && input.copy.badge) await drawBadge(layout.badge, input.copy.badge);
  if (layout.cta && input.copy.cta) await drawCta(layout.cta, input.copy.cta);

  const composites: sharp.OverlayOptions[] = [
    { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${overlay.join("\n")}</svg>`), left: 0, top: 0 },
  ];

  // ── 4. Logo ─────────────────────────────────────────────────
  if (layout.logo && input.logo) {
    const lpx = toPx(layout.logo, W, H);
    const region = await sampleRegion(base, lpx, W, H);
    const source = region.lum < 0.35 && input.logo.dark ? input.logo.dark : input.logo.light;
    try {
      const logo = await sharp(source, { density: 300 })
        .resize(Math.round(lpx.w), Math.round(lpx.h), { fit: "inside" })
        .png()
        .toBuffer();
      const m = await sharp(logo).metadata();
      const lw = m.width || 0;
      const lh = m.height || 0;
      const left = Math.round(layout.logo.x < 0.5 - layout.logo.w / 2 ? lpx.x : layout.logo.x > 0.5 ? lpx.x + lpx.w - lw : lpx.x + (lpx.w - lw) / 2);
      const top = Math.round(lpx.y + (lpx.h - lh) / 2);
      // A logo that blends into what's behind it sits on a small chip instead.
      const ink = await logoInk(logo);
      if (ink !== null && contrastRatio(ink, region.lum) < 2) {
        const pad = Math.round(lh * 0.35);
        const chipLum = region.lum > 0.4 ? INK : WHITE;
        const chip = contrastRatio(ink, relativeLuminance(hexToRgb(chipLum))) >= 2 ? chipLum : pal.background;
        composites.push({
          input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${left - pad}" y="${top - pad}" width="${lw + pad * 2}" height="${lh + pad * 2}" rx="${pad}" fill="${chip}"/></svg>`),
          left: 0,
          top: 0,
        });
      }
      composites.push({ input: logo, left, top });
      layers.push({ kind: "logo", box: { x: left / W, y: top / H, w: lw / W, h: lh / H } });
    } catch (e) {
      warnings.push(`logo could not be drawn: ${(e as Error).message}`);
    }
  }

  const png = await sharp(base).composite(composites).png({ compressionLevel: 8 }).toBuffer();
  return {
    png,
    manifest: {
      templateId: input.template.id,
      templateVersion: input.template.version,
      aspect: input.aspect,
      canvas: { width: W, height: H },
      palette: pal,
      fonts: { heading: input.fonts.heading.family, body: input.fonts.body.family },
      copy: input.copy,
      layers,
      warnings,
      harmonized,
    },
  };
}
