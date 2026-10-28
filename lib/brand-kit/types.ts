/**
 * Brand Kit — a brand's own design system, shared by the API, the editor
 * and poster generation. Pure module (no server imports) so the client can use it.
 */

export const BRAND_COLOR_ROLES = [
  "primary",
  "secondary",
  "accent",
  "background",
  "text",
] as const;
export type BrandColorRole = (typeof BRAND_COLOR_ROLES)[number];

export const BRAND_FONT_SOURCES = ["google", "custom", "system"] as const;
export type BrandFontSource = (typeof BRAND_FONT_SOURCES)[number];

export type BrandKitColor = {
  hex: string;
  role: BrandColorRole;
  name?: string | null;
};

export type BrandKitFont = {
  family: string;
  source: BrandFontSource;
  /** Font file (custom) or stylesheet (google) URL when known */
  url?: string | null;
};

export type BrandKitLogo = {
  url: string;
  /** Variant for dark backgrounds, when the brand has one */
  darkUrl?: string | null;
};

export type BrandKitGuidelines = {
  /** Elements every poster must carry, e.g. "Logo top-left", "@handle in footer" */
  mustInclude: string[];
  dos: string[];
  donts: string[];
};

/** Who the brand is — what strategy and copy are written from. */
export type BrandKitIdentity = {
  description: string;
  tagline: string;
  industry: string;
  /** What the brand sells */
  offering: string;
  audience: string;
  valueProposition: string;
  /** Tone / personality in words, e.g. "warm, expert, a little playful" */
  tone: string;
  values: string[];
  /** Carried over from website analysis; not edited directly */
  productCategory?: string | null;
  pricePositioning?: "budget" | "mid-range" | "premium" | null;
  brandVoice?: "Professional" | "Playful" | "Minimalist" | "Bold" | null;
  aesthetic?: string[];
  ctaPatterns?: string[];
};

export const EMPTY_IDENTITY: BrandKitIdentity = {
  description: "",
  tagline: "",
  industry: "",
  offering: "",
  audience: "",
  valueProposition: "",
  tone: "",
  values: [],
};

export type BrandKit = {
  id: string;
  name: string;
  websiteUrl: string | null;
  isDefault: boolean;
  logo: BrandKitLogo | null;
  colors: BrandKitColor[];
  fonts: { heading: BrandKitFont | null; body: BrandKitFont | null };
  guidelines: BrandKitGuidelines;
  identity: BrandKitIdentity;
  createdAt: string;
  updatedAt: string;
};

export type BrandKitInput = Omit<BrandKit, "id" | "createdAt" | "updatedAt">;

/** What the website extractor proposes; the user confirms it in the editor. */
export type BrandKitExtraction = {
  url: string;
  name: string | null;
  logoCandidates: Array<{ url: string; source: string }>;
  colors: Array<BrandKitColor & { weight: number }>;
  fonts: {
    heading: BrandKitFont | null;
    body: BrandKitFont | null;
    /** Every family found, most used first */
    all: Array<BrandKitFont & { weight: number }>;
  };
  stylesheetsRead: number;
  warnings: string[];
};

const MAX_NAME = 80;
const MAX_URL = 2000;
const MAX_COLORS = 8;
const MAX_RULES = 12;
const MAX_RULE_LENGTH = 160;

export function normalizeHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let hex = m[1].toLowerCase();
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  return `#${hex}`;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

/** http(s) URLs, or image data URLs (inline SVG logos) under ~200 KB. */
function cleanAssetUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (/^data:image\/(svg\+xml|png|jpeg|webp);/i.test(v)) {
    return v.length <= 200_000 ? v : null;
  }
  if (v.length > MAX_URL) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function cleanFont(value: unknown): BrandKitFont | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const family = cleanText(v.family, 60).replace(/["';{}]/g, "");
  if (!family) return null;
  const source = (BRAND_FONT_SOURCES as readonly string[]).includes(String(v.source))
    ? (v.source as BrandFontSource)
    : "google";
  return { family, source, url: cleanAssetUrl(v.url) };
}

function cleanRules(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const t = cleanText(item, MAX_RULE_LENGTH);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= MAX_RULES) break;
  }
  return out;
}

