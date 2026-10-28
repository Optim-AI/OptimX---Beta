/**
 * Website → Brand Kit proposal: real font families, colours ranked by use
 * (with roles), and logo candidates. Server-only.
 *
 * Every fetch goes through an injected fetcher (default: SSRF-safe
 * safeFetchText), so tests run offline and user-supplied URLs can never
 * reach private addresses.
 */

import { JSDOM, VirtualConsole } from "jsdom";
import type { BrandColorRole, BrandKitExtraction, BrandKitFont } from "./types";
import { normalizeHex } from "./types";

export type BrandFetchText = (
  url: string,
  kind: "html" | "css"
) => Promise<{ url: string; body: string } | null>;

const MAX_STYLESHEETS = 6;

/** Generic and OS-default families that say nothing about the brand. */
const GENERIC_FONTS = new Set(
  [
    "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui", "ui-sans-serif",
    "ui-serif", "ui-monospace", "ui-rounded", "-apple-system", "blinkmacsystemfont",
    "segoe ui", "helvetica neue", "helvetica", "arial", "noto sans", "liberation sans",
    "apple color emoji", "segoe ui emoji", "segoe ui symbol", "noto color emoji",
    "inherit", "initial", "unset", "revert", "emoji", "math", "fangsong", "times new roman",
    "times", "courier new", "courier", "menlo", "monaco", "consolas", "sfmono-regular",
    "georgia", "verdana", "tahoma", "trebuchet ms",
  ].map((f) => f.toLowerCase())
);

