// pages/api/content-studio/scan.ts
// Website scanning: full-site crawl with Playwright, extract products, brand intelligence

import type { NextApiRequest, NextApiResponse } from "next";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { getUserIdFromRequest } from "@/auth/request";
import { ContentStudioScanDAO } from "@/database/models/ContentStudioScan.dao";
import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
// Playwright is dynamically imported to avoid webpack bundling issues
// when the package isn't installed (falls back to fetch+JSDOM)

type RawScannedProduct = {
  product_name: string;
  price: string | null;
  description: string;
  images: string[];
  url: string;
  benefits?: string[];
};

type StructuredProduct = {
  product_name: string;
  price: string | null;
  description: string;
  key_benefits: string[];
  product_images: string[];
  target_audience: string;
  emotional_angles: string[];
  use_cases: string[];
  short_benefit: string;
};

const MAX_CATEGORY_PAGES = 20;
const MAX_PRODUCTS = 300;
const MAX_PRODUCT_PAGES_TO_SCRAPE = 150;
const PAGE_LOAD_TIMEOUT = 15000;
const SCROLL_PAUSE = 1500;
const SCROLL_ATTEMPTS = 20; // Extended to discover more products on infinite-scroll pages

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toAbsolute(base: string, src: string): string {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.searchParams.sort();
    return u.toString();
  } catch {
    return url;
  }
}

/** Strip variant/color/size params for deduplication - keeps base product URL only */
function normalizeProductUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const variantParams = ["variant", "color", "size", "sku", "option"];
    for (const p of variantParams) {
      u.searchParams.delete(p);
    }
    u.searchParams.sort();
    return u.toString();
  } catch {
    return url;
  }
}

function mapRawProductsToStructured(rawProducts: RawScannedProduct[]): StructuredProduct[] {
  return rawProducts
    .filter((p) => p.product_name?.trim())
    .map((p) => ({
      product_name: p.product_name.trim(),
      price: p.price,
      description: p.description?.trim() || "",
      key_benefits: p.benefits || [],
      product_images: p.images || [],
      target_audience: "",
      emotional_angles: [] as string[],
      use_cases: [] as string[],
      short_benefit: (p.description || p.product_name).trim().slice(0, 80),
    }));
}

function extractBrandHeuristic(
  title: string,
  metaDesc: string,
  pageUrl: string
): Record<string, string> {
  let hostname = "";
  try {
    hostname = new URL(pageUrl).hostname.replace(/^www\./, "");
  } catch {
    hostname = "";
  }
  const brandFromTitle = title.split(/[|\-–—]/)[0]?.trim() || "";
  return {
    brand_name: brandFromTitle || hostname || "Unknown",
    brand_tone: "",
    industry: "",
    target_audience: "",
    primary_value_proposition: metaDesc.trim(),
  };
}

