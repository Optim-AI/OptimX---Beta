/**
 * Canonical site SEO constants for SkalX AI.
 * Use https://skalxai.app everywhere — do not invent alternate domains.
 */

/** Hostname only — non-www is the canonical host for SkalX AI. */
export const CANONICAL_HOST = "skalxai.app";
export const WWW_HOST = `www.${CANONICAL_HOST}`;

export const SITE_ORIGIN = `https://${CANONICAL_HOST}`;
export const SITE_NAME = "SkalX AI";
export const SITE_TAGLINE = "Your AI Marketing Partner";

export const DEFAULT_TITLE =
  "SkalX AI — AI Marketing Platform for Ad Creatives, Posters & Video Ads";

export const DEFAULT_DESCRIPTION =
  "SkalX AI is an AI-powered marketing platform that understands your brand and generates campaign-ready ad creatives, posters, and short marketing videos so teams launch faster.";

/** Absolute asset used in Open Graph / Organization schema (existing public logo). */
export const SITE_LOGO_URL = `${SITE_ORIGIN}/images/SkalX_Logo.png`;
export const SITE_OG_IMAGE_URL = `${SITE_ORIGIN}/icon-512.png`;

/** Public support email for SkalX AI (marketing/contact surfaces). */
export const SITE_SUPPORT_EMAIL = "info@skalxai.app";

/**
 * Verified official profiles for Organization JSON-LD sameAs.
 * Legacy OptimX Instagram/LinkedIn URLs removed — no repo evidence they are
 * official SkalX accounts. Add SkalX-branded URLs here after confirmation.
 */
export const SITE_SAME_AS = [
  "https://www.facebook.com/share/1BNxZDcfRe/?mibextid=wwXIfr",
] as const;

/** Public marketing / legal routes that should be indexed (Pages Router paths). */
export const INDEXABLE_PATHS = [
  "/",
  "/ai-ad-generator",
  "/About",
  "/Contact",
  "/Careers",
  "/help-center",
  "/community",
  "/privacy-policy",
  "/terms-and-conditions",
  "/cpolicy",
  "/ai-disclosure",
  "/data-handling-security",
] as const;

/**
 * Path prefixes / exact paths that must not be indexed
 * (auth, product app, billing, admin, experiments).
 */
export const NOINDEX_PATH_PREFIXES = [
  "/auth",
  "/admin",
  "/api",
  "/dashboard",
  "/settings",
  "/welcome",
  "/try",
  "/login",
  "/subscribe",
  "/buy-credits",
  "/content-studio",
  "/creative-studio",
  "/creative-intelligence",
  "/brand-studio",
  "/create-campaign",
  "/analytics",
  "/image-library",
  "/library",
  "/integrations",
  "/notifications",
  "/onboardingInfo",
  "/publish",
  "/report",
  "/test-billing",
  "/api-Docs",
  "/tutorials",
  "/insights",
  "/roadmap",
  "/integrationsGoogle",
  "/integrationsInstagram",
  "/integrationsbeta",
  "/integrationsnew",
] as const;

/** Self-referencing absolute URL on the canonical non-www origin (homepage includes trailing slash). */
export function absoluteUrl(path: string): string {
  if (!path || path === "/") return `${SITE_ORIGIN}/`;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${normalized}`;
}

export function shouldNoIndexPath(pathname: string | undefined | null): boolean {
  if (!pathname) return false;
  const path = pathname.split("?")[0] || "/";
  return NOINDEX_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );
}

export function buildPageTitle(pageTitle?: string): string {
  if (!pageTitle) return DEFAULT_TITLE;
  if (pageTitle.includes(SITE_NAME)) return pageTitle;
  return `${pageTitle} | ${SITE_NAME}`;
}
