// pages/api/brand/fullAnalyze.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

import { getGeminiApiKey } from "@/lib/gemini-config";
import { normalizeAuditUrl } from "@/lib/audit/url-safety";
// Browser-style agent: Shopify rate-limits agents containing "bot" (429).
import { crawlSite, PAGE_FETCH_HEADERS } from "@/lib/research/site-crawl";
import { profileBrand } from "@/lib/research/brand-research";

export const config = {
  maxDuration: 60,
};

/* ---------------------- HELPERS ---------------------- */
function toAbsolute(base: string, src: string) {
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

/* ---------------------- PAGE SCRAPING ---------------------- */
/** Visual brand signals (logo, colours, fonts, images) from the homepage HTML. */
async function fetchPageData(url: string, html: string) {
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;

  let article: any = null;
  try {
  const reader = new Readability(doc as any);
    article = reader.parse();
  } catch (e) {
    console.warn("Readability parsing failed, continuing without article:", e);
    // Continue without article - we can still extract other data
  }

  const title = doc.querySelector("title")?.textContent || "";
  const metaDesc =
    doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";

  const ogImage =
    doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
    doc.querySelector('link[rel="image_src"]')?.getAttribute("href") ||
    null;

  // Get all images
  const imgs = Array.from(doc.querySelectorAll("img"))
    .map((el) => el.getAttribute("src") || "")
    .filter(Boolean)
    .map((src) => toAbsolute(url, src));

  // Get favicon/icon links
  const favicon =
    doc.querySelector('link[rel="icon"]')?.getAttribute("href") ||
    doc.querySelector('link[rel="shortcut icon"]')?.getAttribute("href") ||
    doc.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href") ||
    null;

  // Try to find logo using multiple strategies
  let logo: string | null = null;

  // Strategy 1: Check common logo selectors (class/id names)
  const logoSelectors = [
    'img[class*="logo" i]',
    'img[id*="logo" i]',
    'header img',
    'nav img',
    '.header img',
    '.navbar img',
    '.site-header img',
    '[class*="brand" i] img',
    '[id*="brand" i] img'
  ];

  for (const selector of logoSelectors) {
    const logoEl = doc.querySelector(selector) as HTMLImageElement | null;
    if (logoEl?.src) {
      logo = toAbsolute(url, logoEl.src);
      break;
    }
  }

  // Strategy 2: Check image URLs for logo keywords
  if (!logo) {
  const logoCandidates = imgs.filter((s) =>
      /logo|brand|icon|mark|symbol/i.test(s) && !/avatar|profile|user|person/i.test(s)
  );
    if (logoCandidates.length > 0) {
      // Prefer SVG logos or larger images (likely to be logos)
      const svgLogo = logoCandidates.find(s => s.includes('.svg'));
      if (svgLogo) {
        logo = svgLogo;
      } else {
        logo = logoCandidates[0];
      }
    }
  }

  // Strategy 3: Check favicon (often the logo)
  if (!logo && favicon) {
    logo = toAbsolute(url, favicon);
  }

  // Strategy 4: Check og:image if it looks like a logo (not a product image)
  if (!logo && ogImage && !/product|item|product-image|hero|banner/i.test(ogImage)) {
    logo = ogImage;
  }

  // Strategy 5: Check first image in header/nav area (often the logo)
  if (!logo) {
    const header = doc.querySelector('header, .header, .site-header, nav, .navbar');
    if (header) {
      const headerImg = header.querySelector('img');
      if (headerImg?.src) {
        logo = toAbsolute(url, headerImg.src);
      }
    }
  }

  // Extract brand colors from CSS and meta tags
  const themeColor = doc.querySelector('meta[name="theme-color"]')?.getAttribute("content") || null;
  
  // Extract CTA patterns (common button/link text)
  const ctaElements = Array.from(doc.querySelectorAll('a, button'))
    .map(el => el.textContent?.trim())
    .filter(text => text && text.length > 0 && text.length < 50)
    .filter(text => /^(shop|buy|get|try|explore|discover|learn|sign|start|order|add|view|see|click)/i.test(text))
    .slice(0, 10);
  
  // Extract CSS variables for colors
  const styleSheets = Array.from(doc.styleSheets);
  const cssColors: string[] = [];
  const fontFamilies: Set<string> = new Set();
  
  try {
    for (const sheet of styleSheets) {
      try {
        const rules = Array.from((sheet as CSSStyleSheet).cssRules || []);
        for (const rule of rules) {
          if (rule instanceof CSSStyleRule) {
            const style = rule.style;
            // Check for color properties
            ['color', 'background-color', 'border-color'].forEach(prop => {
              const value = style.getPropertyValue(prop);
              if (value && /^#[0-9A-Fa-f]{3,6}$/.test(value.trim())) {
                cssColors.push(value.trim());
              }
            });
            // Check CSS variables
            const cssText = rule.cssText;
            const varMatches = cssText.match(/--[a-z-]+:\s*(#[0-9A-Fa-f]{3,6}|rgb\([^)]+\))/gi);
            if (varMatches) {
              varMatches.forEach(match => {
                const color = match.split(':')[1]?.trim();
                if (color) cssColors.push(color);
              });
            }
            // Extract font-family
            const fontFamily = style.getPropertyValue('font-family');
            if (fontFamily) {
              // Parse font stack (e.g., "Arial, sans-serif" -> "sans-serif")
              const fonts = fontFamily.split(',').map(f => f.trim().replace(/['"]/g, ''));
              fonts.forEach(font => {
                // Normalize to common font style categories
                const lower = font.toLowerCase();
                if (lower.includes('serif')) fontFamilies.add('serif');
                else if (lower.includes('sans-serif') || lower.includes('sans')) fontFamilies.add('sans-serif');
                else if (lower.includes('mono')) fontFamilies.add('monospace');
                else if (lower.includes('cursive') || lower.includes('script')) fontFamilies.add('cursive');
                else if (lower.includes('fantasy')) fontFamilies.add('fantasy');
              });
            }
          }
        }
      } catch (e) {
        // Cross-origin stylesheets may throw errors, skip them
      }
    }
  } catch (e) {
    // Ignore CSS parsing errors
  }

  // Also check inline styles and computed styles for fonts
  try {
    const bodyFont = doc.body?.style?.fontFamily || '';
    if (bodyFont) {
      const lower = bodyFont.toLowerCase();
      if (lower.includes('serif')) fontFamilies.add('serif');
      else if (lower.includes('sans')) fontFamilies.add('sans-serif');
      else if (lower.includes('mono')) fontFamilies.add('monospace');
    }
  } catch (e) {
    // Ignore
  }

  // Determine primary font style (prefer sans-serif, then serif, then others)
  let primaryFontStyle = 'sans-serif'; // Default
  if (fontFamilies.has('sans-serif')) primaryFontStyle = 'sans-serif';
  else if (fontFamilies.has('serif')) primaryFontStyle = 'serif';
  else if (fontFamilies.has('monospace')) primaryFontStyle = 'monospace';
  else if (fontFamilies.has('cursive')) primaryFontStyle = 'cursive';
  else if (fontFamilies.has('fantasy')) primaryFontStyle = 'fantasy';

  // Extract "About Us" section text for brand voice analysis
  let aboutUsText = '';
  const aboutSelectors = [
    'section[class*="about" i]',
    '[id*="about" i]',
    '.about-us',
    '#about',
    '[class*="mission" i]',
    '[id*="mission" i]',
    '[class*="story" i]',
    '[id*="story" i]',
    '[class*="values" i]',
    '[id*="values" i]'
  ];

  for (const selector of aboutSelectors) {
    const aboutSection = doc.querySelector(selector);
    if (aboutSection) {
      aboutUsText = aboutSection.textContent || '';
      if (aboutUsText.length > 100) break; // Found substantial content
    }
  }

  // If no dedicated About section, try to extract from main content
  if (!aboutUsText || aboutUsText.length < 100) {
    const mainContent = doc.querySelector('main, article, [role="main"]');
    if (mainContent) {
      aboutUsText = mainContent.textContent || '';
    }
  }

  // Extract visual style indicators from HTML structure
  const hasHero = !!doc.querySelector('section.hero, .hero, [class*="hero" i], [id*="hero" i]');
  const hasIllustrations = imgs.some(img => /illustration|illustration|drawing|sketch|vector/i.test(img));
  const hasPhotography = imgs.some(img => /photo|image|product|gallery/i.test(img) && !/icon|logo/i.test(img));
  const hasDarkTheme = (doc.body && doc.body.classList && doc.body.classList.contains('dark')) || 
    doc.querySelector('html[class*="dark" i]') !== null ||
    (doc.body && doc.body.style && doc.body.style.backgroundColor && /dark|black|#000/i.test(doc.body.style.backgroundColor));

  // Convert logo URL to data URL if logo is found (to avoid CORS issues later)
  let logoDataUrl: string | null = null;
  if (logo) {
    try {
      const logoUrl = toAbsolute(url, logo);
      const logoResponse = await fetch(logoUrl, {
        headers: PAGE_FETCH_HEADERS,
        redirect: "follow",
      });
      
      if (logoResponse.ok) {
        const contentType = logoResponse.headers.get("content-type") || "";
        // Only convert to data URL if it's a supported image type (not SVG, ICO, etc.)
        const unsupportedTypes = ['image/svg+xml', 'image/vnd.microsoft.icon', 'image/x-icon', 'image/ico'];
        const normalizedType = contentType.toLowerCase().trim();
        
        if (contentType.startsWith('image/') && !unsupportedTypes.some(type => normalizedType.includes(type))) {
          const arrayBuffer = await logoResponse.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString("base64");
          logoDataUrl = `data:${contentType};base64,${base64}`;
          console.log("✅ Logo converted to data URL:", { contentType, size: buffer.length });
        } else {
          console.warn("⚠️ Logo has unsupported type, keeping as URL:", contentType);
          // Keep original URL if type is unsupported
        }
      }
    } catch (e) {
      console.warn("⚠️ Failed to convert logo to data URL, keeping as URL:", e);
      // Keep original URL if conversion fails
    }
  }

  return {
    title,
    metaDesc,
    text: article?.textContent || "",
    ogImage: ogImage ? toAbsolute(url, ogImage) : null,
    logo: logoDataUrl || logo, // Prefer data URL, fallback to URL
    logoUrl: logo, // Keep original URL as backup
    allImages: imgs,
    url,
    // Expanded brand intelligence data
    themeColor,
    ctaPatterns: [...new Set(ctaElements)], // Remove duplicates
    cssColors: [...new Set(cssColors)].slice(0, 10), // Limit to 10 unique colors
    fontStyle: primaryFontStyle, // Primary font style extracted
    aboutUsText: aboutUsText.substring(0, 2000), // Limit to 2000 chars for AI analysis
    visualIndicators: {
      hasHero,
      hasIllustrations,
      hasPhotography,
      hasDarkTheme
    }
  };
}

/* ---------------------- MAIN HANDLER ---------------------- */
// Fast brand profile for onboarding and the Brand Kit: the site's own pages plus
// one Gemini call. Market research (competitors, customer voice) runs separately
// in /api/brand/research because it needs live web search and takes ~1 minute.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { getUserIdFromRequest } = await import("@/auth/request");
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const check = normalizeAuditUrl(req.body?.url);
  if (!check.ok) return res.status(400).json({ error: check.message });
  const url = check.url;

  if (!getGeminiApiKey()) {
    console.error("GEMINI_API_KEY is not configured");
    return res.status(503).json({ error: "Server configuration error: Gemini API key missing" });
  }

  try {
    let site;
    try {
      site = await crawlSite(url);
    } catch (e: any) {
      console.error("Failed to fetch page data:", e?.message || e);
      return res.status(422).json({ error: "We couldn't open that website. Check the address and try again." });
    }
    const data = await fetchPageData(site.url, site.homeHtml);

    const imageCandidates = [...new Set(data.allImages as string[])]
      .filter((u) => /^https?:\/\//.test(u) && !/\.(svg|gif)(\?|$)/i.test(u) && !/logo|icon|sprite|payment|badge|avatar/i.test(u))
      .slice(0, 40);

    const profile = await profileBrand(site, imageCandidates);
    const finalImages = profile.product_images.length ? profile.product_images : imageCandidates.slice(0, 6);

    // Primary colours: theme colour first, then CSS colours (up to 5)
    const primaryColorsArray: string[] = [];
    if (data.themeColor && /^#[0-9A-Fa-f]{3,6}$/i.test(data.themeColor)) {
      primaryColorsArray.push(data.themeColor);
    }
    for (const color of data.cssColors || []) {
      if (color && /^#[0-9A-Fa-f]{3,6}$/i.test(color) && !primaryColorsArray.includes(color)) {
        primaryColorsArray.push(color);
        if (primaryColorsArray.length >= 5) break;
      }
    }

    const vs = profile.visual_style;
    const ti = profile.typography_intent;
    const pricePositioning = profile.price_positioning === "unclear" ? null : profile.price_positioning;

    return res.status(200).json({
      result: {
        // Legacy shape kept for mapFullAnalyzeToBrandSnapshot and older callers
        facts: {
          company_name: profile.company_name,
          what_they_sell: profile.what_they_sell,
          who_it_is_for: profile.who_it_is_for,
          business_model: profile.business_model,
          pricing_signals: pricePositioning || "unclear",
          claims_made: profile.claims_made,
        },
        classification: {
          category: profile.category,
          customer_type: profile.customer_type,
        },
        positioning: {
          primary_value_proposition: profile.value_proposition || profile.one_liner,
          intended_positioning: profile.one_liner,
        },
        logo: data.logo || null,
        logoUrl: data.logoUrl || null,
        product_images: finalImages,
        brand_assets: [...finalImages, data.logo, data.ogImage].filter(Boolean),
        colors: {
          primary: primaryColorsArray[0] || null,
          secondary: primaryColorsArray[1] || null,
          accent: primaryColorsArray[2] || null,
        },
        primaryColors: primaryColorsArray,
        fontStyles: data.fontStyle || "sans-serif",
        brandVoice: profile.brand_voice,
        coreValueProp: profile.value_proposition || null,
        visualStyle: Object.keys(vs).length
          ? {
              minimalVsDetailed: vs.minimal_vs_detailed,
              flatVsRealistic: vs.flat_vs_realistic,
              illustrationVsPhotography: vs.illustration_vs_photography,
              lightVsDark: vs.light_vs_dark,
            }
          : null,
        typographyIntent: Object.keys(ti).length ? { style: ti.style, contrast: ti.contrast } : null,
        personality: profile.personality || null,
        ctaPatterns: site.ctas.length ? site.ctas : data.ctaPatterns || [],
        productCategory: profile.sub_category || profile.category || null,
        pricePositioning,
        industry: profile.category || null,
        brand_aesthetic: profile.brand_aesthetic,
        brand_tone: profile.brand_tone,
        brand_values: profile.brand_values,
        business_overview: profile.business_overview || null,
        tagline: profile.tagline || null,
        website_url: site.url,
      },
    });
  } catch (e: any) {
    console.error("❌ Brand analysis error:", e?.message || e);
    const message = e?.message || "Analysis failed";
    return res.status(500).json({
      error: "Analysis failed",
      details: process.env.NODE_ENV === "development" ? message : undefined,
    });
  }
}
