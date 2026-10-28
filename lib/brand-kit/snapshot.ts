/**
 * Brand Kit ⇄ legacy Brand Guideline (BrandSnapshot) bridge. Pure functions.
 *
 * The kit is the source of truth. Existing studio pages still read and save
 * the BrandSnapshot shape through /api/brand/snapshot, so:
 *  - kitToSnapshot: serve the kit in that shape (legacy-only fields fill in
 *    underneath when the guideline is for the same brand);
 *  - kitInputFromSnapshot / fillKitFromSnapshot: turn a saved guideline into a
 *    kit, or fill a kit's empty fields without overwriting what the user curated.
 */

import type { BrandSnapshot } from "@/app/web/src/components/creative-studio/types";
import {
  BRAND_COLOR_ROLES,
  EMPTY_IDENTITY,
  cleanIdentity,
  normalizeHex,
  sanitizeBrandKitInput,
  type BrandColorRole,
  type BrandKit,
  type BrandKitColor,
  type BrandKitIdentity,
  type BrandKitInput,
} from "./types";

const PLACEHOLDER_NAMES = new Set(["", "my brand", "unknown brand"]);

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}

export function sameBrandName(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A guideline worth keeping: a real name, or real content behind a placeholder name. */
export function isMeaningfulSnapshot(s: Partial<BrandSnapshot> | null | undefined): s is BrandSnapshot {
  if (!s || typeof s !== "object") return false;
  const name = str(s.name).toLowerCase();
  if (!PLACEHOLDER_NAMES.has(name)) return true;
  return !!(str(s.description) || str(s.offering));
}

function colorsFromSnapshot(s: Partial<BrandSnapshot>): BrandKitColor[] {
  const ordered = [
    ...list(s.primaryColors),
    str(s.colors?.primary),
    str(s.colors?.secondary),
    str(s.colors?.accent),
  ];
  const roles: BrandColorRole[] = ["primary", "secondary", "accent", "accent", "accent"];
  const out: BrandKitColor[] = [];
  for (const raw of ordered) {
    const hex = normalizeHex(raw);
    if (!hex || out.some((c) => c.hex === hex)) continue;
    out.push({ hex, role: roles[out.length] });
    if (out.length >= 5) break;
  }
  const neutral = normalizeHex(str(s.colors?.neutral));
  if (neutral && !out.some((c) => c.hex === neutral)) out.push({ hex: neutral, role: "background" });
  return out;
}

export function identityFromSnapshot(s: Partial<BrandSnapshot>): BrandKitIdentity {
  return cleanIdentity({
    description: str(s.description) || str(s.business_overview),
    tagline: s.tagline,
    industry: s.industry,
    offering: s.offering,
    audience: s.audience,
    valueProposition: s.coreValueProp,
    tone: str(s.personality) || str(s.tone),
    values: list(s.brand_values),
    productCategory: s.productCategory,
    pricePositioning: s.pricePositioning,
    brandVoice: s.brandVoice,
    aesthetic: list(s.brand_aesthetic),
    ctaPatterns: list(s.ctaPatterns),
  });
}

/** A new kit from a guideline. Returns null for placeholders or invalid data. */
export function kitInputFromSnapshot(
  s: Partial<BrandSnapshot> | null | undefined,
  opts: { isDefault: boolean }
): BrandKitInput | null {
  if (!isMeaningfulSnapshot(s)) return null;
  const font = str(s.primaryFont);
  const logoUrl = str(s.logo) || str(s.logoUrl);
  const parsed = sanitizeBrandKitInput({
    name: str(s.name) || "My brand",
    websiteUrl: str(s.website_url) || null,
    isDefault: opts.isDefault,
    logo: logoUrl ? { url: logoUrl } : null,
    colors: colorsFromSnapshot(s),
    fonts: font
      ? { heading: { family: font, source: "google" }, body: { family: font, source: "google" } }
      : {},
    guidelines: {},
    identity: identityFromSnapshot(s),
  });
  if (!parsed.ok) {
    // Drop whatever failed validation (e.g. an unusable logo URL) rather than lose the brand.
    const retry = sanitizeBrandKitInput({
      name: str(s.name) || "My brand",
      isDefault: opts.isDefault,
      colors: colorsFromSnapshot(s),
      identity: identityFromSnapshot(s),
    });
    return retry.ok ? retry.value : null;
  }
  return parsed.value;
}

/**
 * Fill a kit's empty fields from a guideline. Never overwrites curated values.
 * Returns null when nothing would change.
 */
export function fillKitFromSnapshot(kit: BrandKit, s: Partial<BrandSnapshot>): BrandKitInput | null {
  const incoming = kitInputFromSnapshot(s, { isDefault: kit.isDefault });
  if (!incoming) return null;
  let changed = false;
  const pick = <T,>(current: T, next: T, empty: (v: T) => boolean): T => {
    if (empty(current) && !empty(next)) {
      changed = true;
      return next;
    }
    return current;
  };
  const emptyStr = (v: unknown) => !str(v);
  const emptyArr = (v: unknown) => !Array.isArray(v) || v.length === 0;

  const identity = { ...EMPTY_IDENTITY, ...kit.identity };
  for (const key of Object.keys(incoming.identity) as Array<keyof BrandKitIdentity>) {
    const cur = identity[key];
    const next = incoming.identity[key];
    (identity as Record<string, unknown>)[key] = Array.isArray(cur) || Array.isArray(next)
      ? pick(cur as unknown[], next as unknown[], emptyArr)
      : pick(cur as unknown, next as unknown, (v) => v == null || emptyStr(v));
  }

  const result: BrandKitInput = {
    name: kit.name,
    websiteUrl: pick<string | null>(kit.websiteUrl, incoming.websiteUrl, emptyStr),
    isDefault: kit.isDefault,
    logo: pick(kit.logo, incoming.logo, (v) => !v),
    colors: pick<BrandKitColor[]>(kit.colors, incoming.colors, emptyArr),
    fonts: {
      heading: pick(kit.fonts.heading, incoming.fonts.heading, (v) => !v),
      body: pick(kit.fonts.body, incoming.fonts.body, (v) => !v),
    },
    guidelines: kit.guidelines,
    identity,
  };
  return changed ? result : null;
}

function colorFor(kit: BrandKit, role: BrandColorRole): string | undefined {
  return kit.colors.find((c) => c.role === role)?.hex;
}

/**
 * Serve a kit in the BrandSnapshot shape existing pages read. Legacy-only
 * fields (product images, market summary…) come from the old guideline when
 * it is for the same brand; kit values always win.
 */
export function kitToSnapshot(kit: BrandKit, legacy?: Partial<BrandSnapshot> | null): BrandSnapshot {
  const base = legacy && sameBrandName(legacy.name, kit.name) ? legacy : {};
  const id = kit.identity;
  const byRole = BRAND_COLOR_ROLES.flatMap((r) => kit.colors.filter((c) => c.role === r).map((c) => c.hex));
  const or = <T,>(kitValue: T | null | undefined, legacyValue: T | undefined): T | undefined =>
    kitValue !== undefined && kitValue !== null && !(typeof kitValue === "string" && !kitValue) && !(Array.isArray(kitValue) && !kitValue.length)
      ? kitValue
      : legacyValue;

  return {
    ...(base as BrandSnapshot),
    name: kit.name,
    description: or(id.description, base.description) || "",
    business_overview: or(id.description, base.business_overview),
    audience: or(id.audience, base.audience) || "",
    offering: or(id.offering, base.offering) || "",
    tone: or(id.tone, base.tone) || "",
    personality: or(id.tone, base.personality),
    tagline: or(id.tagline, base.tagline),
    industry: or(id.industry, base.industry),
    coreValueProp: or(id.valueProposition, base.coreValueProp),
    brand_values: or(id.values, base.brand_values),
    brandVoice: or(id.brandVoice, base.brandVoice),
    productCategory: or(id.productCategory, base.productCategory),
    pricePositioning: or(id.pricePositioning, base.pricePositioning),
    brand_aesthetic: or(id.aesthetic, base.brand_aesthetic),
    ctaPatterns: or(id.ctaPatterns, base.ctaPatterns),
    website_url: or(kit.websiteUrl, base.website_url),
    logo: or(kit.logo?.url, base.logo),
    logoUrl: or(kit.logo?.url, base.logoUrl),
    primaryColors: byRole.length ? byRole : base.primaryColors,
    colors: kit.colors.length
      ? {
          primary: colorFor(kit, "primary"),
          secondary: colorFor(kit, "secondary"),
          accent: colorFor(kit, "accent"),
          neutral: colorFor(kit, "background"),
        }
      : base.colors,
    primaryFont: or(kit.fonts.heading?.family, base.primaryFont),
    fontStyles: base.fontStyles,
  };
}