/**
 * Validate and normalise editor input. Unknown fields are dropped and
 * everything is size-capped. Returns errors instead of throwing.
 */
export function sanitizeBrandKitInput(
  raw: unknown
): { ok: true; value: BrandKitInput } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const name = cleanText(v.name, MAX_NAME);
  if (!name) errors.push("Brand name is required.");

  const websiteUrl = v.websiteUrl == null || v.websiteUrl === "" ? null : cleanAssetUrl(v.websiteUrl);
  if (v.websiteUrl && !websiteUrl) errors.push("Website must be an http(s) URL.");

  let logo: BrandKitLogo | null = null;
  if (v.logo && typeof v.logo === "object") {
    const l = v.logo as Record<string, unknown>;
    const url = cleanAssetUrl(l.url);
    if (l.url && !url) errors.push("Logo must be an http(s) or image data URL.");
    if (url) logo = { url, darkUrl: cleanAssetUrl(l.darkUrl) };
  }

  const colors: BrandKitColor[] = [];
  if (Array.isArray(v.colors)) {
    for (const c of v.colors) {
      if (!c || typeof c !== "object") continue;
      const cc = c as Record<string, unknown>;
      const hex = normalizeHex(cc.hex);
      if (!hex) {
        errors.push(`"${String(cc.hex ?? "")}" is not a valid hex colour.`);
        continue;
      }
      const role = (BRAND_COLOR_ROLES as readonly string[]).includes(String(cc.role))
        ? (cc.role as BrandColorRole)
        : "accent";
      colors.push({ hex, role, name: cleanText(cc.name, 40) || null });
      if (colors.length >= MAX_COLORS) break;
    }
  }

  const fontsRaw = v.fonts && typeof v.fonts === "object" ? (v.fonts as Record<string, unknown>) : {};
  const identity = cleanIdentity(v.identity);
  const g = v.guidelines && typeof v.guidelines === "object" ? (v.guidelines as Record<string, unknown>) : {};

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      websiteUrl,
      isDefault: v.isDefault === true,
      logo,
      colors,
      fonts: { heading: cleanFont(fontsRaw.heading), body: cleanFont(fontsRaw.body) },
      guidelines: {
        mustInclude: cleanRules(g.mustInclude),
        dos: cleanRules(g.dos),
        donts: cleanRules(g.donts),
      },
      identity,
    },
  };
}

const PRICE_POSITIONS = ["budget", "mid-range", "premium"] as const;
const BRAND_VOICES = ["Professional", "Playful", "Minimalist", "Bold"] as const;

function cleanList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const t = cleanText(item, maxLength);
    if (t && !out.includes(t)) out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Normalise identity input; unknown fields dropped, text size-capped. */
export function cleanIdentity(raw: unknown): BrandKitIdentity {
  const v = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const price = String(v.pricePositioning ?? "");
  const voice = String(v.brandVoice ?? "");
  return {
    description: cleanText(v.description, 600),
    tagline: cleanText(v.tagline, 120),
    industry: cleanText(v.industry, 80),
    offering: cleanText(v.offering, 400),
    audience: cleanText(v.audience, 300),
    valueProposition: cleanText(v.valueProposition, 300),
    tone: cleanText(v.tone, 160),
    values: cleanList(v.values, 10, 60),
    productCategory: cleanText(v.productCategory, 80) || null,
    pricePositioning: (PRICE_POSITIONS as readonly string[]).includes(price)
      ? (price as BrandKitIdentity["pricePositioning"])
      : null,
    brandVoice: (BRAND_VOICES as readonly string[]).includes(voice)
      ? (voice as BrandKitIdentity["brandVoice"])
      : null,
    aesthetic: cleanList(v.aesthetic, 8, 40),
    ctaPatterns: cleanList(v.ctaPatterns, 6, 40),
  };
}

/** Colours for a role, in kit order. */
export function colorsWithRole(kit: Pick<BrandKit, "colors">, role: BrandColorRole): string[] {
  return kit.colors.filter((c) => c.role === role).map((c) => c.hex);
}
