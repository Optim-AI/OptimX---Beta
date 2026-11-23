/**
 * Website scans pick up theme defaults as "brand" colours (iPhone link blue,
 * Bootstrap blue) and CSS variable names as "fonts" (M-Heading-Font). Passed to
 * the poster engine they come out as a stock blue button and a guessed typeface,
 * so we drop them before they reach a prompt. Pure functions.
 */

/** Framework and system defaults that are almost never a brand's own colour. */
const THEME_DEFAULT_COLORS = new Set([
  "#007aff", // iOS system blue
  "#0a84ff", // iOS system blue (dark)
  "#007bff", // Bootstrap 4 primary
  "#0d6efd", // Bootstrap 5 primary
  "#2c6ecb", // Shopify Polaris interactive
  "#1a73e8", // Google default link
  "#0000ee", // browser default link
  "#551a8b", // browser visited link
  "#3858e9", // WordPress theme blue
  "#2271b1", // WordPress admin blue
  "#0073aa", // WordPress classic blue
  "#0274be", // Astra theme blue
  "#cc1818", // WordPress alert red
]);

function hex6(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return /^#[0-9a-f]{6}$/.test(v) ? v : null;
}

export function isThemeDefaultColor(raw: string | null | undefined): boolean {
  const hex = raw ? hex6(raw) : null;
  return !!hex && THEME_DEFAULT_COLORS.has(hex);
}

/** Keep the brand's own colours; drop theme defaults. Never returns an empty list from a non-empty one. */
export function cleanBrandColors<T extends string | { hex: string }>(colors: T[]): T[] {
  const kept = colors.filter((c) => !isThemeDefaultColor(typeof c === "string" ? c : c.hex));
  return kept.length ? kept : colors;
}

const GENERIC_FONT = /^(inherit|initial|unset|serif|sans-serif|monospace|cursive|system-ui|-apple-system|blinkmacsystemfont|ui-sans-serif|ui-serif)$/i;
const VARIABLE_LIKE = [
  /^var\(/i,
  /[{}();]/,
  /^--/,
  /(^|[-_\s])(heading|body|title|text|primary|secondary|base|main|default|custom|theme)[-_\s]?font$/i,
  /^font[-_\s]?(\d+|heading|body|primary|secondary)$/i,
  /^[a-z][-_](heading|body)[-_]/i,
];

/** A real typeface name, not a CSS variable or theme slot. */
export function isRealFontFamily(raw: string | null | undefined): boolean {
  const name = (raw || "").trim().replace(/^["']|["']$/g, "");
  if (name.length < 2 || name.length > 40) return false;
  if (GENERIC_FONT.test(name)) return false;
  return !VARIABLE_LIKE.some((re) => re.test(name));
}

export function realFontOrNull(raw: string | null | undefined): string | null {
  return isRealFontFamily(raw) ? (raw as string).trim().replace(/^["']|["']$/g, "") : null;
}
