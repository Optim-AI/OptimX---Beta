/**
 * Ad Studio art brief: turns a researched ad angle into the short art-director brief
 * the poster engine does its best work from — one visual idea, a style, a clean
 * palette, the exact headline and button — instead of marketing strategy text.
 *
 * Tested side by side (2026-11-23): the same product photo and engine went from a
 * framed catalogue card with a stock blue button to a bold full-bleed poster when
 * given this kind of brief. If the call fails, Ad Studio falls back to the old path.
 */

import { agentJson } from "@/lib/agent/gemini-json";
import { IMAGE_CONTENT, safeFetch } from "@/lib/audit/url-safety";
import { cleanBrandColors } from "@/lib/brand-kit/design-hygiene";
import type { PosterVisualDirection } from "@/lib/creative-studio/poster-generation/types";
import type { BrandSnapshot, Product } from "@/app/web/src/components/creative-studio/types";

/** Styles that lead to designed posters. "commercial" (retail framing) is left out on purpose. */
export const ART_DIRECTIONS = ["bold", "premium", "minimal", "playful", "festive", "trendy", "dynamic", "professional"] as const;
export type ArtDirectionStyle = (typeof ART_DIRECTIONS)[number] & PosterVisualDirection;

export type ArtBrief = {
  direction: ArtDirectionStyle;
  productName: string;
  packaging: string | null;
  /** The brand name or logo is clearly printed on the product in the photo. */
  brandOnPack: boolean;
  /** False for brand posts with no product photo. */
  hasProduct: boolean;
  /** Whole-brand ad: the products shown together. Empty for one product. */
  range: string[];
  idea: string;
  background: string;
  palette: string[];
  typeFeel: string;
  headline: string;
  cta: string;
};

export type ArtBriefAngle = {
  title: string;
  angle?: string;
  message?: string;
  explanation?: string;
  audience?: string;
};