async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    throw new Error(
      "GEMINI_API_KEY, GEMINI_VEO_API_KEY, or NANO_API_KEY not configured"
    );
  }
  const res = await fetchWithGeminiRateLimitRetry(
    `${GEMINI_REST_BASE}/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    }
  );
  if (!res.ok) {
    const errBody = await res.text();
    let errMsg = `Gemini API error: ${res.status}`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed?.error?.message) errMsg = parsed.error.message;
    } catch {
      if (errBody) errMsg += ` - ${errBody.slice(0, 200)}`;
    }
    throw new Error(errMsg);
  }
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

const CATEGORY_PATH_PATTERNS = [
  // Existing patterns (do not remove)
  /\/shop/i,
  /\/products?/i,
  /\/collections?/i,
  /\/store/i,
  /\/category/i,
  /\/catalog/i,
  /\/buy/i,
  /\/all-products?/i,
  /\/body/i,
  /\/face/i,
  /\/hair/i,
  /\/makeup/i,
  /\/fragrance/i,
  /\/skincare/i,
  /\/bath/i,
  // Additional category path patterns
  /\/categories/i,
  /\/shop-all/i,
  /\/shop-all-products/i,
  /\/all\b/i,
  /\/browse/i,
  /\/items/i,
  /\/collection\b/i,
  /\/our-products/i,
  /\/product-range/i,
  /\/new\b/i,
  /\/new-arrivals/i,
  /\/new-launch/i,
  /\/new-launches/i,
  /\/featured/i,
  /\/featured-products/i,
  /\/bestsellers/i,
  /\/best-sellers/i,
  /\/top-products/i,
  /\/trending/i,
  /\/sale\b/i,
  /\/offers/i,
  // Clothing and apparel
  /\/men\b/i,
  /\/women/i,
  /\/kids\b/i,
  /\/apparel/i,
  /\/clothing/i,
  /\/shoes/i,
  /\/accessories/i,
  // Food and beverage
  /\/snacks/i,
  /\/protein-bars/i,
  /\/muesli/i,
  /\/granola/i,
  /\/beverages/i,
  // Beauty and skincare (additional)
  /\/haircare/i,
  /\/bodycare/i,
  // Fitness and gym
  /\/equipment/i,
  /\/gym-accessories/i,
  /\/workout-gear/i,
  /\/fitness\b/i,
];

const PRODUCT_PATH_PATTERNS = [
  /\/product\//i,
  /\/products\//i,
  /\/p\//i,
  /\/item\//i,
  /\/dp\//i,
  /\/gp\/product\//i,
  /product-/i,
  /-p-\d+/i,
  // Hyphenated slugs: /british-rose-shower-gel, /tea-tree-facial-wash (Body Shop, many Shopify stores)
  /\/[a-z0-9]+(-[a-z0-9]+)+(\/|$)/i,
];

/** Product-related CSS class substrings for link discovery */
const PRODUCT_CLASS_PATTERNS = [
  "product-card",
  "product-item",
  "product-grid",
  "product-tile",
  "product-wrapper",
  "product-list",
];

const NON_PRODUCT_PATH_SEGMENTS = new Set([
  "cart", "checkout", "account", "login", "register", "search", "wishlist",
  "contact", "about", "faq", "help", "terms", "privacy", "blog", "news",
  "learn", "articles", "article", "magazine", "journal", "resources",
]);

/** Path patterns that indicate non-product content (blog, learn, editorial) */
const NON_PRODUCT_PATH_PATTERNS = [
  /\/learn\//i,
  /\/blog\//i,
  /\/news\//i,
  /\/article/i,
  /\/articles\//i,
  /\/editorial/i,
  /\/resources\//i,
  /\/truth-be-told\//i,
  /\/twt-chemx\//i,
];

function isCategoryPage(path: string): boolean {
  return CATEGORY_PATH_PATTERNS.some((p) => p.test(path));
}

function isProductPage(path: string): boolean {
  // Exclude blog, learn, editorial, and other non-product content first
  if (NON_PRODUCT_PATH_PATTERNS.some((p) => p.test(path))) return false;
  const segments = path.split("/").filter(Boolean);
  if (segments.some((s) => NON_PRODUCT_PATH_SEGMENTS.has(s.toLowerCase()))) return false;

  if (PRODUCT_PATH_PATTERNS.some((p) => p.test(path))) return true;
  // Heuristic: path depth > 1, contains hyphen, not a known non-product path
  if (segments.length < 2) return false;
  const lastSegment = segments[segments.length - 1] || "";
  return lastSegment.includes("-");
}

/** Path has depth <= 2 (e.g. /body, /face, /hair) - treat as potential category */
function isShallowTopLevelPath(path: string): boolean {
  const segments = path.split("/").filter(Boolean);
  return segments.length >= 1 && segments.length <= 2;
}

type CrawlResult = {
  productUrls: Set<string>;
  categoryUrls: Set<string>;
  homepageHtml: string;
};

async function crawlWithPlaywright(
  baseUrl: string,
  baseOrigin: string
): Promise<CrawlResult> {
  const productUrls = new Set<string>();
  const categoryUrls = new Set<string>();
  let homepageHtml = "";

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { chromium } = require("playwright") as { chromium: any };
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (compatible; OptimX-ContentStudio/1.0)",
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(PAGE_LOAD_TIMEOUT);

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    homepageHtml = await page.content();

    const allLinks = await page.evaluate((origin) => {
      const anchors = document.querySelectorAll("a[href]");
      const links: string[] = [];
      for (const a of anchors) {
        const href = (a as HTMLAnchorElement).href;
        if (href && href.startsWith(origin) && !href.includes("#")) {
          try {
            const u = new URL(href);
            u.hash = "";
            links.push(u.toString());
          } catch {
            /* skip */
          }
        }
      }
      return [...new Set(links)];
    }, baseOrigin);

    const baseHost = new URL(baseOrigin).hostname;
    for (const link of allLinks) {
      try {
        const linkUrl = new URL(link);
        if (linkUrl.hostname !== baseHost) continue;
        const path = linkUrl.pathname;
        const pathForSearch = path + linkUrl.search;
        if (isProductPage(path)) {
          productUrls.add(normalizeProductUrl(normalizeUrl(link)));
        } else if (isCategoryPage(pathForSearch)) {
          categoryUrls.add(normalizeUrl(link));
        } else if (isShallowTopLevelPath(path)) {
          // Top-level links like /body, /face, /hair - crawl as categories
          categoryUrls.add(normalizeUrl(link));
        }
      } catch {
        /* skip */
      }
    }

    const categoryList = [...categoryUrls].slice(0, MAX_CATEGORY_PAGES);

    for (const catUrl of categoryList) {
      if (productUrls.size >= MAX_PRODUCTS) break;
      try {
        await page.goto(catUrl, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle").catch(() => {});

        let prevCount = productUrls.size;
        let scrollAttempts = 0;
        let totalNavigations = 0;
        let consecutiveEmptyPages = 0;
        let lastIterationWasNavigation = false;
        const MAX_TOTAL_NAVIGATIONS = 30;
        const MAX_CONSECUTIVE_EMPTY_PAGES = 2;

        while (
          scrollAttempts < SCROLL_ATTEMPTS &&
          totalNavigations < MAX_TOTAL_NAVIGATIONS &&
          consecutiveEmptyPages < MAX_CONSECUTIVE_EMPTY_PAGES
        ) {
          const found = await page.evaluate(
            ({ origin, productClassPatterns }: { origin: string; productClassPatterns: string[] }) => {
              const links = new Set<string>();
              const anchors = document.querySelectorAll("a[href]");

              const hasProductClass = (el: Element) => {
                const cls = (el.className && String(el.className)) || "";
                return productClassPatterns.some((p) => cls.toLowerCase().includes(p));
              };
              const insideProductContainer = (el: Element) => {
                let parent: Element | null = el.parentElement;
                while (parent) {
                  if (hasProductClass(parent)) return true;
                  parent = parent.parentElement;
                }
                return false;
              };

              for (const a of anchors) {
                const href = (a as HTMLAnchorElement).href;
                if (!href || !href.startsWith(origin) || href.includes("#")) continue;
                try {
                  const u = new URL(href);
                  const path = u.pathname;
                  const segments = path.split("/").filter(Boolean);
                  u.hash = "";

                  // Existing: hyphenated product slug
                  if (segments.length >= 2) {
                    const lastSegment = segments[segments.length - 1] || "";
                    if (lastSegment.includes("-")) {
                      links.add(u.toString());
                      continue;
                    }
                  }

                  // Additional: inside product-related class container
                  if (hasProductClass(a) || insideProductContainer(a)) {
                    links.add(u.toString());
                    continue;
                  }
                  // Additional: inside schema.org Product
                  if (a.closest('[itemtype*="Product"]')) {
                    links.add(u.toString());
                    continue;
                  }
                  // Additional: data-product attributes on link or ancestor
                  if (
                    a.hasAttribute("data-product-id") ||
                    a.hasAttribute("data-product-handle") ||
                    a.hasAttribute("data-product") ||
                    a.closest("[data-product-id], [data-product-handle], [data-product]")
                  ) {
                    links.add(u.toString());
                  }
                } catch {
                  /* skip */
                }
              }
              return [...links];
            },
            { origin: baseOrigin, productClassPatterns: PRODUCT_CLASS_PATTERNS }
          );

          for (const link of found) {
            const path = new URL(link).pathname;
            if (isProductPage(path)) productUrls.add(normalizeProductUrl(normalizeUrl(link)));
          }

          const newCount = productUrls.size;
          if (lastIterationWasNavigation && newCount === prevCount) {
            consecutiveEmptyPages++;
          } else if (newCount > prevCount) {
            consecutiveEmptyPages = 0;
          }
          lastIterationWasNavigation = false;

          const nextBtn = await page.$(
            'a[href*="page="], a[rel="next"], [aria-label*="next" i], .pagination a, .next-page, [class*="next"]'
          );
          if (nextBtn) {
            totalNavigations++;
            lastIterationWasNavigation = true;
            await nextBtn.click().catch(() => {});
            await delay(SCROLL_PAUSE);
            scrollAttempts = 0;
            continue;
          }

          const currentPageUrl = page.url();
          const nextPageLink = await page.$('a[href*="page="], a[rel="next"], [aria-label*="next" i]');
          if (nextPageLink) {
            const href = await nextPageLink.getAttribute("href");
            if (href) {
              totalNavigations++;
              lastIterationWasNavigation = true;
              const nextUrl = toAbsolute(currentPageUrl, href);
              await page.goto(nextUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
              await delay(SCROLL_PAUSE);
              scrollAttempts = 0;
              continue;
            }
          }

          const urlObj = new URL(currentPageUrl);
          const pageNum = parseInt(urlObj.searchParams.get("page") || "1", 10);
          urlObj.searchParams.set("page", String(pageNum + 1));
          const nextPageUrl = urlObj.toString();
          if (pageNum <= 5) {
            totalNavigations++;
            lastIterationWasNavigation = true;
            await page.goto(nextPageUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
            await delay(SCROLL_PAUSE);
            const found = await page.evaluate(
              ({ origin, productClassPatterns }: { origin: string; productClassPatterns: string[] }) => {
                const links = new Set<string>();
                const anchors = document.querySelectorAll("a[href]");
                const hasProductClass = (el: Element) => {
                  const cls = (el.className && String(el.className)) || "";
                  return productClassPatterns.some((p) => cls.toLowerCase().includes(p));
                };
                const insideProductContainer = (el: Element) => {
                  let parent: Element | null = el.parentElement;
                  while (parent) {
                    if (hasProductClass(parent)) return true;
                    parent = parent.parentElement;
                  }
                  return false;
                };
                for (const a of anchors) {
                  const href = (a as HTMLAnchorElement).href;
                  if (!href || !href.startsWith(origin) || href.includes("#")) continue;
                  try {
                    const u = new URL(href);
                    const path = u.pathname;
                    const segments = path.split("/").filter(Boolean);
                    u.hash = "";
                    if (segments.length >= 2) {
                      const lastSegment = segments[segments.length - 1] || "";
                      if (lastSegment.includes("-")) links.add(u.toString());
                    }
                    if (hasProductClass(a) || insideProductContainer(a)) links.add(u.toString());
                    if (a.closest('[itemtype*="Product"]')) links.add(u.toString());
                    if (
                      a.hasAttribute("data-product-id") ||
                      a.hasAttribute("data-product-handle") ||
                      a.hasAttribute("data-product") ||
                      a.closest("[data-product-id], [data-product-handle], [data-product]")
                    )
                      links.add(u.toString());
                  } catch {
                    /* skip */
                  }
                }
                return [...links];
              },
              { origin: baseOrigin, productClassPatterns: PRODUCT_CLASS_PATTERNS }
            );
            for (const link of found) {
              const path = new URL(link).pathname;
              if (isProductPage(path)) productUrls.add(normalizeProductUrl(normalizeUrl(link)));
            }
            if (productUrls.size > prevCount) scrollAttempts = 0;
            prevCount = productUrls.size;
            continue;
          }

          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await delay(SCROLL_PAUSE);

          const countAfterScroll = productUrls.size;
          if (countAfterScroll === prevCount) scrollAttempts++;
          else scrollAttempts = 0;
          prevCount = countAfterScroll;
        }
      } catch (e) {
        console.warn("[Ad Studio] Category page failed:", catUrl, e);
      }
    }

    // Fail-safe: when no category pages detected or no products found, scan all internal links
    if (categoryUrls.size === 0 || productUrls.size === 0) {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
      const failSafeLinks = await page.evaluate(
        ({ origin, productClassPatterns }: { origin: string; productClassPatterns: string[] }) => {
          const links = new Set<string>();
          const anchors = document.querySelectorAll("a[href]");
          const hasProductClass = (el: Element) => {
            const cls = (el.className && String(el.className)) || "";
            return productClassPatterns.some((p) => cls.toLowerCase().includes(p));
          };
          const insideProductContainer = (el: Element) => {
            let parent: Element | null = el.parentElement;
            while (parent) {
              if (hasProductClass(parent)) return true;
              parent = parent.parentElement;
            }
            return false;
          };
          for (const a of anchors) {
            const href = (a as HTMLAnchorElement).href;
            if (!href || !href.startsWith(origin) || href.includes("#")) continue;
            try {
              const u = new URL(href);
              u.hash = "";
              const path = u.pathname;
              const segments = path.split("/").filter(Boolean);
              if (segments.length >= 2) {
                const lastSegment = segments[segments.length - 1] || "";
                if (lastSegment.includes("-")) links.add(u.toString());
              }
              if (hasProductClass(a) || insideProductContainer(a)) links.add(u.toString());
              if (a.closest('[itemtype*="Product"]')) links.add(u.toString());
              if (
                a.hasAttribute("data-product-id") ||
                a.hasAttribute("data-product-handle") ||
                a.hasAttribute("data-product") ||
                a.closest("[data-product-id], [data-product-handle], [data-product]")
              )
                links.add(u.toString());
            } catch {
              /* skip */
            }
          }
          return [...links];
        },
        { origin: baseOrigin, productClassPatterns: PRODUCT_CLASS_PATTERNS }
      );
      for (const link of failSafeLinks) {
        try {
          const path = new URL(link).pathname;
          if (isProductPage(path)) productUrls.add(normalizeProductUrl(normalizeUrl(link)));
        } catch {
          /* skip */
        }
      }
    }

    if (productUrls.size === 0) {
      for (const link of allLinks) {
        try {
          const path = new URL(link).pathname;
          if (isProductPage(path)) productUrls.add(normalizeProductUrl(normalizeUrl(link)));
        } catch {
          /* skip */
        }
      }
    }
  } finally {
    await browser.close();
  }

  return { productUrls, categoryUrls, homepageHtml };
}

function extractProductFromHtml(html: string, url: string): {
  product_name: string;
  price: string | null;
  description: string;
  images: string[];
  url: string;
  benefits?: string[];
} {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
    doc.querySelector("title")?.textContent ||
    doc.querySelector("h1")?.textContent ||
    "";

  const desc =
    doc.querySelector('meta[property="og:description"]')?.getAttribute("content") ||
    doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
    doc.querySelector('[class*="description" i]')?.textContent?.trim() ||
    "";

  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute("content");
  const images: string[] = [];
  if (ogImage) images.push(toAbsolute(url, ogImage));

  for (const img of doc.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src") || img.getAttribute("data-src");
    if (src && !src.startsWith("data:") && !/logo|icon|avatar|banner|placeholder|sprite/i.test(src)) {
      const full = toAbsolute(url, src);
      if (!images.includes(full)) images.push(full);
    }
  }

  let price = "";
  const priceSelectors = [
    '[class*="price" i]',
    '[data-price]',
    '[itemprop="price"]',
    '.product-price',
    '.price',
    '[class*="ProductPrice"]',
  ];
  for (const sel of priceSelectors) {
    const el = doc.querySelector(sel);
    if (el) {
      const text = el.textContent?.trim();
      if (text && /\d|₹|\$|€|£/.test(text)) {
        price = text;
        break;
      }
    }
  }

  const benefits: string[] = [];
  const benefitSelectors = [
    '[class*="benefit" i]',
    '[class*="feature" i]',
    '.product-features li',
    '[class*="highlights" i] li',
    'ul[class*="benefit" i] li',
  ];
  for (const sel of benefitSelectors) {
    const els = doc.querySelectorAll(sel);
    for (const el of els) {
      const text = el.textContent?.trim();
      if (text && text.length > 10 && text.length < 200) benefits.push(text);
    }
    if (benefits.length >= 5) break;
  }

  return {
    product_name: title.trim() || "Product",
    price: price || null,
    description: desc.trim() || "",
    images: images.slice(0, 10),
    url,
    benefits: benefits.length > 0 ? benefits.slice(0, 5) : undefined,
  };
}

async function fetchPageHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; OptimX-ContentStudio/1.0)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`Failed to fetch: ${resp.statusText}`);
  return resp.text();
}

/**
 * Try WooCommerce Store API - returns products for WooCommerce sites.
 */
async function tryWooCommerceProducts(baseOrigin: string): Promise<{
  products: Array<{
    product_name: string;
    price: string | null;
    description: string;
    images: string[];
    url: string;
    benefits?: string[];
  }>;
  success: boolean;
}> {
  const endpoints = [
    `${baseOrigin}/wp-json/wc/store/v1/products?per_page=100`,
    `${baseOrigin}/wp-json/wc/v2/products?per_page=100`,
    `${baseOrigin}/wp-json/wc/v3/products?per_page=100`,
  ];
  for (const productsUrl of endpoints) {
    try {
      const resp = await fetch(productsUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; OptimX-ContentStudio/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) continue;
      const raw = await resp.json();
      if (!Array.isArray(raw) || raw.length === 0) continue;

      const products = raw.slice(0, MAX_PRODUCTS).map((p: any) => {
        const permalink = p.permalink || p.link || p.href || `${baseOrigin}/product/${p.slug || p.id}`;
        const images = (p.images || []).map((img: any) => img.src || img.url || img).filter(Boolean);
        const price = p.prices?.price ?? p.price ?? p.regular_price ?? null;
        const desc = p.description || p.short_description || (p.excerpt && (p.excerpt.rendered || p.excerpt)) || "";
        return {
          product_name: p.name || (p.title && p.title.rendered) || "Product",
          price: price != null ? String(price) : null,
          description: (typeof desc === "string" ? desc : "").replace(/<[^>]+>/g, "").trim().slice(0, 500),
          images: images.slice(0, 10),
          url: permalink,
          benefits: undefined,
        };
      });
      return { products, success: true };
    } catch {
      continue;
    }
  }
  return { products: [], success: false };
}

/** Detect Shopify store from HTML/JS content */
function isShopifyStore(html: string): boolean {
  return (
    html.includes("cdn.shopify.com") ||
    html.includes("Shopify.theme") ||
    html.includes("shopify")
  );
}

/**
 * Try to fetch Shopify /products.json - returns entire catalog instantly.
 * Much better than scraping when the site is Shopify.
 */
async function tryShopifyProductsJson(baseOrigin: string): Promise<{
  products: Array<{
    product_name: string;
    price: string | null;
    description: string;
    images: string[];
    url: string;
    benefits?: string[];
  }>;
  success: boolean;
}> {
  const productsUrl = `${baseOrigin}/products.json?limit=250`;
  try {
    const resp = await fetch(productsUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OptimX-ContentStudio/1.0)" },
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) return { products: [], success: false };
    const data = await resp.json();
    const raw = data?.products;
    if (!Array.isArray(raw) || raw.length === 0) return { products: [], success: false };

    const products = raw.slice(0, MAX_PRODUCTS).map((p: any) => {
      const handle = p.handle || p.id;
      const productUrl = `${baseOrigin}/products/${handle}`;
      const images = (p.images || []).map((img: any) => img.src || img).filter(Boolean);
      const variants = p.variants || [];
      const firstVariant = variants[0];
      const price = firstVariant?.price
        ? `${firstVariant.price} ${(firstVariant.currency_code || "").trim()}`.trim()
        : null;
      return {
        product_name: p.title || "Product",
        price,
        description: (p.body_html || p.description || "").replace(/<[^>]+>/g, "").trim().slice(0, 500),
        images: images.slice(0, 10),
        url: productUrl,
        benefits: undefined,
      };
    });
    return { products, success: true };
  } catch {
    return { products: [], success: false };
  }
}

function findProductLinksFallback(html: string, baseUrl: string): string[] {
  const dom = new JSDOM(html, { url: baseUrl });
  const doc = dom.window.document;
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links: string[] = [];

  const hasProductClass = (el: Element) => {
    const cls = (el.className && String(el.className)) || "";
    return PRODUCT_CLASS_PATTERNS.some((p) => cls.toLowerCase().includes(p));
  };
  const insideProductContainer = (el: Element) => {
    let parent: Element | null = el.parentElement;
    while (parent) {
      if (hasProductClass(parent)) return true;
      parent = parent.parentElement;
    }
    return false;
  };

  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    try {
      const fullUrl = toAbsolute(baseUrl, href);
      const linkUrl = new URL(fullUrl);
      if (linkUrl.hostname !== base.hostname) continue;
      const normalized = normalizeProductUrl(normalizeUrl(fullUrl));
      if (seen.has(normalized)) continue;
      const path = linkUrl.pathname;

      let isProduct = isProductPage(path);
      if (!isProduct && (hasProductClass(a) || insideProductContainer(a))) isProduct = true;
      if (!isProduct && a.closest('[itemtype*="Product"]')) isProduct = true;
      if (
        !isProduct &&
        (a.hasAttribute("data-product-id") ||
          a.hasAttribute("data-product-handle") ||
          a.hasAttribute("data-product") ||
          a.closest("[data-product-id], [data-product-handle], [data-product]"))
      )
        isProduct = true;

      if (isProduct) {
        seen.add(normalized);
        links.push(normalized);
      }
    } catch {
      /* skip */
    }
  }
  return links;
}

export const config = {
  api: { bodyParser: { sizeLimit: "1mb" }, responseLimit: false },
  maxDuration: 180,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  let { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ ok: false, error: "URL is required" });
  }

  url = url.trim();
  if (!url.startsWith("http")) url = `https://${url}`;

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid URL format" });
  }

  const baseOrigin = new URL(url).origin;

  let productUrls: string[] = [];
  let homepageHtml = "";
  let rawProducts: RawScannedProduct[] = [];

  try {
    // Platform API detection: fetch homepage first to detect Shopify
    homepageHtml = await fetchPageHtml(url).catch(() => "");
    if (isShopifyStore(homepageHtml)) {
      const shopifyResult = await tryShopifyProductsJson(baseOrigin);
      if (shopifyResult.success && shopifyResult.products.length > 0) {
        rawProducts = shopifyResult.products;
      }
    }
    if (rawProducts.length === 0) {
      const wooResult = await tryWooCommerceProducts(baseOrigin);
      if (wooResult.success && wooResult.products.length > 0) {
        rawProducts = wooResult.products;
        homepageHtml = await fetchPageHtml(url).catch(() => "");
      }
    }

    // Fall back to full crawl if Shopify API didn't return products
    if (rawProducts.length === 0) {
      try {
        const result = await crawlWithPlaywright(url, baseOrigin);
        productUrls = [...result.productUrls];
        homepageHtml = result.homepageHtml;
      } catch (playwrightErr: any) {
        console.warn("[Ad Studio] Playwright crawl failed, falling back to fetch:", playwrightErr?.message);
        try {
          homepageHtml = await fetchPageHtml(url);
          productUrls = findProductLinksFallback(homepageHtml, url);
        } catch (fetchErr: any) {
          throw new Error(fetchErr?.message || "Failed to fetch website");
        }
      }

      const uniqueProductUrls = [...new Set(productUrls)]
        .map((u) => normalizeProductUrl(normalizeUrl(u)))
        .filter((u, i, arr) => arr.indexOf(u) === i)
        .slice(0, MAX_PRODUCT_PAGES_TO_SCRAPE);

      for (const productUrl of uniqueProductUrls) {
        if (rawProducts.length >= MAX_PRODUCTS) break;
        try {
          const html = await fetchPageHtml(productUrl);
          const extracted = extractProductFromHtml(html, productUrl);
          if (extracted.product_name && extracted.product_name !== "Product") {
            rawProducts.push(extracted);
          }
        } catch (e) {
          console.warn("[Ad Studio] Failed to scrape product:", productUrl, e);
        }
      }

      if (rawProducts.length === 0) {
        const extracted = extractProductFromHtml(homepageHtml, url);
        rawProducts.push({
          ...extracted,
          product_name: extracted.product_name || "Product",
        });
      }
    }

  const dom = new JSDOM(homepageHtml || "", { url });
  let articleText = "";
  try {
    const reader = new Readability(dom.window.document as any);
    const article = reader.parse();
    articleText = article?.textContent || "";
  } catch {
    articleText = dom.window.document.body?.textContent || "";
  }

  const title = dom.window.document.querySelector("title")?.textContent || "";
  const metaDesc =
    dom.window.document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  const contentSnippet = (title + " " + metaDesc + " " + articleText).slice(0, 6000);

  const geminiKey = getGeminiApiKey();
  let brand: Record<string, string> = {};
  let products: StructuredProduct[] = [];

  if (geminiKey) {
    const brandPrompt = `From this website content, extract brand intelligence. Return JSON:
{
  "brand_name": "string",
  "brand_tone": "string - e.g. Healthy, modern, natural",
  "industry": "string",
  "target_audience": "string - e.g. Health conscious young professionals",
  "primary_value_proposition": "string - Key selling point"
}

CONTENT:
${contentSnippet}`;

    const brandRaw = await callGemini(brandPrompt, "Return ONLY valid JSON.");
    try {
      brand = JSON.parse(brandRaw);
    } catch {
      brand = extractBrandHeuristic(title, metaDesc, url);
    }

    const productsPrompt = `Convert this product data into structured format. Return JSON array:
[
  {
    "product_name": "string",
    "price": "string or null",
    "description": "string - 1-2 sentences",
    "key_benefits": ["benefit1", "benefit2", "benefit3"],
    "product_images": ["url1", "url2"],
    "target_audience": "string",
    "emotional_angles": ["angle1", "angle2", "angle3"],
    "use_cases": ["use1", "use2"],
    "short_benefit": "string - one line for card display"
  }
]

Use benefits from input when available. Skip products with no name.
RAW PRODUCTS:
${JSON.stringify(rawProducts)}`;

    const productsRaw = await callGemini(productsPrompt, "Return ONLY a valid JSON array.");
    try {
      const parsed = JSON.parse(productsRaw);
      products = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      products = mapRawProductsToStructured(rawProducts);
    }
  } else {
    console.warn(
      "[Content Studio] GEMINI_API_KEY not set — using crawl-only extraction (add GEMINI_API_KEY to .env.local for AI brand enrichment)"
    );
    brand = extractBrandHeuristic(title, metaDesc, url);
    products = mapRawProductsToStructured(rawProducts);
  }

  if (products.length === 0) {
    return res.status(422).json({
      ok: false,
      error:
        "No products found on this website. Try a store URL with a product catalog, or add GEMINI_API_KEY for harder sites.",
    });
  }

    const brandResult = {
        name: brand.brand_name || "Unknown",
        tone: brand.brand_tone || "",
        industry: brand.industry || "",
        targetAudience: brand.target_audience || "",
        primaryValueProposition: brand.primary_value_proposition || "",
      };

    // Save scan to DB
    let scanId: string | undefined;
    try {
      const scan = await ContentStudioScanDAO.create({
        userId,
        url,
        brandSummary: brandResult,
        products,
      });
      scanId = scan.id;
    } catch (dbErr: any) {
      console.error("[Content Studio] DB save failed:", dbErr?.message);
    }

    return res.status(200).json({
      ok: true,
      scanId,
      brand: brandResult,
      products,
    });
  } catch (err: any) {
    const msg = err?.message || String(err) || "Failed to scan website";
    console.error("[Ad Studio scan]", msg, err?.stack);
    return res.status(500).json({
      ok: false,
      error: msg,
    });
  }
}
