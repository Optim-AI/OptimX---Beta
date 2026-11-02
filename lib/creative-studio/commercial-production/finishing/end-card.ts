/**
 * Finishing layer — brand end card burned onto the last seconds of a commercial.
 *
 * Video models draw text unreliably (misspelt offers, invented logos), so they
 * are told never to render text. Offer, CTA, contact and logo are added here in
 * post instead: drawn as vector paths from a real font (poster-template text
 * engine), rasterised with sharp, and overlaid with ffmpeg.
 *
 * Indian-script lines (Tamil, Hindi, …) need complex shaping that the vector
 * engine can't do, so they are drawn by Pango/HarfBuzz (bundled with sharp)
 * using the matching Noto Sans font. Text no font can draw is left out rather
 * than rendered as boxes.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";
import type opentype from "opentype.js";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";
import { loadFont, type LoadedFont } from "@/lib/creative-studio/poster-templates/fonts";
import { fitText, linePathData, measureLine } from "@/lib/creative-studio/poster-templates/text-fit";
import { hexToRgb, pickReadable, relativeLuminance } from "@/lib/creative-studio/poster-templates/color";
import { probeMediaBuffer } from "../audio/mux-voiceover";

const execFileAsync = promisify(execFile);

export const END_CARD_SECONDS = 3;
const FADE_IN_SECONDS = 0.5;
const DEFAULT_ACCENT = "#F5B700";

export interface EndCardContent {
  brandName: string;
  /** e.g. "Buy 2, get 1 free" */
  offer?: string;
  /** e.g. "Order now" */
  cta?: string;
  /** Phone, WhatsApp number or website. */
  contact?: string;
  /** Logo image bytes (png / jpeg / webp / svg). */
  logo?: Buffer;
  /** Brand colour for the CTA button. */
  accentColor?: string;
}

export interface EndCardFonts {
  bold: LoadedFont;
  medium: LoadedFont;
  /**
   * Path to a font file for an Indian script (e.g. "Noto Sans Tamil"), or null.
   * Without it, lines in those scripts are skipped.
   */
  scriptFontFile?: (family: string, weight: number) => Promise<ScriptFont | null>;
}

export type ScriptFont = { path: string; family: string };

const SCRIPT_FONTS: Array<[RegExp, string]> = [
  [/[\u0B80-\u0BFF]/, "Noto Sans Tamil"],
  [/[\u0900-\u097F]/, "Noto Sans Devanagari"],
  [/[\u0C80-\u0CFF]/, "Noto Sans Kannada"],
  [/[\u0D00-\u0D7F]/, "Noto Sans Malayalam"],
  [/[\u0C00-\u0C7F]/, "Noto Sans Telugu"],
  [/[\u0980-\u09FF]/, "Noto Sans Bengali"],
  [/[\u0A80-\u0AFF]/, "Noto Sans Gujarati"],
  [/[\u0A00-\u0A7F]/, "Noto Sans Gurmukhi"],
];

/** Noto family that covers the Indian script in `text`, if any. */
export function scriptFontFamily(text: string): string | null {
  return SCRIPT_FONTS.find(([re]) => re.test(text))?.[1] ?? null;
}

const scriptFontCache = new Map<string, Promise<ScriptFont | null>>();

/** Fetch a Noto script font from Google Fonts once and keep it on local disk for Pango. */
export function downloadScriptFont(family: string, weight: number): Promise<ScriptFont | null> {
  const key = `${family}@${weight}`;
  const hit = scriptFontCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const loaded = await loadFont(family, weight);
    if (loaded.fallback) return null;
    const dir = join(tmpdir(), "skalx-fonts");
    await mkdir(dir, { recursive: true });
    const path = join(dir, `${family.replace(/\s+/g, "-")}-${loaded.weight}.ttf`);
    await writeFile(path, Buffer.from(loaded.data));
    return { path, family };
  })().catch(() => null);
  scriptFontCache.set(key, p);
  return p;
}

