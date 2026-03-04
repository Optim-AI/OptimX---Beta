// pages/api/content-studio/scan.ts
// Website scanning: full-site crawl with Playwright, extract products, brand intelligence

import type { NextApiRequest, NextApiResponse } from "next";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { getUserIdFromRequest } from "@/auth/request";
import { chromium } from "playwright";

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GEMINI_VEO_API_KEY ||
  process.env.NANO_API_KEY;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const MAX_CATEGORY_PAGES = 20;
const MAX_PRODUCTS = 300;
const MAX_PRODUCT_PAGES_TO_SCRAPE = 150;
const PAGE_LOAD_TIMEOUT = 15000;
const SCROLL_PAUSE = 1500;
const SCROLL_ATTEMPTS = 12;

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

async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
  if (!GEMINI_API_KEY)
    throw new Error(
      "GEMINI_API_KEY, GEMINI_VEO_API_KEY, or NANO_API_KEY not configured"
    );
  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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

const NON_PRODUCT_PATH_SEGMENTS = new Set([
  "cart", "checkout", "account", "login", "register", "search", "wishlist",
  "contact", "about", "faq", "help", "terms", "privacy", "blog", "news",
]);

function isCategoryPage(path: string): boolean {
  return CATEGORY_PATH_PATTERNS.some((p) => p.test(path));
}

