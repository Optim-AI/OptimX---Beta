/**
 * Fit text to a box: the largest font size (between min and max) at which the
 * text wraps into at most maxLines and fits the box height. Measured with the
 * real font, so what we compute is what gets drawn.
 */

import type opentype from "opentype.js";

/**
 * Glyphs are laid out directly (char → glyph, advance + kerning) rather than
 * through opentype's substitution engine, which throws on some GSUB lookups
 * found in common Google fonts. Ligatures don't matter at poster sizes.
 */
function glyphRun(font: opentype.Font, text: string, size: number, tracking: number) {
  const scale = size / (font.unitsPerEm || 1000);
  const glyphs = Array.from(text).map((ch) => font.charToGlyph(ch));
  const xs: number[] = [];
  let x = 0;
  glyphs.forEach((g, i) => {
    // getKerningValue can return undefined for some GPOS tables; a NaN would end the SVG path.
    if (i > 0) x += (Number(font.getKerningValue(glyphs[i - 1], g)) || 0) * scale + tracking * size;
    xs.push(x);
    x += (Number(g.advanceWidth) || 0) * scale;
  });
  return { glyphs, xs, width: x };
}

export function measureLine(font: opentype.Font, text: string, size: number, tracking = 0): number {
  return glyphRun(font, text, size, tracking).width;
}

const n2 = (v: number) => (Math.round(v * 100) / 100).toString();

/**
 * Serialise path commands ourselves: opentype's toPathData sometimes emits
 * NaN for valid curves, which silently truncates the SVG path.
 */
function commandsToPathData(commands: opentype.PathCommand[]): string {
  return commands
    .map((c) => {
      switch (c.type) {
        case "M":
        case "L":
          return `${c.type}${n2(c.x)} ${n2(c.y)}`;
        case "Q":
          return `Q${n2(c.x1)} ${n2(c.y1)} ${n2(c.x)} ${n2(c.y)}`;
        case "C":
          return `C${n2(c.x1)} ${n2(c.y1)} ${n2(c.x2)} ${n2(c.y2)} ${n2(c.x)} ${n2(c.y)}`;
        default:
          return "Z";
      }
    })
    .join("");
}

/** SVG path data for one line with its baseline starting at (x, y). */
export function linePathData(font: opentype.Font, text: string, x: number, y: number, size: number, tracking = 0): string {
  const run = glyphRun(font, text, size, tracking);
  return run.glyphs.map((g, i) => commandsToPathData(g.getPath(x + run.xs[i], y, size).commands)).join(" ");
}

export type FitResult = { fontSize: number; lines: string[]; fits: boolean };

const measure = measureLine;

/** Greedy word wrap; a single word longer than the line is kept whole (then it won't fit). */
export function wrap(font: opentype.Font, text: string, size: number, maxWidth: number, tracking = 0): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || measure(font, next, size, tracking) <= maxWidth) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Re-balance a 2–3 line wrap so lines are similar in length (no lonely last word). */
function balance(font: opentype.Font, text: string, size: number, maxWidth: number, lineCount: number, tracking: number): string[] {
  if (lineCount < 2) return wrap(font, text, size, maxWidth, tracking);
  let lo = maxWidth * 0.5;
  let hi = maxWidth;
  let best = wrap(font, text, size, maxWidth, tracking);
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const lines = wrap(font, text, size, mid, tracking);
    if (lines.length <= lineCount) {
      best = lines;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

export function fitText(opts: {
  font: opentype.Font;
  text: string;
  boxWidth: number;
  boxHeight: number;
  minSize: number;
  maxSize: number;
  maxLines: number;
  lineHeight: number;
  tracking?: number;
}): FitResult {
  const tracking = opts.tracking ?? 0;
  const fitsAt = (size: number) => {
    const lines = wrap(opts.font, opts.text, size, opts.boxWidth, tracking);
    const widest = Math.max(...lines.map((l) => measure(opts.font, l, size, tracking)));
    return (
      lines.length <= opts.maxLines &&
      widest <= opts.boxWidth &&
      lines.length * size * opts.lineHeight <= opts.boxHeight
    );
  };
  let lo = opts.minSize;
  let hi = opts.maxSize;
  if (!fitsAt(lo)) {
    const lines = wrap(opts.font, opts.text, lo, opts.boxWidth, tracking);
    return { fontSize: lo, lines, fits: false };
  }
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (fitsAt(mid)) lo = mid;
    else hi = mid;
  }
  const size = Math.floor(lo);
  const lines = wrap(opts.font, opts.text, size, opts.boxWidth, tracking);
  return { fontSize: size, lines: balance(opts.font, opts.text, size, opts.boxWidth, lines.length, tracking), fits: true };
}
