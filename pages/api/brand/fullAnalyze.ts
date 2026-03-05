// pages/api/brand/fullAnalyze.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SERPAPI_KEY = process.env.SERPAPI_KEY || "";

type Competitor = {
  domain: string;
  title?: string;
  snippet?: string;
  url?: string;
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
async function fetchPageData(url: string) {
  const resp = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "optimx-brand-bot/1.0" }
  });
  if (!resp.ok) throw new Error("Failed to fetch page");

  const html = await resp.text();
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
        headers: { "User-Agent": "optimx-brand-bot/1.0" },
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

/* ---------------------- SERP COMPETITORS ---------------------- */
async function findCompetitorsSerp(
  query: string,
  siteDomain: string
): Promise<Competitor[]> {
  if (!SERPAPI_KEY) return [];

  const res = await fetch(
    `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
      query
    )}&api_key=${SERPAPI_KEY}&num=5`
  );

  if (!res.ok) return [];
  const j = (await res.json()) as any;

  return (j.organic_results || [])
    .filter((r: any) => r.link && !r.link.includes(siteDomain))
    .slice(0, 5)
    .map((r: any) => ({
      domain: new URL(r.link).hostname,
      title: r.title,
      snippet: r.snippet,
      url: r.link
    }));
}

/* ---------------------- OPENAI CALL ---------------------- */
async function callOpenAI(prompt: string) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  try {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Return ONLY valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0,
      max_tokens: 800
    })
  });

    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("OpenAI API error:", resp.status, errorText);
      throw new Error(`OpenAI API error: ${resp.status} - ${errorText}`);
    }

  const j = await resp.json();
    const content = j.choices?.[0]?.message?.content || "{}";
    
    if (!content || content.trim() === "") {
      console.warn("OpenAI returned empty response");
      return "{}";
    }
    
    return content;
  } catch (e: any) {
    console.error("OpenAI call failed:", e?.message || e);
    throw e;
  }
}

/* ---------------------- AI IMAGE RANKING ---------------------- */
async function rankImagesWithAI(images: string[], context: any) {
  if (!images.length) return [];

  const prompt = `
You are selecting product visuals for marketing.

Pick images that most likely represent real products or offerings.
Ignore logos, icons, UI elements, patterns, or backgrounds.

Return JSON:
{
  "ranked": ["url1", "url2", "url3"]
}

Images:
${images.join("\n")}

Brand context:
${JSON.stringify({
    name: context.facts?.company_name,
    category: context.classification?.category,
    offering: context.facts?.what_they_sell
  })}
`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Return ONLY valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0
      })
    });

    const j = await resp.json();
    const parsed = JSON.parse(j.choices?.[0]?.message?.content || "{}");

    return Array.isArray(parsed.ranked) ? parsed.ranked : [];
  } catch {
    return [];
  }
}

/* ---------------------- PROMPTS ---------------------- */
const factsPrompt = (d: any) => `
Extract ONLY verifiable facts from this website.

Return JSON:
{
  "company_name":"",
  "what_they_sell":[],
  "who_it_is_for":[],
  "business_model":"",
  "pricing_signals":"cheap|mid|premium|unclear",
  "claims_made":[]
}

IMPORTANT: Extract the company/brand name from the title, URL, or page content. The company name is required.

PAGE TITLE: ${d.title || 'Unknown'}
META DESCRIPTION: ${d.metaDesc || 'None'}
URL: ${d.url || 'Unknown'}

PAGE CONTENT:
${d.text || 'No text content extracted'}
`;

const classificationPrompt = (facts: any) => `
Classify this business.

Return JSON:
{
  "category":"SaaS|D2C|Marketplace|Service|Local",
  "customer_type":"B2B|B2C|B2B2C|D2C",
  "stage":"early|growth|mature",
  "positioning":"cost|quality|speed|niche|brand-led"
}

FACTS:
${JSON.stringify(facts)}
`;

const positioningPrompt = (facts: any, cls: any) => `
Analyze brand positioning.

Return JSON:
{
  "primary_value_proposition":"",
  "intended_positioning":"",
  "perceived_positioning":""
}

FACTS:${JSON.stringify(facts)}
CLASS:${JSON.stringify(cls)}
`;