const HEADING_SELECTOR = /(^|[\s,>+~])(h1|h2|h3|\.?(heading|headline|title|display|hero)[\w-]*)\b/i;
const BODY_SELECTOR = /(^|[\s,])(html|body|:root|\*)(?=$|[\s,{:.#[])/i;

// ─── fonts ──────────────────────────────────────────────────

/** "__Inter_a1b2c3" / "__Inter_Fallback_a1b2c3" (next/font) → "Inter" */
export function cleanFontFamily(raw: string): string | null {
  let f = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (!f || /^var\(/i.test(f) || /fallback/i.test(f)) return null;
  const nextFont = f.match(/^__(.+?)_[0-9a-f]{5,}$/i);
  if (nextFont) f = nextFont[1].replace(/_/g, " ");
  if (GENERIC_FONTS.has(f.toLowerCase())) return null;
  // Weights/keywords picked up from shorthand or variables, and icon fonts
  if (/^[\d.]+$/.test(f) || /^(normal|bold|bolder|lighter|italic|oblique|small-caps)$/i.test(f)) return null;
  if (/icon|glyph|awesome|symbol|judgeme|swiper|slick|star/i.test(f)) return null;
  return f;
}

/** First brand-specific family in a font stack, resolving var(--x) when known. */
export function primaryFamilyFromStack(stack: string, vars: Map<string, string> = new Map()): string | null {
  let value = stack;
  for (let i = 0; i < 3; i++) {
    const v = value.match(/var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)/);
    if (!v) break;
    value = value.replace(v[0], vars.get(v[1]) ?? v[2] ?? "");
  }
  for (const part of value.split(",")) {
    const fam = cleanFontFamily(part);
    if (fam) return fam;
  }
  return null;
}

/** fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display → names */
export function googleFontFamilies(href: string): string[] {
  try {
    const u = new URL(href, "https://fonts.googleapis.com");
    if (!/fonts\.googleapis\.com$/i.test(u.hostname)) return [];
    const out: string[] = [];
    for (const fam of u.searchParams.getAll("family")) {
      for (const piece of fam.split("|")) {
        const name = piece.split(":")[0].replace(/\+/g, " ").trim();
        if (name && !out.includes(name)) out.push(name);
      }
    }
    return out;
  } catch {
    return [];
  }
}

// ─── colours ────────────────────────────────────────────────

type Rgb = [number, number, number];

function parseColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  const hex = v.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    const h = hex[1];
    if (h.length === 4 || h.length === 8) {
      const alpha = h.length === 4 ? parseInt(h[3] + h[3], 16) : parseInt(h.slice(6, 8), 16);
      if (alpha < 128) return null;
      return normalizeHex(h.length === 4 ? h.slice(0, 3) : h.slice(0, 6));
    }
    return normalizeHex(h);
  }
  const rgb = v.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (rgb) {
    if (rgb[4] !== undefined) {
      const a = rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
      if (a < 0.5) return null;
    }
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((n) => Math.min(255, parseInt(n, 10)));
    return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  }
  return null;
}

function toRgb(hex: string): Rgb {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

/** Chroma (0–1) separates real colour from tinted greys better than HSL saturation for very dark shades. */
function chromaAndLightness([r, g, b]: Rgb): { chroma: number; l: number } {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  return { chroma: max - min, l: (max + min) / 2 };
}

function distance(a: Rgb, b: Rgb): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

type ColorUse = "background" | "text" | "other";

/** Bootstrap/UI-kit defaults that show up in vendor CSS but are rarely the brand. */
const FRAMEWORK_DEFAULT_COLORS = new Set([
  "#007bff", "#0d6efd", "#28a745", "#198754", "#dc3545", "#ffc107", "#17a2b8",
  "#0dcaf0", "#6c757d", "#6610f2", "#6f42c1", "#e83e8c", "#d63384", "#fd7e14",
  "#20c997", "#343a40", "#212529", "#f8f9fa",
]);

/** Merge near-identical colours, then assign roles: chromatic → primary/secondary/accent; neutrals → background/text. */
export function rankBrandColors(
  uses: Array<{ hex: string; weight: number; use: ColorUse }>
): BrandKitExtraction["colors"] {
  type Bucket = { hex: string; rgb: Rgb; weight: number; bg: number; text: number };
  const buckets: Bucket[] = [];
  for (const raw of uses) {
    const u = FRAMEWORK_DEFAULT_COLORS.has(raw.hex) ? { ...raw, weight: raw.weight * 0.1 } : raw;
    const rgb = toRgb(u.hex);
    const hit = buckets.find((b) => distance(b.rgb, rgb) < 18);
    const target = hit ?? (buckets.push({ hex: u.hex, rgb, weight: 0, bg: 0, text: 0 }), buckets[buckets.length - 1]);
    target.weight += u.weight;
    if (u.use === "background") target.bg += u.weight;
    if (u.use === "text") target.text += u.weight;
  }

  const chromatic: Bucket[] = [];
  const lightNeutrals: Bucket[] = [];
  const darkNeutrals: Bucket[] = [];
  for (const b of buckets) {
    const { chroma, l } = chromaAndLightness(b.rgb);
    if (chroma > 0.12) chromatic.push(b);
    else if (l >= 0.75) lightNeutrals.push(b);
    else if (l <= 0.3) darkNeutrals.push(b);
  }
  chromatic.sort((a, b) => b.weight - a.weight);

  const out: BrandKitExtraction["colors"] = [];
  const roles: BrandColorRole[] = ["primary", "secondary", "accent"];
  for (const b of chromatic) {
    if (out.length >= roles.length) break;
    // Skip hues too close to an already chosen brand colour
    if (out.some((o) => distance(toRgb(o.hex), b.rgb) < 60)) continue;
    out.push({ hex: b.hex, role: roles[out.length], weight: Math.round(b.weight) });
  }
  const bg = [...lightNeutrals].sort((a, b) => b.bg - a.bg || b.weight - a.weight)[0];
  const text = [...darkNeutrals].sort((a, b) => b.text - a.text || b.weight - a.weight)[0];
  if (bg) out.push({ hex: bg.hex, role: "background", weight: Math.round(bg.weight) });
  if (text) out.push({ hex: text.hex, role: "text", weight: Math.round(text.weight) });
  return out;
}

// ─── CSS scanning ───────────────────────────────────────────

type CssFindings = {
  vars: Map<string, string>;
  fontRules: Array<{ selector: string; stack: string }>;
  fontFaces: Array<{ family: string; url: string | null }>;
  colorUses: Array<{ hex: string; weight: number; use: ColorUse }>;
  imports: string[];
};

const BRAND_VAR = /(brand|primary|secondary|accent|main|theme)/i;

/** Lightweight CSS scan (no full parser): enough to find fonts, colours and @imports. */
export function scanCss(css: string, baseUrl: string, into?: CssFindings): CssFindings {
  const f: CssFindings = into ?? { vars: new Map(), fontRules: [], fontFaces: [], colorUses: [], imports: [] };
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");

  for (const m of text.matchAll(/@import\s+(?:url\()?\s*["']?([^"')\s;]+)["']?\s*\)?/gi)) {
    try {
      f.imports.push(new URL(m[1], baseUrl).toString());
    } catch {
      /* ignore bad @import */
    }
  }

  for (const face of text.matchAll(/@font-face\s*{([^}]*)}/gi)) {
    const fam = face[1].match(/font-family\s*:\s*([^;]+)/i);
    const src = face[1].match(/url\(\s*["']?([^"')]+\.(?:woff2|woff|ttf|otf)[^"')]*)["']?\s*\)/i);
    const family = fam ? cleanFontFamily(fam[1]) : null;
    if (family) {
      let url: string | null = null;
      try {
        url = src ? new URL(src[1], baseUrl).toString() : null;
      } catch {
        url = null;
      }
      f.fontFaces.push({ family, url });
    }
  }

  const body = text.replace(/@font-face\s*{[^}]*}/gi, "");
  for (const rule of body.matchAll(/([^{}@]+){([^{}]*)}/g)) {
    const selector = rule[1].trim();
    const decls = rule[2];
    for (const d of decls.matchAll(/(--[\w-]+|[a-z-]+)\s*:\s*([^;]+)/gi)) {
      const prop = d[1].toLowerCase();
      const value = d[2].replace(/!important/i, "").trim();
      if (prop.startsWith("--")) {
        f.vars.set(d[1], value);
        const hex = parseColor(value);
        if (hex) f.colorUses.push({ hex, weight: BRAND_VAR.test(prop) ? 6 : 1, use: "other" });
        if (/font/i.test(prop) && !/size|weight|feature|variation/i.test(prop)) {
          f.fontRules.push({ selector: /head|display|title/i.test(prop) ? "h1" : "body", stack: value });
        }
        continue;
      }
      if (prop === "font-family") {
        f.fontRules.push({ selector, stack: value });
        continue;
      }
      if (prop === "font") {
        // Shorthand: the family list follows the size ("700 2rem/1.2 Inter, sans-serif")
        const fam = value.match(/(?:^|\s)[\d.]+(?:px|r?em|%|pt|vw|vh)(?:\/\S+)?\s+(.+)$/i);
        if (fam) f.fontRules.push({ selector, stack: fam[1] });
        continue;
      }
      const use: ColorUse | null =
        prop === "background" || prop === "background-color"
          ? "background"
          : prop === "color"
            ? "text"
            : /^(border(-[a-z]+)?-color|border|fill|stroke|outline-color)$/.test(prop)
              ? "other"
              : null;
      if (!use) continue;
      for (const token of value.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || []) {
        const hex = parseColor(token);
        if (hex) f.colorUses.push({ hex, weight: 1, use });
      }
    }
  }
  return f;
}

function rankFonts(
  findings: CssFindings,
  googleFamilies: string[]
): BrandKitExtraction["fonts"] {
  const weights = new Map<string, { weight: number; source: BrandKitFont["source"]; url: string | null }>();
  const add = (family: string, w: number, source: BrandKitFont["source"], url: string | null = null) => {
    const key = family.toLowerCase();
    const cur = weights.get(key);
    if (cur) {
      cur.weight += w;
      if (!cur.url && url) cur.url = url;
      if (source !== "system") cur.source = source;
    } else {
      weights.set(key, { weight: w, source, url });
    }
  };

  const googleSet = new Set(googleFamilies.map((g) => g.toLowerCase()));
  const faceUrls = new Map(findings.fontFaces.map((ff) => [ff.family.toLowerCase(), ff.url]));
  const sourceFor = (fam: string): BrandKitFont["source"] =>
    googleSet.has(fam.toLowerCase()) ? "google" : faceUrls.has(fam.toLowerCase()) ? "custom" : "google";

  for (const g of googleFamilies) add(g, 2, "google");
  for (const ff of findings.fontFaces) add(ff.family, 1, googleSet.has(ff.family.toLowerCase()) ? "google" : "custom", ff.url);

  let heading: string | null = null;
  let headingWeight = 0;
  let bodyFont: string | null = null;
  let bodyWeight = 0;
  const headingCounts = new Map<string, number>();
  const bodyCounts = new Map<string, number>();

  for (const r of findings.fontRules) {
    const fam = primaryFamilyFromStack(r.stack, findings.vars);
    if (!fam) continue;
    add(fam, 1, sourceFor(fam), faceUrls.get(fam.toLowerCase()) ?? null);
    if (HEADING_SELECTOR.test(r.selector)) headingCounts.set(fam, (headingCounts.get(fam) || 0) + 1);
    if (BODY_SELECTOR.test(r.selector)) bodyCounts.set(fam, (bodyCounts.get(fam) || 0) + 1);
  }
  for (const [fam, n] of headingCounts) if (n > headingWeight) [heading, headingWeight] = [fam, n];
  for (const [fam, n] of bodyCounts) if (n > bodyWeight) [bodyFont, bodyWeight] = [fam, n];

  const all = [...weights.entries()]
    .map(([key, v]) => {
      const display =
        [...googleFamilies, ...findings.fontFaces.map((x) => x.family), heading, bodyFont]
          .find((n) => n && n.toLowerCase() === key) ||
        findings.fontRules.map((r) => primaryFamilyFromStack(r.stack, findings.vars)).find((n) => n?.toLowerCase() === key) ||
        key;
      return { family: display as string, source: v.source, url: v.url, weight: v.weight };
    })
    .sort((a, b) => b.weight - a.weight);

  const asFont = (fam: string | null): BrandKitFont | null => {
    if (!fam) return null;
    const hit = all.find((a) => a.family.toLowerCase() === fam.toLowerCase());
    return hit ? { family: hit.family, source: hit.source, url: hit.url } : { family: fam, source: "google", url: null };
  };

  const bodyPick = asFont(bodyFont) ?? (all[0] ? { family: all[0].family, source: all[0].source, url: all[0].url } : null);
  return { heading: asFont(heading) ?? bodyPick, body: bodyPick, all };
}

// ─── logo ───────────────────────────────────────────────────

function abs(url: string | null | undefined, base: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function findLogoCandidates(doc: Document, base: string): BrandKitExtraction["logoCandidates"] {
  const out: BrandKitExtraction["logoCandidates"] = [];
  const push = (url: string | null, source: string) => {
    if (url && !out.some((c) => c.url === url)) out.push({ url, source });
  };

  // Declared logo in structured data is the most reliable signal.
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const data = JSON.parse(script.textContent || "null");
      const nodes = Array.isArray(data) ? data : data?.["@graph"] ?? [data];
      for (const n of nodes) {
        const logo = typeof n?.logo === "string" ? n.logo : n?.logo?.url;
        push(abs(logo, base), "structured data");
      }
    } catch {
      /* ignore invalid JSON-LD */
    }
  }

  const logoish = '[class*="logo" i], [id*="logo" i], [alt*="logo" i], [src*="logo" i], [aria-label*="logo" i]';
  for (const img of Array.from(doc.querySelectorAll(`header img, nav img, a[href="/"] img, img${logoish.split(", ").join(", img")}`))) {
    const el = img as HTMLImageElement;
    const src = el.getAttribute("src") || el.getAttribute("data-src");
    const looksLikeLogo = /logo|brand/i.test(`${el.className} ${el.id} ${el.alt} ${src}`) || !!el.closest('a[href="/"]');
    if (looksLikeLogo) push(abs(src, base), /\.svg(\?|$)/i.test(src || "") ? "header logo (SVG)" : "header logo");
  }

  // Inline SVG logos → data URL (kept small)
  for (const svg of Array.from(doc.querySelectorAll(`header svg, a[href="/"] svg, svg${logoish.split(", ").join(", svg")}`))) {
    const holder = svg.closest('a, [class*="logo" i], [id*="logo" i]');
    if (!holder && !/logo/i.test(svg.getAttribute("class") || "")) continue;
    const markup = svg.outerHTML;
    if (markup.length > 1_000 && markup.length < 60_000 && !/<script/i.test(markup)) {
      const withNs = markup.includes("xmlns=") ? markup : markup.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
      push(`data:image/svg+xml;base64,${Buffer.from(withNs).toString("base64")}`, "inline SVG logo");
    }
    if (out.length > 6) break;
  }

  push(abs(doc.querySelector('link[rel~="icon"][type="image/svg+xml"]')?.getAttribute("href"), base), "SVG icon");
  push(abs(doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href"), base), "app icon");
  push(abs(doc.querySelector('meta[property="og:image"]')?.getAttribute("content"), base), "social preview image");
  return out.slice(0, 8);
}

// ─── main ───────────────────────────────────────────────────

export async function extractBrandKitFromWebsite(
  url: string,
  fetchText: BrandFetchText
): Promise<BrandKitExtraction> {
  const warnings: string[] = [];
  const page = await fetchText(url, "html");
  if (!page) throw new Error("Could not load that website.");
  const base = page.url;

  // Silence jsdom's own CSS parse errors; we scan CSS ourselves.
  const virtualConsole = new VirtualConsole();
  const dom = new JSDOM(page.body, { url: base, virtualConsole });
  const doc = dom.window.document;

  const siteName =
    doc.querySelector('meta[property="og:site_name"]')?.getAttribute("content")?.trim() ||
    (doc.title || "").split(/\s[|–—-]\s/)[0].trim() ||
    null;

  const findings = scanCss("", base);
  const googleFamilies: string[] = [];
  const stylesheetUrls: string[] = [];

  for (const link of Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href], link[rel="preload"][as="style"][href]'))) {
    const href = abs(link.getAttribute("href"), base);
    if (!href) continue;
    if (/fonts\.googleapis\.com/i.test(href)) googleFamilies.push(...googleFontFamilies(href));
    else if (!stylesheetUrls.includes(href)) stylesheetUrls.push(href);
  }
  for (const style of Array.from(doc.querySelectorAll("style"))) scanCss(style.textContent || "", base, findings);
  for (const el of Array.from(doc.querySelectorAll("[style]")).slice(0, 400)) {
    scanCss(`x{${el.getAttribute("style")}}`, base, findings);
  }

  const themeColor = parseColor(doc.querySelector('meta[name="theme-color"]')?.getAttribute("content") || "");
  if (themeColor) findings.colorUses.push({ hex: themeColor, weight: 8, use: "other" });

  let read = 0;
  const queue = [...stylesheetUrls];
  while (queue.length && read < MAX_STYLESHEETS) {
    const next = queue.shift()!;
    const css = await fetchText(next, "css").catch(() => null);
    if (!css) {
      warnings.push(`Could not read stylesheet ${new URL(next).pathname}`);
      continue;
    }
    read += 1;
    const before = findings.imports.length;
    scanCss(css.body, css.url, findings);
    for (const imp of findings.imports.slice(before)) {
      if (/fonts\.googleapis\.com/i.test(imp)) googleFamilies.push(...googleFontFamilies(imp));
      else if (!queue.includes(imp)) queue.push(imp);
    }
  }
  if (stylesheetUrls.length > MAX_STYLESHEETS) {
    warnings.push(`Read ${MAX_STYLESHEETS} of ${stylesheetUrls.length} stylesheets.`);
  }

  const fonts = rankFonts(findings, [...new Set(googleFamilies)]);
  const colors = rankBrandColors(findings.colorUses);
  if (!fonts.body) warnings.push("No brand font found; the site may load fonts with JavaScript.");
  if (!colors.some((c) => c.role === "primary")) warnings.push("No clear brand colour found.");

  return {
    url: base,
    name: siteName,
    logoCandidates: findLogoCandidates(doc, base),
    colors,
    fonts,
    stylesheetsRead: read,
    warnings,
  };
}