export async function loadEndCardFonts(): Promise<EndCardFonts> {
  const [bold, medium] = await Promise.all([loadFont("Poppins", 700), loadFont("Poppins", 500)]);
  return { bold, medium, scriptFontFile: downloadScriptFont };
}

function escapeMarkup(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Shape and rasterise text with Pango, shrinking until it fits `maxLines`.
 * Returns a transparent PNG no wider than `width`.
 */
async function renderShapedText(input: {
  text: string;
  font: ScriptFont;
  bold: boolean;
  width: number;
  minSize: number;
  maxSize: number;
  maxLines: number;
  color: string;
}): Promise<{ png: Buffer; width: number; height: number }> {
  let size = input.maxSize;
  for (;;) {
    const { data, info } = await sharp({
      text: {
        text: `<span foreground="${escapeAttr(input.color)}">${escapeMarkup(input.text)}</span>`,
        font: `${input.font.family}${input.bold ? " Bold" : ""} ${Math.round(size)}px`,
        fontfile: input.font.path,
        width: Math.round(input.width),
        align: "centre",
        wrap: "word",
        rgba: true,
        dpi: 72,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
    if (info.height <= size * 1.6 * input.maxLines || size <= input.minSize) {
      return { png: data, width: info.width, height: info.height };
    }
    size = Math.max(input.minSize, size * 0.88);
  }
}

/** True when every visible character has a real glyph in the font. */
export function fontCanDraw(font: opentype.Font, text: string): boolean {
  return Array.from(text).every((ch) => /\s/.test(ch) || font.charToGlyph(ch).index !== 0);
}

function escapeAttr(value: string): string {
  return value.replace(/[^#0-9a-fA-F]/g, "");
}

type Block = { height: number; draw: (top: number) => string };
type Overlay = { input: Buffer; left: number; top: number };

/**
 * Render a transparent PNG the size of the video: a bottom gradient panel with
 * logo (or brand name), offer, CTA button and contact line, centred.
 */
export async function renderEndCardPng(input: {
  width: number;
  height: number;
  content: EndCardContent;
  fonts: EndCardFonts;
}): Promise<{ png: Buffer; drawn: string[]; skipped: string[] }> {
  const { width: W, height: H, content, fonts } = input;
  const unit = Math.min(W, H);
  const padX = W * 0.08;
  const boxWidth = W - padX * 2;
  const drawn: string[] = [];
  const skipped: string[] = [];
  const blocks: Block[] = [];
  const gap = unit * 0.025;

  const overlays: Overlay[] = [];

  /** Vector-drawable text, a Pango-shaped script font, or null (skipped). */
  const usable = async (
    label: string,
    text: string | undefined,
    font: opentype.Font,
    weight: number
  ): Promise<{ text: string; script: ScriptFont | null } | null> => {
    const t = text?.trim();
    if (!t) return null;
    if (fontCanDraw(font, t)) {
      drawn.push(label);
      return { text: t, script: null };
    }
    const family = scriptFontFamily(t);
    const script = family && fonts.scriptFontFile ? await fonts.scriptFontFile(family, weight) : null;
    if (!script) {
      skipped.push(label);
      return null;
    }
    drawn.push(label);
    return { text: t, script };
  };

  /** A centred line block drawn as a raster overlay instead of SVG paths. */
  const rasterBlock = (img: { png: Buffer; width: number; height: number }): Block => ({
    height: img.height,
    draw: (top) => {
      overlays.push({ input: img.png, left: Math.round((W - img.width) / 2), top: Math.round(top) });
      return "";
    },
  });

  const lineBlock = async (
    item: { text: string; script: ScriptFont | null },
    font: opentype.Font,
    opts: { min: number; max: number; lines: number; fill: string; opacity?: number; bold: boolean }
  ): Promise<Block> => {
    if (!item.script) return textBlock(item.text, font, opts);
    const img = await renderShapedText({
      text: item.text,
      font: item.script,
      bold: opts.bold,
      width: boxWidth,
      minSize: opts.min,
      maxSize: opts.max,
      maxLines: opts.lines,
      color: opts.fill,
    });
    return rasterBlock(img);
  };

  const textBlock = (text: string, font: opentype.Font, opts: { min: number; max: number; lines: number; fill: string; opacity?: number }): Block => {
    const fit = fitText({
      font,
      text,
      boxWidth,
      boxHeight: opts.max * 1.2 * opts.lines,
      minSize: opts.min,
      maxSize: opts.max,
      maxLines: opts.lines,
      lineHeight: 1.2,
    });
    const lineH = fit.fontSize * 1.2;
    return {
      height: lineH * fit.lines.length,
      draw: (top) =>
        fit.lines
          .map((line, i) => {
            const w = measureLine(font, line, fit.fontSize);
            const baseline = top + i * lineH + fit.fontSize * 0.95;
            return `<path d="${linePathData(font, line, (W - w) / 2, baseline, fit.fontSize)}" fill="${opts.fill}" fill-opacity="${opts.opacity ?? 1}"/>`;
          })
          .join(""),
    };
  };

  // Logo, else brand name.
  let logoPng: Buffer | null = null;
  let logoSize = { w: 0, h: 0 };
  if (content.logo) {
    try {
      const maxH = Math.round(unit * 0.11);
      const maxW = Math.round(boxWidth * 0.5);
      logoPng = await sharp(content.logo).resize({ width: maxW, height: maxH, fit: "inside" }).png().toBuffer();
      const meta = await sharp(logoPng).metadata();
      logoSize = { w: meta.width || 0, h: meta.height || 0 };
      drawn.push("logo");
    } catch {
      logoPng = null;
      skipped.push("logo");
    }
  }
  if (logoPng) {
    const logo = logoPng;
    blocks.push(rasterBlock({ png: logo, width: logoSize.w, height: logoSize.h }));
  } else {
    const brand = await usable("brandName", content.brandName, fonts.bold.font, 700);
    if (brand) blocks.push(await lineBlock(brand, fonts.bold.font, { min: unit * 0.04, max: unit * 0.055, lines: 1, fill: "#FFFFFF", bold: true }));
  }

  const offer = await usable("offer", content.offer, fonts.bold.font, 700);
  if (offer) blocks.push(await lineBlock(offer, fonts.bold.font, { min: unit * 0.045, max: unit * 0.07, lines: 2, fill: "#FFFFFF", bold: true }));

  const cta = await usable("cta", content.cta, fonts.bold.font, 700);
  if (cta) {
    const accent = /^#[0-9a-fA-F]{6}$/.test(content.accentColor || "") ? content.accentColor! : DEFAULT_ACCENT;
    const label = pickReadable(relativeLuminance(hexToRgb(accent)), ["#FFFFFF", "#111111"], 4.5).color;
    const size = unit * 0.045;
    const pillH = size * 2;
    if (cta.script) {
      const img = await renderShapedText({
        text: cta.text,
        font: cta.script,
        bold: true,
        width: boxWidth * 0.8,
        minSize: size * 0.7,
        maxSize: size,
        maxLines: 1,
        color: label,
      });
      const pillW = img.width + size * 2;
      const h = Math.max(pillH, img.height + size * 0.6);
      blocks.push({
        height: h,
        draw: (top) => {
          overlays.push({ input: img.png, left: Math.round((W - img.width) / 2), top: Math.round(top + (h - img.height) / 2) });
          return `<rect x="${(W - pillW) / 2}" y="${top}" width="${pillW}" height="${h}" rx="${h / 2}" fill="${escapeAttr(accent)}"/>`;
        },
      });
    } else {
      const textW = Math.min(measureLine(fonts.bold.font, cta.text, size), boxWidth * 0.8);
      const pillW = textW + size * 2;
      blocks.push({
        height: pillH,
        draw: (top) =>
          `<rect x="${(W - pillW) / 2}" y="${top}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${escapeAttr(accent)}"/>` +
          `<path d="${linePathData(fonts.bold.font, cta.text, (W - textW) / 2, top + pillH / 2 + size * 0.35, size)}" fill="${label}"/>`,
      });
    }
  }

  const contact = await usable("contact", content.contact, fonts.medium.font, 500);
  if (contact) blocks.push(await lineBlock(contact, fonts.medium.font, { min: unit * 0.032, max: unit * 0.042, lines: 1, fill: "#FFFFFF", opacity: 0.9, bold: false }));

  const stackH = blocks.reduce((sum, b) => sum + b.height, 0) + gap * Math.max(0, blocks.length - 1);
  // Bottom safe area clears platform UI (Reels / Shorts captions and buttons).
  const bottomPad = H * 0.07;
  let top = H - bottomPad - stackH;
  const panelTop = Math.max(0, top - H * 0.08);

  const parts: string[] = [];
  for (const block of blocks) {
    parts.push(block.draw(top));
    top += block.height + gap;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
<stop offset="0" stop-color="#000" stop-opacity="0"/>
<stop offset="0.35" stop-color="#000" stop-opacity="0.55"/>
<stop offset="1" stop-color="#000" stop-opacity="0.82"/>
</linearGradient></defs>
<rect x="0" y="${panelTop}" width="${W}" height="${H - panelTop}" fill="url(#g)"/>
${parts.join("\n")}
</svg>`;

  let card = sharp(Buffer.from(svg)).png();
  if (overlays.length) {
    card = sharp(await card.toBuffer()).composite(overlays);
  }
  return { png: await card.png().toBuffer(), drawn, skipped };
}

/**
 * Overlay the end card on the last END_CARD_SECONDS of the video (fading in).
 * Re-encodes video; audio is copied unchanged.
 */
export async function applyEndCard(input: {
  videoBuffer: Buffer;
  content: EndCardContent;
  fonts?: EndCardFonts;
  seconds?: number;
}): Promise<{ video: Buffer; drawn: string[]; skipped: string[] }> {
  const probe = await probeMediaBuffer(input.videoBuffer, "mp4");
  if (!probe.durationSeconds || !probe.width || !probe.height) {
    throw new Error("Could not read video size/duration for the end card");
  }
  const fonts = input.fonts ?? (await loadEndCardFonts());
  const { png, drawn, skipped } = await renderEndCardPng({
    width: probe.width,
    height: probe.height,
    content: input.content,
    fonts,
  });

  const seconds = Math.min(input.seconds ?? END_CARD_SECONDS, probe.durationSeconds);
  const start = Math.max(0, probe.durationSeconds - seconds).toFixed(3);
  const dir = await mkdtemp(join(tmpdir(), "skalx-endcard-"));
  const videoPath = join(dir, "input.mp4");
  const cardPath = join(dir, "card.png");
  const outputPath = join(dir, "output.mp4");
  try {
    await writeFile(videoPath, input.videoBuffer);
    await writeFile(cardPath, png);
    await execFileAsync(
      getFfmpegExecutable(),
      [
        "-y",
        "-i", videoPath,
        "-loop", "1",
        "-t", probe.durationSeconds.toFixed(3),
        "-i", cardPath,
        "-filter_complex",
        `[1:v]format=rgba,fade=t=in:st=${start}:d=${FADE_IN_SECONDS}:alpha=1[card];[0:v][card]overlay=0:0:shortest=1:enable='gte(t,${start})'[v]`,
        "-map", "[v]",
        "-map", "0:a?",
        "-c:v", "libx264",
        "-crf", "18",
        "-preset", "veryfast",
        "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        "-movflags", "+faststart",
        outputPath,
      ],
      { timeout: 180_000, maxBuffer: 20 * 1024 * 1024 }
    );
    return { video: await readFile(outputPath), drawn, skipped };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