const competitionPrompt = (facts: any, pos: any, comps: any[]) => `
Compare with competitors.

Return JSON:
{
  "summary":"",
  "comparison":[]
}

FACTS:${JSON.stringify(facts)}
POSITIONING:${JSON.stringify(pos)}
COMPETITORS:${JSON.stringify(comps)}
`;

const teardownPrompt = (ctx: any) => `
Give website teardown.

Return JSON:
{
  "clarity_score":1,
  "trust_score":1,
  "action_plan":[]
}

CONTEXT:${JSON.stringify(ctx)}
`;

const brandVoicePrompt = (aboutUsText: string, facts: any) => `
Analyze the brand voice and core value proposition from the About Us section and company information.

Return JSON:
{
  "brand_voice": "Professional|Playful|Minimalist|Bold",
  "core_value_prop": "A concise, compelling hook that captures the brand's main value proposition (max 100 characters)"
}

About Us Text:
${aboutUsText || 'No About Us section found'}

Company Facts:
${JSON.stringify(facts)}

Instructions:
- brand_voice: Choose ONE of: "Professional" (formal, corporate, trustworthy), "Playful" (fun, energetic, casual), "Minimalist" (clean, simple, understated), or "Bold" (confident, striking, attention-grabbing)
- core_value_prop: Extract the single most compelling value proposition or unique selling point. This should be a hook that would grab attention in marketing. Keep it concise and punchy.
`;

const brandIntelligencePrompt = (data: any, facts: any, positioning: any) => `
Analyze brand visual intelligence from website data.

Return JSON:
{
  "visual_style": {
    "minimal_vs_detailed": "minimal|detailed|balanced",
    "flat_vs_realistic": "flat|realistic|mixed",
    "illustration_vs_photography": "illustration|photography|mixed",
    "light_vs_dark": "light|dark|balanced"
  },
  "typography_intent": {
    "style": "modern|bold|playful|premium|minimal|classic",
    "contrast": "high|medium|low"
  },
  "brand_personality": "confident|friendly|youthful|premium|bold|playful|professional|minimal",
  "product_category": "specific product category like 'earbuds', 'headphones', 'smartwatches', 'accessories', etc.",
  "price_positioning": "budget|mid-range|premium|unclear"
}

Website data:
- Has hero section: ${data.visualIndicators?.hasHero}
- Has illustrations: ${data.visualIndicators?.hasIllustrations}
- Has photography: ${data.visualIndicators?.hasPhotography}
- Has dark theme: ${data.visualIndicators?.hasDarkTheme}
- Available colors: ${data.cssColors?.join(', ') || 'none'}
- Theme color: ${data.themeColor || 'none'}

Facts: ${JSON.stringify(facts)}
Positioning: ${JSON.stringify(positioning)}
`;

const brandKitPrompt = (data: any, facts: any, positioning: any) => `
Analyze the brand content and extract structured brand kit data for a Brand Guideline UI (like Pomeli or Canva Brand Kit).

Return JSON with these exact keys:
{
  "brand_aesthetic": ["minimalist", "modern", "scientific", "elegant"],
  "brand_tone": ["transparent", "friendly", "educational"],
  "brand_values": ["100% Vegan", "Cruelty-Free", "Sustainability"],
  "business_overview": "2-sentence summary: what the company does, industry, unique value proposition, product categories.",
  "tagline": "brand tagline or slogan if found, else empty string"
}

Rules:
- brand_aesthetic: 4-6 descriptors (e.g. scientific, minimalist, sophisticated, modern, elegant, luxury, playful)
- brand_tone: 3-5 tone descriptors (e.g. transparent, friendly, educational, delightful, professional)
- brand_values: key differentiators, certifications, commitments (e.g. "100% Vegan", "PETA certified")
- business_overview: exactly 2 sentences, max 200 chars total
- tagline: exact tagline from site or empty ""

PAGE TITLE: ${data.title || 'Unknown'}
META DESCRIPTION: ${data.metaDesc || 'None'}
URL: ${data.url || 'Unknown'}
ABOUT/CONTENT: ${data.aboutUsText?.substring(0, 1500) || 'No content'}

Facts: ${JSON.stringify(facts)}
Positioning: ${JSON.stringify(positioning)}
`;

