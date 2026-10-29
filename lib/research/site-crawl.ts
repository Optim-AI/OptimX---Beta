/**
 * First-party evidence from a brand's own website.
 *
 * Reads the homepage plus a handful of the pages a marketer would open first
 * (about, a collection, a product, pricing, reviews, FAQ) and pulls out what
 * can be checked: structured data (JSON-LD), prices, ratings, testimonials,
 * guarantees, social links and the store catalogue when it is Shopify.
 * Server-only. Never throws for a page after the homepage.
 */

import { JSDOM } from "jsdom";
import { safeFetchText } from "@/lib/audit/url-safety";

export const PAGE_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export type PageKind = "home" | "about" | "collection" | "product" | "pricing" | "reviews" | "faq" | "other";

export type CrawledPage = {
  url: string;
  kind: PageKind;
  title: string;
  description: string;
  headings: string[];
  text: string;
};

export type SiteProduct = {
  name: string;
  price?: number;
  currency?: string;
  type?: string;
  url?: string;
  rating?: number;
  reviewCount?: number;
};

export type SiteEvidence = {
  url: string;
  origin: string;
  domain: string;
  platform: "shopify" | "woocommerce" | "other";
  pages: CrawledPage[];
  products: SiteProduct[];
  priceRange: { min: number; max: number; median: number; currency?: string; count: number } | null;
  ratings: Array<{ value: number; count?: number; source: string }>;
  testimonials: string[];
  trustSignals: string[];
  offers: string[];
  socialLinks: Record<string, string>;
  navLabels: string[];
  ctas: string[];
  /** Raw homepage document for callers that read visual/brand signals. */
  homeHtml: string;
};

const PAGE_TEXT_LIMIT = 3500;
const MAX_EXTRA_PAGES = 5;

const KIND_PATTERNS: Array<[PageKind, RegExp]> = [
  ["about", /\/(pages\/)?(about|about-us|our-story|story|who-we-are|mission)\b/i],
  ["pricing", /\/(pricing|plans|price)\b/i],
  ["reviews", /\/(pages\/)?(reviews?|testimonials?|customer-stories|wall-of-love)\b/i],
  ["faq", /\/(pages\/)?(faqs?|help|frequently-asked)\b/i],
  ["product", /\/products?\/[^/?#]+/i],
  ["collection", /\/(collections|shop|category|categories|store)(\/|$)/i],
];

function kindFor(path: string): PageKind {
  for (const [kind, re] of KIND_PATTERNS) if (re.test(path)) return kind;
  return "other";
}

function clean(s: string | null | undefined): string {
  return (s || "").replace(/\s+/g, " ").trim();
}

/** SSRF-safe fetch (public addresses only, size-capped). Null on any failure. */
async function fetchHtml(url: string, timeoutMs: number): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await safeFetchText(url, { timeoutMs, userAgent: PAGE_FETCH_HEADERS["User-Agent"] });
    if (res.status < 200 || res.status >= 300) return null;
    return { html: res.body, finalUrl: res.url || url };
  } catch {
    return null;
  }
}

function visibleText(doc: Document): string {
  doc.querySelectorAll("script, style, noscript, svg, iframe, template").forEach((el) => el.remove());
  const main = doc.querySelector("main, [role='main'], article") || doc.body;
  return clean(main?.textContent).slice(0, PAGE_TEXT_LIMIT);
}

function jsonLdBlocks(doc: Document): any[] {
  const out: any[] = [];
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      const parsed = JSON.parse(el.textContent || "");
      const items = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ? parsed["@graph"] : [parsed];
      out.push(...items.filter(Boolean));
    } catch {
      /* malformed JSON-LD is common */
    }
  });
  return out;
}

function typeOf(node: any): string[] {
  const t = node?.["@type"];
  return (Array.isArray(t) ? t : [t]).filter(Boolean).map((x: string) => String(x).toLowerCase());
}

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function productsFromJsonLd(nodes: any[], pageUrl: string): SiteProduct[] {
  const products: SiteProduct[] = [];
  for (const node of nodes) {
    if (!typeOf(node).includes("product")) continue;
    const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
    const price = num(offers?.price ?? offers?.lowPrice);
    products.push({
      name: clean(node.name),
      price,
      currency: offers?.priceCurrency,
      url: pageUrl,
      rating: num(node.aggregateRating?.ratingValue),
      reviewCount: num(node.aggregateRating?.reviewCount ?? node.aggregateRating?.ratingCount),
    });
  }
  return products.filter((p) => p.name);
}

const TRUST_RE =
  /\b(free (shipping|delivery|returns?)|money[- ]back|guarantee[d]?|\d+[- ]day (returns?|trial)|cash on delivery|cod available|certified|clinically (tested|proven)|dermatologist|lab[- ]tested|fssai|iso \d+|award|as seen (in|on)|trusted by [\d,.]+|[\d,.]+\+? (happy )?customers|[\d.]+\s?(★|stars?)|rated [\d.]+|cruelty[- ]free|vegan|organic|made in india|no (added )?sugar|preservative[- ]free)\b[^.!?\n]{0,60}/gi;