const clip = (s: unknown, n: number) => (typeof s === "string" ? s : "").replace(/\s+/g, " ").trim().slice(0, n);
const HEX = /^#[0-9a-f]{6}$/i;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Shop titles like "Peri Peri Fried Anchovies - oorgaa - snacks" → "Peri Peri Fried Anchovies". */
export function cleanProductName(name: string, brand?: string | null): string {
  let n = (name || "").replace(/\s+/g, " ").trim();
  const parts = n.split(/\s+[-–|·]\s+/).filter(Boolean);
  if (parts.length > 1) n = parts[0];
  if (brand) n = n.replace(new RegExp(`\\b(by\\s+)?${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "ig"), "").replace(/\s+/g, " ").trim();
  return n || name.trim();
}

/** Validate the model's answer. Returns null when it is not usable (caller falls back). */
export function cleanArtBrief(
  raw: unknown,
  ctx: { brandColors: string[]; productName: string; fallbackHeadline: string; exactHeadline?: string | null; hasProduct?: boolean; range?: string[] }
): ArtBrief | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const direction = (ART_DIRECTIONS as readonly string[]).includes(String(r.direction)) ? (r.direction as ArtDirectionStyle) : "bold";
  const idea = clip(r.idea, 400);
  if (!idea) return null;

  // A headline the owner already saw (e.g. in the agent's post plan) is kept word for word.
  const exact = clip(ctx.exactHeadline, 80);
  let headline = exact && words(exact) <= 8 ? exact : clip(r.headline, 80).replace(/^["“']|["”']$/g, "");
  if (!headline || words(headline) > 8) headline = clip(ctx.fallbackHeadline, 80);
  if (!headline) return null;
  const cta = clip(r.cta, 24).replace(/^["“']|["”']$/g, "") || "Shop now";

  // Palette: only the brand's own colours (theme defaults dropped). A colour the model
  // made up is allowed only when the brand has no usable colours at all.
  const brand = cleanBrandColors(ctx.brandColors.map((c) => c.toLowerCase()).filter((c) => HEX.test(c)));
  const asked = Array.isArray(r.palette) ? r.palette.map((c) => String(c).toLowerCase()).filter((c) => HEX.test(c)) : [];
  const palette = brand.length ? asked.filter((c) => brand.includes(c)) : asked;

  return {
    direction,
    productName: clip(r.productName, 60) || ctx.productName,
    packaging: clip(r.packaging, 40) || null,
    brandOnPack: ctx.hasProduct !== false && r.brandOnPack === true,
    hasProduct: ctx.hasProduct !== false,
    range: ctx.hasProduct !== false ? (ctx.range ?? []).filter(Boolean).slice(0, 3) : [],
    idea,
    background: clip(r.background, 200),
    palette: [...new Set(palette.length ? palette : brand)].slice(0, 3),
    typeFeel: clip(r.typeFeel, 120),
    headline,
    cta,
  };
}

/** Lines for the brief's instruction: lock the copy so the strategist keeps it word for word. */
export function artBriefInstruction(a: ArtBrief): string[] {
  return [`Headline: "${a.headline}"`, `CTA: "${a.cta}"`];
}

/** The art-direction block added after the strategist runs. */
export function formatArtBrief(a: ArtBrief): string {
  return [
    "=== ART DIRECTION (for Creative Director / image generation only) ===",
    a.hasProduct && a.range.length > 1
      ? `Products: the ${a.range.join(", ")} together as one set — each exactly as in its photo, labels fully visible, none cropped; the brand is the hero.`
      : a.hasProduct
      ? `Product: ${a.productName}${a.packaging ? ` (${a.packaging})` : ""} — the exact product from the photo is the hero, label fully visible and never cropped.`
      : `No product photo: the brand and this one idea are the hero. Never invent a product pack or label.`,
    `One visual idea: ${a.idea}`,
    a.background && `Background and setting: ${a.background}`,
    a.palette.length && `Colours: ${a.palette.join(", ")} — one dominant colour, strong contrast.`,
    a.typeFeel && `Type: ${a.typeFeel}`,
    `Style: ${a.direction}. One dominant move, generous breathing room, no clutter, no extra props competing with the ${a.hasProduct ? "product" : "idea"}.`,
    `The headline reads exactly "${a.headline}" — every word, not shortened. The button reads "${a.cta}".`,
    a.brandOnPack
      ? "The brand name already shows on the packaging — no separate logo or wordmark."
      : a.hasProduct
        ? "Show the brand logo once only."
        : "Branding: the attached logo once, small, near an edge — never the brand name as large text and never inside or after the headline.",
    `No other words than the headline and the button${a.hasProduct ? " (text printed on the packs stays as it is)" : ""}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function productPhoto(url: string | undefined): Promise<{ mime: string; base64: string } | undefined> {
  if (!url) return undefined;
  try {
    const res = await safeFetch(url, { accept: IMAGE_CONTENT, maxBytes: 6 * 1024 * 1024, timeoutMs: 12_000 });
    if (!res.ok) return undefined;
    const mime = (res.headers.get("content-type") || "image/jpeg").split(";")[0];
    return { mime, base64: Buffer.from(await res.arrayBuffer()).toString("base64") };
  } catch {
    return undefined; // private/local URL or too large: write the brief without seeing the photo
  }
}

export async function writeArtBrief(input: {
  brand: BrandSnapshot;
  /** Null for brand posts (no single product). */
  product: Product | null;
  angle: ArtBriefAngle | null;
  ownerRequest?: string | null;
  aspectRatio?: string;
  /** Keep this headline word for word (the owner already saw it). */
  exactHeadline?: string | null;
  /** Whole-brand ad: names of the products shown together. */
  range?: string[];
}): Promise<ArtBrief | null> {
  const { brand, product, angle } = input;
  const productName = product ? cleanProductName(product.product_name, brand.name) : brand.name;
  const brandColors = cleanBrandColors((brand.primaryColors || []).filter(Boolean));
  const photo = product ? await productPhoto((product.product_images || []).find((u) => /^https?:\/\//.test(u))) : undefined;

  const prompt = `You are the art director for a ${input.aspectRatio || "4:5"} social media ad poster. Write a short, specific art brief.

Brand: ${brand.name}${brand.tone ? ` — tone: ${clip(brand.tone, 80)}` : ""}${brand.industry ? ` — ${clip(brand.industry, 60)}` : ""}
Brand colours (use only these): ${brandColors.join(", ") || "none on file — choose 2-3 that suit the product and packaging"}
${product && (input.range?.length ?? 0) > 1 ? `This is a whole-brand ad, not for one product: show the range together (${input.range!.join(", ")}), with the brand as the hero.` : product ? `Product: ${productName}${product.category ? ` (${clip(product.category, 60)})` : ""}` : "No single product: this is a brand poster (no product photo). Build the one idea around the brand itself, never a made-up product pack."}
${angle ? `Ad angle: ${clip(angle.angle, 80)} — ${clip(angle.message || angle.explanation, 240)}
Hook to turn into the headline: "${clip(angle.title, 120)}"` : ""}
${input.ownerRequest ? `The owner asked for (respect it): ${clip(input.ownerRequest, 500)}` : ""}
${photo ? "The attached image is the real product photo: describe the packaging type you see (jar, pouch, can, bottle, box…), and say whether the brand name or logo is clearly printed on the product itself (brandOnPack)." : ""}

Rules:
- ONE visual idea that a single still image can show, with the ${product ? "product" : "brand"} as the hero. No sounds, no step-by-step actions, no split scenes, no crowd of props.
- If the owner mentioned a trend or occasion, use it as a light flavour of the one idea, never a second scene.
${input.exactHeadline ? `- Headline: use exactly "${clip(input.exactHeadline, 80)}".` : "- Headline: 2-6 words, punchy, keeps the hook's idea, no brand name."} No prices, discounts, ratings or claims that were not given.
- cta: 2-3 words.
- direction: one of ${ART_DIRECTIONS.join(", ")} — pick what suits the brand and product (never retail/catalogue framing).

Reply as JSON only:
{"direction":"","productName":"short clean name","packaging":"","brandOnPack":false,"idea":"one or two sentences","background":"","palette":["#hex"],"typeFeel":"e.g. huge heavy rounded sans","headline":"","cta":""}`;

  try {
    const raw = await agentJson<unknown>(prompt, { file: photo, timeoutMs: 45_000, label: "ad-studio-art-brief" });
    return cleanArtBrief(raw, { brandColors, productName, fallbackHeadline: angle?.title || "", exactHeadline: input.exactHeadline, hasProduct: !!product, range: input.range });
  } catch (err) {
    console.warn("[art-brief] failed, using the standard brief", { message: (err as Error)?.message?.slice(0, 160) });
    return null;
  }
}