function isProductPage(path: string): boolean {
  if (PRODUCT_PATH_PATTERNS.some((p) => p.test(path))) return true;
  // Heuristic: path depth > 1, contains hyphen, not a known non-product path
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return false;
  const lastSegment = segments[segments.length - 1] || "";
  if (NON_PRODUCT_PATH_SEGMENTS.has(lastSegment.toLowerCase())) return false;
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
          productUrls.add(normalizeUrl(link));
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

        while (scrollAttempts < SCROLL_ATTEMPTS) {
          const found = await page.evaluate((origin) => {
            const anchors = document.querySelectorAll("a[href]");
            const links: string[] = [];
            for (const a of anchors) {
              const href = (a as HTMLAnchorElement).href;
              if (!href || !href.startsWith(origin) || href.includes("#")) continue;
              try {
                const u = new URL(href);
                const path = u.pathname;
                const segments = path.split("/").filter(Boolean);
                if (segments.length < 2) continue;
                const lastSegment = segments[segments.length - 1] || "";
                if (lastSegment.includes("-")) {
                  u.hash = "";
                  links.push(u.toString());
                }
              } catch {
                /* skip */
              }
            }
            return [...new Set(links)];
          }, baseOrigin);

          for (const link of found) {
            const path = new URL(link).pathname;
            if (isProductPage(path)) productUrls.add(normalizeUrl(link));
          }

          const nextBtn = await page.$(
            'a[href*="page="], a[rel="next"], [aria-label*="next" i], .pagination a, .next-page, [class*="next"]'
          );
          if (nextBtn) {
            await nextBtn.click().catch(() => {});
            await delay(SCROLL_PAUSE);
            scrollAttempts = 0;
            continue;
          }

          const currentPageUrl = page.url();
          const nextPageLink = await page.$('a[href*="page="]');
          if (nextPageLink) {
            const href = await nextPageLink.getAttribute("href");
            if (href) {
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
          if (pageNum <= 3) {
            const beforeCount = productUrls.size;
            await page.goto(nextPageUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
            await delay(SCROLL_PAUSE);
            const found = await page.evaluate((origin) => {
              const anchors = document.querySelectorAll("a[href]");
              const links: string[] = [];
              for (const a of anchors) {
                const href = (a as HTMLAnchorElement).href;
                if (!href || !href.startsWith(origin) || href.includes("#")) continue;
                try {
                  const u = new URL(href);
                  const path = u.pathname;
                  const segments = path.split("/").filter(Boolean);
                  if (segments.length < 2) continue;
                  const lastSegment = segments[segments.length - 1] || "";
                  if (lastSegment.includes("-")) {
                    u.hash = "";
                    links.push(u.toString());
                  }
                } catch {
                  /* skip */
                }
              }
              return [...new Set(links)];
            }, baseOrigin);
            for (const link of found) {
              const path = new URL(link).pathname;
              if (isProductPage(path)) productUrls.add(normalizeUrl(link));
            }
            if (productUrls.size > beforeCount) scrollAttempts = 0;
            continue;
          }

          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await delay(SCROLL_PAUSE);

          const newCount = productUrls.size;
          if (newCount === prevCount) scrollAttempts++;
          else scrollAttempts = 0;
          prevCount = newCount;
        }
      } catch (e) {
        console.warn("[Content Studio] Category page failed:", catUrl, e);
      }
    }

    if (productUrls.size === 0) {
      for (const link of allLinks) {
        try {
          const path = new URL(link).pathname;
          if (isProductPage(path)) productUrls.add(normalizeUrl(link));
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

  for (const a of doc.querySelectorAll("a[href]")) {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    try {
      const fullUrl = toAbsolute(baseUrl, href);
      const linkUrl = new URL(fullUrl);
      if (linkUrl.hostname !== base.hostname) continue;
      if (seen.has(fullUrl)) continue;
      const path = linkUrl.pathname;
      if (isProductPage(path)) {
        seen.add(fullUrl);
        links.push(fullUrl);
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

  if (!GEMINI_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "GEMINI_API_KEY, GEMINI_VEO_API_KEY, or NANO_API_KEY not configured",
    });
  }

  const baseOrigin = new URL(url).origin;

  let productUrls: string[] = [];
  let homepageHtml = "";
  let rawProducts: Array<{
    product_name: string;
    price: string | null;
    description: string;
    images: string[];
    url: string;
    benefits?: string[];
  }> = [];

  try {
    // Smart trick: Try platform APIs first - instant full catalog
    const shopifyResult = await tryShopifyProductsJson(baseOrigin);
    if (shopifyResult.success && shopifyResult.products.length > 0) {
      rawProducts = shopifyResult.products;
      homepageHtml = await fetchPageHtml(url).catch(() => "");
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
        console.warn("[Content Studio] Playwright crawl failed, falling back to fetch:", playwrightErr?.message);
        try {
          homepageHtml = await fetchPageHtml(url);
          productUrls = findProductLinksFallback(homepageHtml, url);
        } catch (fetchErr: any) {
          throw new Error(fetchErr?.message || "Failed to fetch website");
        }
      }

      const uniqueProductUrls = [...new Set(productUrls)].slice(0, MAX_PRODUCT_PAGES_TO_SCRAPE);

      for (const productUrl of uniqueProductUrls) {
        if (rawProducts.length >= MAX_PRODUCTS) break;
        try {
          const html = await fetchPageHtml(productUrl);
          const extracted = extractProductFromHtml(html, productUrl);
          if (extracted.product_name && extracted.product_name !== "Product") {
            rawProducts.push(extracted);
          }
        } catch (e) {
          console.warn("[Content Studio] Failed to scrape product:", productUrl, e);
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
  let brand: Record<string, string> = {};
  try {
    brand = JSON.parse(brandRaw);
  } catch {
    brand = {
      brand_name: "Unknown",
      brand_tone: "",
      industry: "",
      target_audience: "",
      primary_value_proposition: "",
    };
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
  let products: Array<{
    product_name: string;
    price: string | null;
    description: string;
    key_benefits: string[];
    product_images: string[];
    target_audience: string;
    emotional_angles: string[];
    use_cases: string[];
    short_benefit: string;
  }> = [];

  try {
    const parsed = JSON.parse(productsRaw);
    products = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    products = rawProducts.map((p) => ({
      product_name: p.product_name,
      price: p.price,
      description: p.description,
      key_benefits: p.benefits || [],
      product_images: p.images,
      target_audience: "",
      emotional_angles: [] as string[],
      use_cases: [] as string[],
      short_benefit: p.description.slice(0, 80) || "",
    }));
  }

    return res.status(200).json({
      ok: true,
      brand: {
        name: brand.brand_name || "Unknown",
        tone: brand.brand_tone || "",
        industry: brand.industry || "",
        targetAudience: brand.target_audience || "",
        primaryValueProposition: brand.primary_value_proposition || "",
      },
      products,
    });
  } catch (err: any) {
    const msg = err?.message || String(err) || "Failed to scan website";
    console.error("[Content Studio scan]", msg, err?.stack);
    return res.status(500).json({
      ok: false,
      error: msg,
    });
  }
}
