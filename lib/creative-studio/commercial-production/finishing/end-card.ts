/**
 * Finishing layer — brand end card burned onto the last seconds of a commercial.
 *
 * Video models draw text unreliably (misspelt offers, invented logos), so they
 * are told never to render text. Offer, CTA, contact and logo are added here in
 * post instead: drawn as vector paths from a real font (poster-template text
 * engine), rasterised with sharp, and overlaid with ffmpeg.
 *
 * Text a font cannot draw (e.g. Tamil script with a Latin font) is left out
 * rather than rendered as boxes.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
}

export async function loadEndCardFonts(): Promise<EndCardFonts> {
  const [bold, medium] = await Promise.all([loadFont("Poppins", 700), loadFont("Poppins", 500)]);
  return { bold, medium };
}

/** True when every visible character has a real glyph in the font. */
export function fontCanDraw(font: opentype.Font, text: string): boolean {
  return Array.from(text).every((ch) => /\s/.test(ch) || font.charToGlyph(ch).index !== 0);
}

function escapeAttr(value: string): string {
  return value.replace(/[^#0-9a-fA-F]/g, "");
}

type Block = { height: number; draw: (top: number) => string };

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

  const usable = (label: string, text: string | undefined, font: opentype.Font): string | null => {
    const t = text?.trim();
    if (!t) return null;
    if (!fontCanDraw(font, t)) {
      skipped.push(label);
      return null;
    }
    drawn.push(label);
    return t;
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
    blocks.push({ height: logoSize.h, draw: () => "" });
  } else {
    const brand = usable("brandName", content.brandName, fonts.bold.font);
    if (brand) blocks.push(textBlock(brand, fonts.bold.font, { min: unit * 0.04, max: unit * 0.055, lines: 1, fill: "#FFFFFF" }));
  }

  const offer = usable("offer", content.offer, fonts.bold.font);
  if (offer) blocks.push(textBlock(offer, fonts.bold.font, { min: unit * 0.045, max: unit * 0.07, lines: 2, fill: "#FFFFFF" }));

  const cta = usable("cta", content.cta, fonts.bold.font);
  if (cta) {
    const accent = /^#[0-9a-fA-F]{6}$/.test(content.accentColor || "") ? content.accentColor! : DEFAULT_ACCENT;
    const label = pickReadable(relativeLuminance(hexToRgb(accent)), ["#FFFFFF", "#111111"], 4.5).color;
    const size = unit * 0.045;
    const textW = Math.min(measureLine(fonts.bold.font, cta, size), boxWidth * 0.8);
    const pillW = textW + size * 2;
    const pillH = size * 2;
    blocks.push({
      height: pillH,
      draw: (top) =>
        `<rect x="${(W - pillW) / 2}" y="${top}" width="${pillW}" height="${pillH}" rx="${pillH / 2}" fill="${escapeAttr(accent)}"/>` +
        `<path d="${linePathData(fonts.bold.font, cta, (W - textW) / 2, top + pillH / 2 + size * 0.35, size)}" fill="${label}"/>`,
    });
  }

  const contact = usable("contact", content.contact, fonts.medium.font);
  if (contact) blocks.push(textBlock(contact, fonts.medium.font, { min: unit * 0.032, max: unit * 0.042, lines: 1, fill: "#FFFFFF", opacity: 0.9 }));

  const stackH = blocks.reduce((sum, b) => sum + b.height, 0) + gap * Math.max(0, blocks.length - 1);
  // Bottom safe area clears platform UI (Reels / Shorts captions and buttons).
  const bottomPad = H * 0.07;
  let top = H - bottomPad - stackH;
  const panelTop = Math.max(0, top - H * 0.08);

  const parts: string[] = [];
  const logoTop = top;
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
  if (logoPng) {
    card = sharp(await card.toBuffer()).composite([
      { input: logoPng, left: Math.round((W - logoSize.w) / 2), top: Math.round(logoTop) },
    ]);
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