/* ---------------------- MAIN HANDLER ---------------------- */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") return res.status(405).end();
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing url" });

  if (!OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not configured");
    return res.status(500).json({ error: "Server configuration error: OpenAI API key missing" });
  }

  try {
    let data: any;
    try {
      data = await fetchPageData(url);
    } catch (e: any) {
      console.error("Failed to fetch page data:", e?.message || e);
      throw new Error(`Failed to fetch or parse website: ${e?.message || "Unknown error"}`);
    }

    let domain: string;
    try {
      domain = new URL(url).hostname;
    } catch (e) {
      console.error("Invalid URL:", url);
      throw new Error("Invalid URL provided");
    }

    const competitors = await findCompetitorsSerp(
      `${data.title} ${data.metaDesc}`,
      domain
    );

    // Parse OpenAI responses with error handling
    let facts: any = {};
    let classification: any = {};
    let positioning: any = {};
    let competition: any = {};
    let brandVoiceData: any = {};
    let teardown: any = {};
    let brandIntelligence: any = {};
    let brandKit: any = {};

    try {
      const factsJson = await callOpenAI(factsPrompt(data));
      facts = JSON.parse(factsJson || "{}");
    } catch (e) {
      console.error("Failed to parse facts:", e);
      throw new Error("Failed to extract brand facts");
    }

    try {
      const classificationJson = await callOpenAI(classificationPrompt(facts));
      classification = JSON.parse(classificationJson || "{}");
    } catch (e) {
      console.error("Failed to parse classification:", e);
      // Continue with empty classification
    }

    try {
      const positioningJson = await callOpenAI(positioningPrompt(facts, classification));
      positioning = JSON.parse(positioningJson || "{}");
    } catch (e) {
      console.error("Failed to parse positioning:", e);
      // Continue with empty positioning
    }

    try {
      const competitionJson = await callOpenAI(competitionPrompt(facts, positioning, competitors));
      competition = JSON.parse(competitionJson || "{}");
    } catch (e) {
      console.error("Failed to parse competition:", e);
      // Continue with empty competition
    }

    try {
      const teardownJson = await callOpenAI(
        teardownPrompt({ facts, classification, positioning, competition })
      );
      teardown = JSON.parse(teardownJson || "{}");
    } catch (e) {
      console.error("Failed to parse teardown:", e);
      // Continue with empty teardown
    }

    // Extract expanded brand intelligence
    try {
      const brandIntelligenceJson = await callOpenAI(brandIntelligencePrompt(data, facts, positioning));
      brandIntelligence = JSON.parse(brandIntelligenceJson || "{}");
    } catch (e) {
      console.error("Failed to parse brand intelligence:", e);
      // Continue with empty brand intelligence
    }

    // Extract brand kit (aesthetic, tone, values, business overview)
    try {
      const brandKitJson = await callOpenAI(brandKitPrompt(data, facts, positioning));
      brandKit = JSON.parse(brandKitJson || "{}");
    } catch (e) {
      console.error("Failed to parse brand kit:", e);
    }

    // Analyze brand voice and core value prop from About Us section
    try {
      if (data.aboutUsText && data.aboutUsText.length > 50) {
        const brandVoiceJson = await callOpenAI(brandVoicePrompt(data.aboutUsText, facts));
        brandVoiceData = JSON.parse(brandVoiceJson || "{}");
        console.log("✅ Brand voice analysis:", brandVoiceData);
      } else {
        console.warn("⚠️ No About Us text found, skipping brand voice analysis");
        // Infer brand voice from personality if available
        if (brandIntelligence.brand_personality) {
          const personality = brandIntelligence.brand_personality.toLowerCase();
          if (personality.includes('professional') || personality.includes('premium')) {
            brandVoiceData.brand_voice = "Professional";
          } else if (personality.includes('playful') || personality.includes('friendly')) {
            brandVoiceData.brand_voice = "Playful";
          } else if (personality.includes('minimal')) {
            brandVoiceData.brand_voice = "Minimalist";
          } else if (personality.includes('bold') || personality.includes('confident')) {
            brandVoiceData.brand_voice = "Bold";
          }
        }
        // Use primary value proposition from positioning as core value prop
        if (positioning.primary_value_proposition) {
          brandVoiceData.core_value_prop = positioning.primary_value_proposition.substring(0, 100);
        }
      }
    } catch (e) {
      console.error("Failed to parse brand voice:", e);
      // Continue with empty brand voice data
    }

    const rankedImages = await rankImagesWithAI(
      data.allImages,
      { facts, classification }
    );

    const finalImages =
      rankedImages.length > 0
        ? rankedImages.slice(0, 6)
        : data.allImages.slice(0, 6);

    // Extract primary colors from CSS colors and theme color
    // Create array of primary colors (hex codes) - prioritize theme color, then CSS colors
    const primaryColorsArray: string[] = [];
    if (data.themeColor && /^#[0-9A-Fa-f]{3,6}$/i.test(data.themeColor)) {
      primaryColorsArray.push(data.themeColor);
    }
    // Add unique CSS colors (up to 5 total)
    if (data.cssColors && Array.isArray(data.cssColors)) {
      for (const color of data.cssColors) {
        if (color && /^#[0-9A-Fa-f]{3,6}$/i.test(color) && !primaryColorsArray.includes(color)) {
          primaryColorsArray.push(color);
          if (primaryColorsArray.length >= 5) break;
        }
      }
    }
    
    // Legacy color format for backward compatibility
    const extractedColors = {
      primary: primaryColorsArray[0] || null,
      secondary: primaryColorsArray[1] || null,
      accent: primaryColorsArray[2] || null,
    };

    // Map visual style from API response
    const visualStyle = brandIntelligence.visual_style ? {
      minimalVsDetailed: brandIntelligence.visual_style.minimal_vs_detailed || undefined,
      flatVsRealistic: brandIntelligence.visual_style.flat_vs_realistic || undefined,
      illustrationVsPhotography: brandIntelligence.visual_style.illustration_vs_photography || undefined,
      lightVsDark: brandIntelligence.visual_style.light_vs_dark || undefined,
    } : null;

    // Map typography intent
    const typographyIntent = brandIntelligence.typography_intent ? {
      style: brandIntelligence.typography_intent.style || undefined,
      contrast: brandIntelligence.typography_intent.contrast || undefined,
    } : null;

    // Log logo extraction for debugging
    console.log("🎨 Logo extraction result:", {
      logo: data.logo,
      ogImage: data.ogImage,
      hasLogo: !!data.logo,
    });

    return res.status(200).json({
      result: {
        facts,
        classification,
        positioning,
        competition,
        teardown,
        logo: data.logo || null, // Ensure logo is explicitly set (null if not found)
        logoUrl: data.logoUrl || null, // Original logo URL
        product_images: finalImages,
        brand_assets: [...finalImages, data.logo, data.ogImage].filter(Boolean),
        // Expanded brand intelligence
        colors: extractedColors, // Legacy format
        primaryColors: primaryColorsArray, // New array format
        fontStyles: data.fontStyle || 'sans-serif', // Extracted font style
        brandVoice: brandVoiceData.brand_voice || null, // "Professional" | "Playful" | "Minimalist" | "Bold"
        coreValueProp: brandVoiceData.core_value_prop || positioning.primary_value_proposition || null, // Core value proposition hook
        visualStyle: visualStyle,
        typographyIntent: typographyIntent,
        personality: brandIntelligence.brand_personality || null,
        ctaPatterns: data.ctaPatterns || [],
        productCategory: brandIntelligence.product_category || null,
        pricePositioning: brandIntelligence.price_positioning || null,
        // Brand Kit (Pomeli/Canva-style)
        brand_aesthetic: Array.isArray(brandKit.brand_aesthetic) ? brandKit.brand_aesthetic : [],
        brand_tone: Array.isArray(brandKit.brand_tone) ? brandKit.brand_tone : [],
        brand_values: Array.isArray(brandKit.brand_values) ? brandKit.brand_values : [],
        business_overview: brandKit.business_overview || null,
        tagline: brandKit.tagline || null,
        website_url: data.url || null,
      }
    });
  } catch (e: any) {
    console.error("❌ Brand analysis error:", e);
    console.error("Error stack:", e?.stack);
    console.error("Error message:", e?.message);
    return res.status(500).json({ 
      error: "Analysis failed",
      details: process.env.NODE_ENV === "development" ? e?.message : undefined
    });
  }
}
