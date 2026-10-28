/** Colour helpers: WCAG contrast and readable text colour selection. */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0) as [number, number, number];
}

/** WCAG relative luminance (0–1) of an sRGB colour. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(l1: number, l2: number): number {
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

/** First candidate whose contrast against the background meets the minimum, else the best one. */
export function pickReadable(
  backgroundLum: number,
  candidates: string[],
  minContrast: number
): { color: string; contrast: number; meets: boolean } {
  let best = { color: candidates[0], contrast: 0, meets: false };
  for (const c of candidates) {
    const contrast = contrastRatio(relativeLuminance(hexToRgb(c)), backgroundLum);
    if (contrast >= minContrast) return { color: c, contrast, meets: true };
    if (contrast > best.contrast) best = { color: c, contrast, meets: false };
  }
  return best;
}
