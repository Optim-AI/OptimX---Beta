/** Brand Kit colours → the five roles templates use, with sensible fallbacks. */

import type { BrandKitColor } from "@/lib/brand-kit/types";
import { contrastRatio, hexToRgb, relativeLuminance } from "./color";
import type { Palette } from "./types";

const DEFAULT: Palette = {
  primary: "#1f2a44",
  secondary: "#3b4a6b",
  accent: "#f2b33d",
  background: "#ffffff",
  text: "#111111",
};

const lum = (hex: string) => relativeLuminance(hexToRgb(hex));

export function buildPalette(colors: BrandKitColor[] | null | undefined, fallbackHexes: string[] = []): Palette {
  const byRole = new Map<string, string>();
  for (const c of colors ?? []) if (!byRole.has(c.role)) byRole.set(c.role, c.hex);
  const loose = [...(colors ?? []).map((c) => c.hex), ...fallbackHexes];

  const primary = byRole.get("primary") ?? loose[0] ?? DEFAULT.primary;
  const background = byRole.get("background") ?? DEFAULT.background;
  let text = byRole.get("text") ?? (lum(background) > 0.4 ? DEFAULT.text : "#ffffff");
  if (contrastRatio(lum(text), lum(background)) < 4.5) text = lum(background) > 0.4 ? DEFAULT.text : "#ffffff";
  const secondary = byRole.get("secondary") ?? loose.find((h) => h !== primary) ?? DEFAULT.secondary;
  // The accent fills CTAs and badges on the primary colour, so it must stand apart from it.
  const accentCandidates = [byRole.get("accent"), ...loose, DEFAULT.accent, "#ffffff", "#111111"].filter(Boolean) as string[];
  const accent =
    accentCandidates.find((h) => h !== primary && contrastRatio(lum(h), lum(primary)) >= 1.8) ?? DEFAULT.accent;
  return { primary, secondary, accent, background, text };
}