const OFFER_RE =
  /\b(\d{1,2}% off|flat [₹$€£]?\s?\d+ off|buy \d+ get \d+|bogo|use code [A-Z0-9]+|free gift|sale ends|limited time|subscribe (&|and) save)\b[^.!?\n]{0,50}/gi;

function collectMatches(text: string, re: RegExp, limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    const v = clean(m[0]);
    const k = v.toLowerCase();
    if (v.length < 6 || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

function testimonialsFrom(doc: Document): string[] {
  const nodes = doc.querySelectorAll(
    "blockquote, [class*='testimonial' i], [class*='review-content' i], [class*='review__body' i], [class*='review-body' i], [itemprop='reviewBody']"
  );
  const out: string[] = [];
  nodes.forEach((n) => {
    const t = clean(n.textContent);
    if (t.length >= 40 && t.length <= 400 && !out.includes(t)) out.push(t);
  });
  return out.slice(0, 8);
}

const SOCIAL_HOSTS: Record<string, RegExp> = {
  instagram: /instagram\.com\//i,
  facebook: /facebook\.com\//i,
  youtube: /youtube\.com\//i,
  linkedin: /linkedin\.com\//i,
  x: /(twitter|x)\.com\//i,
  tiktok: /tiktok\.com\//i,
  amazon: /amazon\.[a-z.]+\//i,
};

function priceRangeOf(products: SiteProduct[]): SiteEvidence["priceRange"] {
  const prices = products.map((p) => p.price).filter((p): p is number => typeof p === "number").sort((a, b) => a - b);
  if (!prices.length) return null;
  return {
    min: prices[0],
    max: prices[prices.length - 1],
    median: prices[Math.floor(prices.length / 2)],
    currency: products.find((p) => p.currency)?.currency,
    count: prices.length,
  };
}

async function shopifyCatalog(origin: string): Promise<SiteProduct[]> {
  try {
    const res = await safeFetchText(`${origin}/products.json?limit=60`, {
      timeoutMs: 8000,
      accept: /json/i,
      userAgent: PAGE_FETCH_HEADERS["User-Agent"],
    });
    if (res.status !== 200 || res.truncated) return [];
    const data = JSON.parse(res.body) as any;
    return (data?.products || []).slice(0, 60).map((p: any) => ({
      name: clean(p.title),
      price: num(p.variants?.[0]?.price),
      type: clean(p.product_type) || undefined,
      url: `${origin}/products/${p.handle}`,
    }));
  } catch {
    return [];
  }
}

function pickExtraPages(doc: Document, base: URL): Array<{ url: string; kind: PageKind }> {
  const byKind = new Map<PageKind, string>();
  const anchors = Array.from(doc.querySelectorAll("a[href]")) as HTMLAnchorElement[];
  for (const a of anchors) {
    let u: URL;
    try {
      u = new URL(a.getAttribute("href") || "", base);
    } catch {
      continue;
    }
    if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    if (/\.(jpg|png|pdf|webp|svg|zip)$/i.test(u.pathname) || u.pathname === "/" || /\/(cart|account|login|search)/i.test(u.pathname)) continue;
    const kind = kindFor(u.pathname);
    if (kind === "other" || byKind.has(kind)) continue;
    u.hash = "";
    u.search = "";
    byKind.set(kind, u.toString());
  }
  const order: PageKind[] = ["about", "product", "collection", "pricing", "reviews", "faq"];
  return order
    .filter((k) => byKind.has(k))
    .slice(0, MAX_EXTRA_PAGES)
    .map((kind) => ({ kind, url: byKind.get(kind)! }));
}

function readPage(html: string, url: string, kind: PageKind) {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const ld = jsonLdBlocks(doc);
  const headings = Array.from(doc.querySelectorAll("h1, h2"))
    .map((h) => clean(h.textContent))
    .filter((h) => h.length > 2 && h.length < 120)
    .slice(0, 12);
  const page: CrawledPage = {
    url,
    kind,
    title: clean(doc.querySelector("title")?.textContent),
    description:
      clean(doc.querySelector('meta[name="description"]')?.getAttribute("content")) ||
      clean(doc.querySelector('meta[property="og:description"]')?.getAttribute("content")),
    headings,
    text: "",
  };
  const testimonials = testimonialsFrom(doc);
  const links = Array.from(doc.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") || "");
  const nav = Array.from(doc.querySelectorAll("header a, nav a"))
    .map((a) => clean(a.textContent))
    .filter((t) => t.length > 1 && t.length < 30);
  const ctas = Array.from(doc.querySelectorAll("a, button"))
    .map((el) => clean(el.textContent))
    .filter((t) => t.length > 1 && t.length < 40 && /^(shop|buy|get|try|order|start|book|subscribe|add to|claim|explore|discover|join)/i.test(t));
  page.text = visibleText(doc);
  return { page, ld, testimonials, links, nav, ctas };
}

export async function crawlSite(inputUrl: string, opts: { timeoutMs?: number } = {}): Promise<SiteEvidence> {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const home = await fetchHtml(inputUrl, timeoutMs);
  if (!home) throw new Error("Could not open the website");
  const base = new URL(home.finalUrl);
  const homeRead = readPage(home.html, base.toString(), "home");
  const homeDom = new JSDOM(home.html, { url: base.toString() });
  const extra = pickExtraPages(homeDom.window.document, base);
  const platform: SiteEvidence["platform"] = /cdn\.shopify\.com|Shopify\.theme/i.test(home.html)
    ? "shopify"
    : /wp-content\/plugins\/woocommerce/i.test(home.html)
      ? "woocommerce"
      : "other";

  const [extraReads, catalog] = await Promise.all([
    Promise.all(
      extra.map(async (p) => {
        const got = await fetchHtml(p.url, 8000);
        return got ? readPage(got.html, got.finalUrl, p.kind) : null;
      })
    ),
    // Headless Shopify stores hide the theme markers but still serve the catalogue.
    platform === "woocommerce" ? Promise.resolve([] as SiteProduct[]) : shopifyCatalog(base.origin),
  ]);

  const reads = [homeRead, ...extraReads.filter(Boolean)] as Array<ReturnType<typeof readPage>>;
  const allText = reads.map((r) => `${r.page.headings.join(". ")} ${r.page.text}`).join("\n");

  const ldProducts = reads.flatMap((r) => productsFromJsonLd(r.ld, r.page.url));
  const products = catalog.length ? catalog : ldProducts;
  const ratings: SiteEvidence["ratings"] = [];
  for (const p of ldProducts) {
    if (p.rating) ratings.push({ value: p.rating, count: p.reviewCount, source: p.name });
  }
  for (const r of reads) {
    for (const node of r.ld) {
      const agg = node?.aggregateRating;
      if (agg && !typeOf(node).includes("product")) {
        const value = num(agg.ratingValue);
        if (value) ratings.push({ value, count: num(agg.reviewCount ?? agg.ratingCount), source: clean(node.name) || "site" });
      }
    }
  }

  const socialLinks: Record<string, string> = {};
  for (const href of reads.flatMap((r) => r.links)) {
    for (const [name, re] of Object.entries(SOCIAL_HOSTS)) {
      if (!socialLinks[name] && re.test(href) && !/share|sharer|intent/i.test(href)) socialLinks[name] = href;
    }
  }

  return {
    url: base.toString(),
    origin: base.origin,
    domain: base.hostname.replace(/^www\./, ""),
    platform: catalog.length ? "shopify" : platform,
    pages: reads.map((r) => r.page),
    products: products.slice(0, 60),
    priceRange: priceRangeOf(products.length ? products : ldProducts),
    ratings: ratings.slice(0, 10),
    testimonials: [...new Set(reads.flatMap((r) => r.testimonials))].slice(0, 8),
    trustSignals: collectMatches(allText, TRUST_RE, 12),
    offers: collectMatches(allText, OFFER_RE, 6),
    socialLinks,
    navLabels: [...new Set(homeRead.nav)].slice(0, 20),
    ctas: [...new Set(reads.flatMap((r) => r.ctas))].slice(0, 10),
    homeHtml: home.html,
  };
}

/** Compact, model-friendly summary of the evidence (keeps prompts small). */
export function formatSiteEvidence(e: SiteEvidence): string {
  const lines: string[] = [];
  lines.push(`Website: ${e.url} (platform: ${e.platform})`);
  if (e.navLabels.length) lines.push(`Navigation: ${e.navLabels.join(" | ")}`);
  if (e.priceRange) {
    const c = e.priceRange.currency || "";
    lines.push(
      `Prices seen (${e.priceRange.count} products): ${c}${e.priceRange.min} – ${c}${e.priceRange.max}, median ${c}${e.priceRange.median}`
    );
  }
  if (e.products.length) {
    lines.push(
      `Products: ${e.products
        .slice(0, 25)
        .map((p) => `${p.name}${p.price ? ` (${p.currency || ""}${p.price})` : ""}${p.type ? ` [${p.type}]` : ""}`)
        .join("; ")}`
    );
  }
  if (e.ratings.length) {
    lines.push(`Ratings on site: ${e.ratings.map((r) => `${r.value}${r.count ? ` from ${r.count} reviews` : ""} (${r.source})`).join("; ")}`);
  }
  if (e.trustSignals.length) lines.push(`Trust signals on site: ${e.trustSignals.join(" | ")}`);
  if (e.offers.length) lines.push(`Offers on site: ${e.offers.join(" | ")}`);
  if (e.testimonials.length) lines.push(`Testimonials on site:\n- ${e.testimonials.slice(0, 5).join("\n- ")}`);
  if (e.ctas.length) lines.push(`CTAs used: ${e.ctas.join(" | ")}`);
  if (Object.keys(e.socialLinks).length) lines.push(`Social: ${Object.keys(e.socialLinks).join(", ")}`);
  for (const p of e.pages) {
    lines.push(
      `\n--- PAGE (${p.kind}) ${p.url}\nTitle: ${p.title}\nMeta: ${p.description}\nHeadings: ${p.headings.join(" | ")}\nText: ${p.text.slice(0, p.kind === "home" ? 3500 : 2000)}`
    );
  }
  return lines.join("\n");
}
