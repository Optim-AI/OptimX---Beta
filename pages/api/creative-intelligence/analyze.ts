// pages/api/creative-intelligence/analyze.ts
// Multi-stage Creative Intelligence pipeline: Website → Competitors → Reviews → Hooks

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { db } from "@/database/client";
import {
  creativeIntelligenceRuns,
  creativeIntelligenceBrands,
  creativeIntelligenceCompetitors,
  creativeIntelligenceReviews,
  creativeIntelligenceHooks,
  creativeIntelligenceStrategies,
  creativeIntelligenceMetaAds,
  creativeIntelligenceFacebookPages,
  creativeIntelligenceGoogleRanks,
} from "@/database/schema";
import { eq } from "drizzle-orm";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_VEO_API_KEY;
const SEARCH_API_KEY = process.env.SEARCH_API_KEY || process.env.SERPAPI_KEY;
const META_AD_LIBRARY_TOKEN = process.env.META_AD_LIBRARY_ACCESS_TOKEN;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const config = {
  api: {
    bodyParser: { sizeLimit: "2mb" },
    responseLimit: false,
  },
  maxDuration: 300, // 5 minutes for full pipeline
};

const STEPS = [
  "Analyzing website…",
  "Discovering competitors…",
  "Fetching Meta & Google ad intelligence…",
  "Fetching Facebook & Google rank data…",
  "Mining reviews…",
  "Identifying hooks…",
  "Building strategy…",
];

async function updateProgress(runId: string, step: number, message: string) {
  await db
    .update(creativeIntelligenceRuns)
    .set({
      progressStep: step,
      progressMessage: message,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(creativeIntelligenceRuns.id, runId));
}

/* ---------- Stage 1: Website Analysis ---------- */
function extractSocialUrlsFromDoc(doc: Document, baseUrl: string): { facebook: string | null; instagram: string | null } {
  const result = { facebook: null as string | null, instagram: null as string | null };
  const links = doc.querySelectorAll('a[href]');
  const baseHost = new URL(baseUrl).hostname.replace("www.", "");
  for (const a of links) {
    const href = (a.getAttribute("href") || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    try {
      const full = new URL(href, baseUrl).href;
      const u = new URL(full);
      const host = u.hostname.toLowerCase();
      if (host.includes("facebook.com") || host.includes("fb.com")) {
        const path = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
        if (path[0] && path[0] !== "sharer" && path[0] !== "share" && !result.facebook) {
          result.facebook = full;
        }
      }
      if (host.includes("instagram.com")) {
        const path = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
        if (path[0] && !["p", "reel", "stories", "explore"].includes(path[0]) && !result.instagram) {
          result.instagram = full;
        }
      }
    } catch {
      // skip invalid URLs
    }
  }
  return result;
}

async function fetchPageData(url: string) {
  const resp = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "optimx-brand-bot/1.0" },
  });
  if (!resp.ok) throw new Error("Failed to fetch page");
  const html = await resp.text();
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  let article: any = null;
  try {
    const reader = new Readability(doc as any);
    article = reader.parse();
  } catch {
    // continue without article
  }
  const title = doc.querySelector("title")?.textContent || "";
  const metaDesc =
    doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  const socialUrls = extractSocialUrlsFromDoc(doc, url);
  return {
    title,
    metaDesc,
    text: article?.textContent || "",
    url,
    html,
    socialUrls,
  };
}

/** Safely parse JSON from Gemini - handles markdown blocks, truncation, and malformed output */
function safeParseJson<T = any>(raw: string, fallback: T = {} as T): T {
  if (!raw || typeof raw !== "string") return fallback;
  let s = raw.trim();
  // Strip markdown code blocks
  const jsonMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) s = jsonMatch[1].trim();
  try {
    return JSON.parse(s) as T;
  } catch (e: any) {
    // Try to repair truncated JSON (common when Gemini hits token limit)
    let repaired = s;
    let inString = false;
    let escape = false;
    let quote = "";
    const stack: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\" && inString) {
        escape = true;
        continue;
      }
      if (inString) {
        if (c === quote) inString = false;
        continue;
      }
      if (c === '"' || c === "'") {
        inString = true;
        quote = c;
        continue;
      }
      if (c === "{") stack.push("}");
      else if (c === "[") stack.push("]");
      else if (c === "}" || c === "]") stack.pop();
    }
    // If we ended inside a string, close it
    if (inString) repaired = s + quote;
    repaired += stack.reverse().join("");
    try {
      return JSON.parse(repaired) as T;
    } catch {
      console.warn("JSON parse failed (likely truncated), using fallback:", (e as Error)?.message);
      return fallback;
    }
  }
}

async function callGemini(prompt: string, systemInstruction?: string, maxTokens = 8192): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
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
          temperature: 0.2,
          maxOutputTokens: maxTokens,
          responseMimeType: "application/json",
        },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${err}`);
  }
  const j = await res.json();
  const text =
    j.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return text;
}

/* ---------- Context & Competitor Discovery ---------- */
const AMBIGUOUS_BRAND_WORDS = new Set([
  "boat", "apple", "orange", "nothing", "noise", "real", "one", "true", "pure", "simple",
  "basic", "prime", "core", "peak", "bolt", "spark", "nova", "pixel", "nest", "echo",
]);

type BrandContext = {
  brand_name: string;
  domain_name: string;
  industry_category: string;
  product_category: string;
  primary_keywords: string[];
  country: string;
  price_positioning?: string;
  is_ambiguous_brand?: boolean;
  official_facebook_url?: string | null;
  official_instagram_url?: string | null;
};

function buildContextualQueries(ctx: BrandContext): string[] {
  const { brand_name, domain_name, industry_category, product_category, country, is_ambiguous_brand } = ctx;
  const industry = industry_category || "this industry";
  const product = product_category || "products";
  const loc = country ? ` in ${country}` : "";

  if (is_ambiguous_brand) {
    return [
      `${domain_name} ${product} competitors${loc}`,
      `brands similar to ${domain_name} ${product}`,
      `top ${product} brands${loc}`,
      `best ${product} under 5000${loc}`,
      `${industry} brands like ${domain_name}`,
    ];
  }
  return [
    `${brand_name} ${product} competitors${loc}`,
    `${domain_name} ${product} alternatives${loc}`,
    `top ${product} brands${loc}`,
    `best ${product}${loc}`,
    `brands similar to ${brand_name} ${product}`,
  ];
}

async function searchWithContextualQueries(
  ctx: BrandContext,
  searchApiKey: string | undefined
): Promise<any[]> {
  if (!searchApiKey) return [];
  const queries = buildContextualQueries(ctx);
  const seen = new Set<string>();
  const results: any[] = [];
  const brandDomainNorm = ctx.domain_name?.replace("www.", "").toLowerCase() || "";
  for (const q of queries) {
    if (!q?.trim()) continue;
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(q)}&api_key=${searchApiKey}&num=8`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const organic = data.organic_results || [];
      for (const r of organic) {
        if (!r.link) continue;
        try {
          const host = new URL(r.link).hostname.replace("www.", "").toLowerCase();
          if (seen.has(host)) continue;
          if (host === brandDomainNorm || host.endsWith("." + brandDomainNorm)) continue;
          seen.add(host);
          results.push({
            domain: host,
            title: r.title,
            snippet: r.snippet,
            url: r.link,
          });
        } catch {
          // skip invalid URLs
        }
      }
    } catch (e) {
      console.warn("Search API error:", e);
    }
  }
  return results.slice(0, 15);
}

async function classifyIndustryRelevance(
  candidate: { domain: string; title?: string; snippet?: string },
  ctx: BrandContext,
  geminiKey: string | undefined
): Promise<"Relevant" | "Possibly Relevant" | "Irrelevant"> {
  if (!geminiKey) return "Possibly Relevant";
  const prompt = `Classify whether this company belongs to the same industry. Return JSON: {"classification":"Relevant"|"Possibly Relevant"|"Irrelevant"}

Industry: ${ctx.industry_category || "unknown"}
Product Category: ${ctx.product_category || "unknown"}

Candidate:
- Domain: ${candidate.domain}
- Title: ${(candidate.title || "").slice(0, 100)}
- Snippet: ${(candidate.snippet || "").slice(0, 200)}`;
  try {
    const raw = await callGemini(prompt, "Return ONLY valid JSON with classification field.", 64);
    const parsed = safeParseJson<{ classification?: string }>(raw, {});
    const v = (parsed.classification || raw || "").toLowerCase();
    if (v.includes("irrelevant")) return "Irrelevant";
    if (v.includes("possibly")) return "Possibly Relevant";
    if (v.includes("relevant")) return "Relevant";
  } catch (e) {
    console.warn("Classifier error:", e);
  }
  return "Possibly Relevant";
}

function getIndustryKeywords(ctx: BrandContext): string[] {
  const industry = (ctx.industry_category || "").toLowerCase();
  const product = (ctx.product_category || "").toLowerCase();
  const keywords: string[] = [];
  const all = `${industry} ${product}`.toLowerCase();
  for (const w of ["earbuds", "audio", "bluetooth", "electronics", "headphone", "speaker", "wireless", "anc", "sound", "earphones", "tech", "gadget", "device"]) {
    if (all.includes(w)) keywords.push(w);
  }
  if (keywords.length === 0) {
    keywords.push(...product.split(/\s+/).filter((s) => s.length > 3).slice(0, 5));
  }
  if (keywords.length === 0) {
    keywords.push(...industry.split(/\s+/).filter((s) => s.length > 3).slice(0, 5));
  }
  return keywords.length > 0 ? keywords : ["product", "brand"];
}

async function domainKeywordValidation(
  candidate: { domain: string; url?: string; title?: string; snippet?: string },
  keywords: string[]
): Promise<{ score: number; relevant: boolean }> {
  let combined = [candidate.title || "", candidate.snippet || ""].join(" ").toLowerCase();
  try {
    const url = candidate.url || `https://${candidate.domain}`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "optimx-brand-bot/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (resp.ok) {
      const html = await resp.text();
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      const title = doc.querySelector("title")?.textContent || "";
      const meta = doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
      combined = [combined, title, meta].join(" ").toLowerCase();
    }
  } catch {
    // use snippet/title only
  }
  let matches = 0;
  for (const kw of keywords) {
    if (combined.includes(kw)) matches++;
  }
  const score = keywords.length > 0 ? Math.round((matches / keywords.length) * 100) : 50;
  const relevant = score >= 20 || matches >= 1;
  return { score, relevant };
}

/* ---------- Stage 2b: Meta Ad Library ---------- */
const META_GRAPH_VERSION = "v25.0";
const META_ADS_ARCHIVE_FIELDS = "id,page_id,page_name,ad_creative_bodies,ad_snapshot_url,publisher_platforms";

/** Fetch ads via Meta Graph API (ads_archive) - preferred when META_AD_LIBRARY_ACCESS_TOKEN is set */
async function fetchMetaAdLibraryAdsViaGraphAPI(
  options: {
    pageIds?: string[];
    contextualKeywords?: string[];
    accessToken: string;
    adReachedCountries?: string[];
  }
): Promise<any[]> {
  const { pageIds = [], contextualKeywords = [], accessToken, adReachedCountries = ["IN", "US"] } = options;
  const allAds: any[] = [];
  const seenIds = new Set<string>();

  const normalizeAd = (ad: any, searchKeyword: string) => {
    const bodyText = Array.isArray(ad.ad_creative_bodies)
      ? (ad.ad_creative_bodies[0] || "").slice(0, 2000)
      : "";
    const id = ad.id || `${ad.page_id}-${bodyText.slice(0, 50)}`;
    if (seenIds.has(id)) return null;
    seenIds.add(id);
    return {
      search_keyword: searchKeyword,
      page_name: ad.page_name || null,
      page_id: ad.page_id || null,
      body_text: bodyText,
      cta_text: null,
      cta_type: null,
      display_format: null,
      platforms: ad.publisher_platforms || [],
      image_url: ad.ad_snapshot_url || null,
      raw_data: ad,
    };
  };

  for (const pageId of pageIds.slice(0, 5)) {
    if (!pageId?.trim()) continue;
    try {
      const params = new URLSearchParams({
        search_page_ids: JSON.stringify([pageId]),
        ad_reached_countries: JSON.stringify(adReachedCountries),
        ad_active_status: "ACTIVE",
        ad_type: "ALL",
        access_token: accessToken,
        fields: META_ADS_ARCHIVE_FIELDS,
      });
      const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive?${params}`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.text();
        console.warn("Meta Ad Library (page_id) API error:", res.status, err);
        continue;
      }
      const data = await res.json();
      for (const ad of (data.data || []).slice(0, 8)) {
        const normalized = normalizeAd(ad, `page:${pageId}`);
        if (normalized) allAds.push(normalized);
      }
    } catch (e) {
      console.warn("Meta Ad Library (page_id) fetch error:", e);
    }
  }

  if (allAds.length < 5 && contextualKeywords.length > 0) {
    for (const kw of contextualKeywords.slice(0, 3)) {
      if (!kw?.trim()) continue;
      try {
        const params = new URLSearchParams({
          search_terms: kw.trim().slice(0, 100),
          ad_reached_countries: JSON.stringify(adReachedCountries),
          ad_active_status: "ACTIVE",
          ad_type: "ALL",
          access_token: accessToken,
          fields: META_ADS_ARCHIVE_FIELDS,
        });
        const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/ads_archive?${params}`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        for (const ad of (data.data || []).slice(0, 8)) {
          const normalized = normalizeAd(ad, kw.trim());
          if (normalized) allAds.push(normalized);
        }
      } catch (e) {
        console.warn("Meta Ad Library (keyword) fetch error:", e);
      }
    }
  }

  return allAds.slice(0, 25);
}

/** Fetch ads via SearchAPI (fallback when Meta token not set or fails) */
async function fetchMetaAdLibraryAdsViaSearchAPI(
  options: {
    pageIds?: string[];
    contextualKeywords?: string[];
    searchApiKey: string | undefined;
  }
): Promise<any[]> {
  const { pageIds = [], contextualKeywords = [], searchApiKey } = options;
  if (!searchApiKey) return [];
  const allAds: any[] = [];
  const seenIds = new Set<string>();

  const addAdsFromResponse = (ads: any[], searchKeyword: string) => {
    for (const ad of ads.slice(0, 8)) {
      const id = ad.ad_archive_id || ad.page_id + "-" + (ad.snapshot?.body?.text?.slice(0, 50) || "");
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      const snapshot = ad.snapshot || {};
      const bodyText = snapshot.body?.text || "";
      const firstImage = snapshot.images?.[0]?.resized_image_url || snapshot.images?.[0]?.original_image_url
        || snapshot.cards?.[0]?.resized_image_url || snapshot.cards?.[0]?.original_image_url;
      allAds.push({
        search_keyword: searchKeyword,
        page_name: ad.page_name || snapshot.page_name,
        page_id: ad.page_id || snapshot.page_id,
        body_text: bodyText.slice(0, 2000),
        cta_text: snapshot.cta_text,
        cta_type: snapshot.cta_type,
        display_format: snapshot.display_format,
        platforms: ad.publisher_platform || [],
        image_url: firstImage,
        raw_data: ad,
      });
    }
  };

  for (const pageId of pageIds.slice(0, 3)) {
    if (!pageId?.trim()) continue;
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=meta_ad_library&page_id=${encodeURIComponent(pageId)}&api_key=${searchApiKey}&sort_by=impressions_high_to_low`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      addAdsFromResponse(data.ads || [], `page:${pageId}`);
    } catch (e) {
      console.warn("Meta Ad Library (page_id) fetch error:", e);
    }
  }

  if (allAds.length < 5 && contextualKeywords.length > 0) {
    for (const kw of contextualKeywords.slice(0, 3)) {
      if (!kw?.trim()) continue;
      try {
        const url = `https://www.searchapi.io/api/v1/search?engine=meta_ad_library&q=${encodeURIComponent(kw.trim())}&api_key=${searchApiKey}&sort_by=impressions_high_to_low`;
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        addAdsFromResponse(data.ads || [], kw.trim());
      } catch (e) {
        console.warn("Meta Ad Library (keyword) fetch error:", e);
      }
    }
  }

  return allAds.slice(0, 25);
}

/** Unified Meta Ad Library fetch: prefers Graph API when token set, falls back to SearchAPI */
async function fetchMetaAdLibraryAds(
  options: {
    pageIds?: string[];
    contextualKeywords?: string[];
    searchApiKey: string | undefined;
  }
): Promise<any[]> {
  const { pageIds = [], contextualKeywords = [], searchApiKey } = options;

  if (META_AD_LIBRARY_TOKEN) {
    try {
      const ads = await fetchMetaAdLibraryAdsViaGraphAPI({
        pageIds,
        contextualKeywords,
        accessToken: META_AD_LIBRARY_TOKEN,
      });
      if (ads.length > 0) return ads;
    } catch (e) {
      console.warn("Meta Ad Library (Graph API) failed, falling back to SearchAPI:", e);
    }
  }

  return fetchMetaAdLibraryAdsViaSearchAPI({
    pageIds,
    contextualKeywords,
    searchApiKey,
  });
}

/* ---------- Stage 2c: Facebook Business Page (via SearchAPI) ---------- */
function extractPageIdFromFacebookUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "").split("/").filter(Boolean);
    if (path[0] === "pages" && path[2]) return path[2];
    if (/^\d+$/.test(path[0])) return path[0];
    return null;
  } catch {
    return null;
  }
}

async function searchFacebookPages(
  query: string,
  searchApiKey: string | undefined
): Promise<string | null> {
  if (!searchApiKey) return null;
  try {
    const url = `https://www.searchapi.io/api/v1/search?engine=meta_ad_library_page_search&q=${encodeURIComponent(query)}&api_key=${searchApiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data.page_results || [];
    const first = pages[0];
    return first?.page_id || null;
  } catch (e) {
    console.warn("Meta Ad Library Page Search error:", e);
    return null;
  }
}

async function fetchFacebookBusinessPage(
  pageId: string,
  searchApiKey: string | undefined
): Promise<any | null> {
  if (!searchApiKey) return null;
  try {
    const url = `https://www.searchapi.io/api/v1/search?engine=facebook_business_page&page_id=${encodeURIComponent(pageId)}&api_key=${searchApiKey}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const page = data.page || {};
    const about = data.about || {};
    return {
      page_id: page.id,
      page_name: page.name,
      page_link: page.link,
      followers_count: page.followers?.count ?? null,
      following_count: page.following?.count ?? null,
      category: about.category,
      address: about.address,
      phone: about.phone,
      website: about.website,
      ratings: about.ratings,
      rating: about.rating,
      reviews_count: about.reviews_count,
      price_range: about.price_range,
      profile_photo_url: page.profile_photo_original || page.profile_photo_link,
      raw_data: { page, about },
    };
  } catch (e) {
    console.warn("Facebook Business Page fetch error:", e);
    return null;
  }
}

async function fetchFacebookPagesForBrandAndCompetitors(
  ctx: BrandContext,
  competitorNames: string[],
  searchApiKey: string | undefined
): Promise<{ brand: any; competitors: any[] }> {
  const result = { brand: null as any, competitors: [] as any[] };
  if (!searchApiKey) return result;

  let brandPageId: string | null = null;
  if (ctx.official_facebook_url) {
    brandPageId = extractPageIdFromFacebookUrl(ctx.official_facebook_url);
  }
  if (!brandPageId) {
    const searchQuery = ctx.is_ambiguous_brand
      ? `${ctx.domain_name} ${ctx.product_category || ""}`.trim() || ctx.brand_name
      : ctx.brand_name;
    brandPageId = await searchFacebookPages(searchQuery, searchApiKey);
  }
  if (brandPageId) {
    result.brand = await fetchFacebookBusinessPage(brandPageId, searchApiKey);
    if (result.brand) result.brand.entity_name = ctx.brand_name;
  }

  for (const name of competitorNames.slice(0, 5)) {
    const pageId = await searchFacebookPages(name, searchApiKey);
    if (pageId) {
      const fb = await fetchFacebookBusinessPage(pageId, searchApiKey);
      if (fb) {
        fb.entity_name = name;
        result.competitors.push(fb);
      }
    }
  }
  return result;
}

/* ---------- Stage 2d: Google Rank Tracking (via SearchAPI) ---------- */
async function fetchGoogleRankTracking(
  queries: string[],
  brandDomain: string,
  competitorDomains: string[],
  searchApiKey: string | undefined
): Promise<any[]> {
  if (!searchApiKey) return [];
  const results: any[] = [];
  for (const q of queries.slice(0, 5)) {
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=google_rank_tracking&q=${encodeURIComponent(q)}&api_key=${searchApiKey}&num=30`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const organic = data.organic_results || [];
      let brandPosition: number | null = null;
      const competitorRanks: any[] = [];
      const brandDomainNorm = brandDomain?.replace("www.", "").toLowerCase() || "";
      const compDomainsNorm = competitorDomains.map((d) => d.replace("www.", "").toLowerCase());
      for (const r of organic) {
        let domain = "";
        try {
          domain = (r.domain?.replace("www.", "") || (r.link ? new URL(r.link).hostname : "")).toLowerCase();
        } catch {
          domain = (r.domain || "").toLowerCase();
        }
        if (!domain) continue;
        if (brandDomainNorm && (domain === brandDomainNorm || domain.endsWith("." + brandDomainNorm))) {
          brandPosition = r.position ?? organic.indexOf(r) + 1;
        }
        for (const cd of compDomainsNorm) {
          if (domain === cd || domain.endsWith("." + cd)) {
            competitorRanks.push({
              domain: cd,
              position: r.position ?? organic.indexOf(r) + 1,
              title: r.title,
              link: r.link,
            });
            break;
          }
        }
      }
      results.push({
        search_query: q,
        brand_domain: brandDomain,
        brand_position: brandPosition,
        competitor_ranks: competitorRanks,
        organic_results: organic.slice(0, 10),
      });
    } catch (e) {
      console.warn("Google Rank Tracking error:", e);
    }
  }
  return results;
}

/* ---------- Stage 3: Review Mining (via search + Gemini) ---------- */
async function mineReviews(
  ctx: BrandContext,
  searchApiKey: string | undefined
): Promise<any> {
  let reviewSnippets: string[] = [];
  if (searchApiKey) {
    const query = ctx.is_ambiguous_brand
      ? `${ctx.domain_name} ${ctx.product_category || ""} reviews`.trim()
      : `${ctx.brand_name} ${ctx.product_category || ""} reviews`.trim();
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(query)}&api_key=${searchApiKey}&num=10`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const organic = data.organic_results || [];
        reviewSnippets = organic
          .map((r: any) => r.snippet)
          .filter(Boolean)
          .slice(0, 15);
      }
    } catch (e) {
      console.warn("Review search error:", e);
    }
  }
  const combined = reviewSnippets.join("\n\n") || `No review snippets found for ${ctx.brand_name}. Infer common pain points and desired outcomes for ${ctx.industry_category || "this"} industry.`;
  const prompt = `You are a customer insight analyst. Cluster reviews into structured sentiment. No fluff. Return JSON only.

Brand: ${ctx.brand_name}
Industry: ${ctx.industry_category || "general"}
Product: ${ctx.product_category || "unknown"}

Review snippets:
${combined}

Return JSON (STEP 3 — CUSTOMER SENTIMENT MINING):
{
  "top_pain_points": [{"label":"...","frequency_percentage":0-100,"sample_quote":"...","sentiment_intensity_score":1-10}],
  "top_desired_outcomes": [{"label":"...","frequency_percentage":0-100,"sample_quote":"...","sentiment_intensity_score":1-10}],
  "common_complaints": [{"label":"...","frequency_percentage":0-100,"sample_quote":"..."}],
  "emotional_triggers": [{"label":"...","frequency_percentage":0-100}],
  "repeated_phrases": ["phrase1", "phrase2"],
  "pain_points": [{"label":"...","frequency_pct":0-100,"sample_phrases":["..."]}],
  "desired_outcomes": [{"label":"...","frequency_pct":0-100,"sample_phrases":["..."]}],
  "emotional_patterns": [{"label":"...","frequency_pct":0-100}],
  "complaints": [{"label":"...","frequency_pct":0-100}]
}

Rank by frequency. Include both formats for compatibility. If no real data, infer plausible patterns.`;
  const raw = await callGemini(prompt, "Return ONLY valid JSON.");
  return safeParseJson(raw, {});
}

const CREATIVE_INTELLIGENCE_SYSTEM = `You are the Creative Intelligence Engine. Your job is NOT to generate generic marketing ideas.
You must: Analyze brands, discover competitors, mine customer sentiment, detect positioning patterns, identify gaps, generate ranked hooks, build campaign strategy.
Behave like: A senior creative strategist, performance marketer, competitive analyst, conversion-focused CMO.
All outputs must be structured, analytical, evidence-backed. Never write fluffy essays. Return structured JSON only.`;

/* ---------- Stage 4: Market Gap + Hook Engine (Steps 4, 5, 6) ---------- */
async function generateHooks(
  brandSummary: any,
  competitors: any[],
  competitorAnalysis: any,
  reviewClusters: any,
  metaAds: any[] = [],
  facebookPages: { brand: any; competitors: any[] } = { brand: null, competitors: [] },
  googleRanks: any[] = [],
  userPrefs: { toneEmotional?: number; campaignGoal?: string } = {}
): Promise<{ hooks: any[]; strategies: any }> {
  const metaAdSummary = metaAds.length > 0
    ? metaAds.slice(0, 15).map((a) => ({
        page: a.page_name,
        search: a.search_keyword,
        body: (a.body_text || "").slice(0, 300),
        cta: a.cta_text,
        format: a.display_format,
        platforms: a.platforms,
      }))
    : [];
  const fbSummary = facebookPages.brand
    ? { brand: { name: facebookPages.brand.page_name, followers: facebookPages.brand.followers_count, category: facebookPages.brand.category, ratings: facebookPages.brand.ratings, reviews_count: facebookPages.brand.reviews_count } }
    : {};
  const fbCompSummary = facebookPages.competitors.length > 0
    ? facebookPages.competitors.map((c) => ({ name: c.page_name, followers: c.followers_count, category: c.category, ratings: c.ratings }))
    : [];
  const rankSummary = googleRanks.length > 0
    ? googleRanks.map((r) => ({ query: r.search_query, brand_position: r.brand_position, competitor_ranks: r.competitor_ranks }))
    : [];
  const toneHint = userPrefs.toneEmotional != null
    ? (userPrefs.toneEmotional > 0.6 ? "Lean emotional: aspiration, identity, feeling." : userPrefs.toneEmotional < 0.4 ? "Lean performance: numbers, proof, outcome, efficiency." : "Blend emotional and performance. Keep clarity.")
    : "";

  const prompt = `${CREATIVE_INTELLIGENCE_SYSTEM}

BRAND:
${JSON.stringify(brandSummary, null, 2)}

COMPETITORS:
${JSON.stringify(competitors.slice(0, 5), null, 2)}

COMPETITOR ANALYSIS (overused angles, saturated hooks, positioning clusters):
${JSON.stringify(competitorAnalysis, null, 2)}

REVIEW INSIGHTS:
${JSON.stringify(reviewClusters, null, 2)}

META AD LIBRARY:
${metaAdSummary.length > 0 ? JSON.stringify(metaAdSummary, null, 2) : "No Meta ad data."}

FACEBOOK PAGES:
${facebookPages.brand || facebookPages.competitors.length > 0 ? JSON.stringify({ brand: fbSummary.brand, competitors: fbCompSummary }, null, 2) : "No Facebook data."}

GOOGLE RANK TRACKING:
${rankSummary.length > 0 ? JSON.stringify(rankSummary, null, 2) : "No rank data."}

TONE PREFERENCE: ${toneHint || "Balanced."}
CAMPAIGN GOAL: ${userPrefs.campaignGoal || "Conversions"}

CRITICAL — ACT AS AN AI AD ANALYST:
- strategy_snapshot: Synthesize from ALL data (reviews, competitors, Meta ads, hooks). Be SPECIFIC to this brand. No generic phrases.
- ad_format_recommendations: Score each format 0-100 based on: what competitors use in Meta Ad Library, what fits this product/audience, review sentiment, platform best practices. Scores must sum to a logical distribution (not all 70s). Include brief reasoning per format.

Return JSON with STEPS 4, 5, 6:

{
  "strategy_snapshot": {
    "market_gap": "1-2 sentences. Specific gap this brand can own. Reference real competitor/review signals.",
    "winning_angle": "1-2 sentences. The single best hook/angle for this brand. Not generic.",
    "best_creative_direction": "1-2 sentences. Tone, style, visual direction. Specific to product and audience.",
    "recommended_ad_format": "Primary format: Short video|UGC|Static poster|Carousel. Plus 1 sentence why."
  },
  "ad_format_recommendations": [
    {"format": "Short Video Ads", "score": 0-100, "reasoning": "Why this score for THIS brand"},
    {"format": "UGC Style Ads", "score": 0-100, "reasoning": "Why"},
    {"format": "Static Posters", "score": 0-100, "reasoning": "Why"},
    {"format": "Carousel Ads", "score": 0-100, "reasoning": "Why"}
  ],
  "market_gap_analysis": [
    {
      "opportunity_statement": "string",
      "why_it_exists": "string",
      "supporting_review_signal": "string",
      "competitor_overlap_level": "high|medium|low",
      "confidence_score": 0-100
    }
  ],
  "underserved_angles": ["angle1", "angle2"],
  "white_space_opportunities": ["opp1", "opp2"],
  "differentiation_map": {"axis1":"position"},
  "hooks": [
    {
      "hook_statement": "Scroll-stopping hook, max 15 words. No generic phrases.",
      "hook_type": "emotional|functional|contrarian|urgency",
      "supporting_evidence": "Review quote or competitor weakness",
      "saturation_score": 0-100,
      "opportunity_score": 0-100,
      "overall_rank": 1-11,
      "why_it_works": "Brief rationale",
      "competitor_overlap_level": "high|moderate|low",
      "confidence_score": 0-100
    }
  ],
  "campaign_blueprints": [
    {
      "hook_rank": 1,
      "recommended_platform": "Instagram|Meta|TikTok|Google|LinkedIn",
      "target_audience_segment": "string",
      "ad_format": "static|carousel|reel|story|UGC",
      "emotional_tone_direction": "string",
      "messaging_focus": "string",
      "cta_strategy": "string",
      "test_variations": ["var1", "var2"]
    }
  ]
}

Generate 11 hooks: 5 high-conversion + 3 emotional + 3 performance-driven. Include campaign_blueprints for top 3 ranked hooks. Be specific and data-backed.`;
  const raw = await callGemini(prompt, "Return ONLY valid JSON.", 16384);
  const parsed = safeParseJson(raw, {}) as any;
  const hooks = (parsed.hooks || []).slice(0, 11).map((h: any, i: number) => ({
    hook_statement: h.hook_statement || "",
    hook_type: h.hook_type || "functional",
    why_it_works: h.why_it_works || "",
    supporting_review_phrase: h.supporting_evidence || h.supporting_review_phrase || "",
    competitor_overlap_level: h.competitor_overlap_level || "moderate",
    confidence_score: h.confidence_score ?? h.opportunity_score ?? 70,
    saturation_score: h.saturation_score,
    opportunity_score: h.opportunity_score,
    ...h,
    rank: i + 1,
  }));
  return {
    hooks,
    strategies: {
      strategy_snapshot: parsed.strategy_snapshot || null,
      ad_format_recommendations: parsed.ad_format_recommendations || [],
      market_gap_analysis: parsed.market_gap_analysis || [],
      underserved_angles: parsed.underserved_angles || [],
      white_space_opportunities: parsed.white_space_opportunities || [],
      differentiation_map: parsed.differentiation_map || {},
      campaign_blueprints: parsed.campaign_blueprints || [],
    },
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const {
    brandUrl,
    competitorUrls = [],
    industry,
    targetAudience,
    campaignGoal,
    advancedSettings = {},
  } = req.body;

  if (!brandUrl || typeof brandUrl !== "string") {
    return res.status(400).json({ ok: false, error: "Brand URL is required" });
  }

  try {
    new URL(brandUrl);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid brand URL" });
  }

  let runId: string | undefined;

  try {
    const [run] = await db
      .insert(creativeIntelligenceRuns)
      .values({
        userId,
        brandUrl,
        competitorUrls: Array.isArray(competitorUrls) ? competitorUrls : [],
        industry: industry || null,
        targetAudience: targetAudience || null,
        campaignGoal: campaignGoal || null,
        advancedSettings,
        status: "running",
        progressStep: 0,
        progressMessage: STEPS[0],
      })
      .returning();
    if (!run) throw new Error("Failed to create run");
    runId = run.id;

    // Stage 1: Website Analysis
    await updateProgress(runId, 1, STEPS[0]);
    const pageData = await fetchPageData(brandUrl);
    const brandDomain = new URL(brandUrl).hostname.replace("www.", "");
    const brandName =
      brandDomain.split(".")[0].charAt(0).toUpperCase() + brandDomain.split(".")[0].slice(1);

    const stage1Prompt = `You are a senior creative strategist. Extract structured brand intelligence from this website. CRITICAL: Extract industry_category and product_category accurately - these lock competitor search to the correct industry. No fluff. Return structured JSON only.

URL: ${brandUrl}
TITLE: ${pageData.title}
META: ${pageData.metaDesc}

PAGE CONTENT:
${pageData.text.slice(0, 8000)}

Return JSON (STEP 1 — BRAND EXTRACTION):
{
  "product_name": "string",
  "industry_category": "e.g. consumer audio electronics, SaaS, D2C fashion",
  "product_category": "e.g. bluetooth earphones and headphones, project management software",
  "primary_keywords": ["keyword1", "keyword2", "keyword3"],
  "country": "e.g. India, USA, global",
  "core_problem_solved": "string",
  "primary_target_audience": "string",
  "key_benefits": ["benefit1", "benefit2", "benefit3", "benefit4", "benefit5"],
  "feature_list": ["feature1", "feature2", "..."],
  "pricing_positioning": "budget|mid|premium|unknown",
  "brand_tone": "clinical|playful|luxury|aggressive|minimalist|etc",
  "current_positioning_statement": "1-2 lines",
  "product_summary": "2-3 sentence summary",
  "positioning_statement": "One sentence positioning",
  "core_pains_addressed": ["pain1", "pain2", "pain3"],
  "emotional_tone": "Professional|Playful|Bold|Minimalist|etc",
  "target_persona_guess": "Who is the ideal customer",
  "is_ambiguous_brand": false,
  "products": [
    {
      "product_name": "string",
      "price": "e.g. $29.99 or null if unknown",
      "description": "1-2 sentence product description",
      "key_benefits": ["benefit1", "benefit2"],
      "product_images": [],
      "target_audience": "Who this product is for",
      "emotional_angles": ["angle1", "angle2"],
      "use_cases": ["use case 1", "use case 2"],
      "short_benefit": "One line benefit summary",
      "category": "e.g. electronics, skincare, software"
    }
  ]
}

If brand_name is a common dictionary word (boat, apple, orange, nothing, noise, etc), set is_ambiguous_brand to true.`;
    const stage1Raw = await callGemini(stage1Prompt, "Return ONLY valid JSON.");
    const brandAnalysis = safeParseJson(stage1Raw, {}) as any;

    const brandContext: BrandContext = {
      brand_name: brandName,
      domain_name: brandDomain,
      industry_category: brandAnalysis.industry_category || industry || "",
      product_category: brandAnalysis.product_category || brandAnalysis.product_name || "",
      primary_keywords: Array.isArray(brandAnalysis.primary_keywords) ? brandAnalysis.primary_keywords : [],
      country: brandAnalysis.country || "",
      price_positioning: brandAnalysis.pricing_positioning,
      is_ambiguous_brand: brandAnalysis.is_ambiguous_brand ?? AMBIGUOUS_BRAND_WORDS.has(brandName.toLowerCase()),
      official_facebook_url: (pageData as any).socialUrls?.facebook || null,
      official_instagram_url: (pageData as any).socialUrls?.instagram || null,
    };

    await db.insert(creativeIntelligenceBrands).values({
      runId,
      productSummary: brandAnalysis.product_summary || null,
      positioningStatement: brandAnalysis.positioning_statement || null,
      corePainsAddressed: brandAnalysis.core_pains_addressed || [],
      emotionalTone: brandAnalysis.emotional_tone || null,
      targetPersonaGuess: brandAnalysis.target_persona_guess || null,
      rawAnalysis: { ...brandAnalysis, ...brandContext },
      products: Array.isArray(brandAnalysis.products) ? brandAnalysis.products : [],
    });

    // Stage 2: Contextual Competitor Discovery (Context → Query → Classify → Validate → Store)
    await updateProgress(runId, 2, STEPS[1]);
    let searchResults = await searchWithContextualQueries(brandContext, SEARCH_API_KEY);

    const industryKeywords = getIndustryKeywords(brandContext);
    const filtered: any[] = [];
    for (const r of searchResults) {
      const classification = await classifyIndustryRelevance(r, brandContext, GEMINI_API_KEY);
      if (classification === "Irrelevant") continue;
      const { score: keywordScore, relevant } = await domainKeywordValidation(r, industryKeywords);
      if (!relevant && classification === "Possibly Relevant") continue;
      const relevanceScore = classification === "Relevant" ? 90 : 60;
      filtered.push({
        ...r,
        relevance_score: Math.round((relevanceScore + keywordScore) / 2),
        industry_match_confidence: classification,
        keyword_overlap_score: keywordScore,
      });
    }

    if (filtered.length < 3) {
      const fallbackQuery = `top ${brandContext.product_category || brandContext.industry_category || "brands"} brands ${brandContext.country ? `in ${brandContext.country}` : ""}`.trim();
      const fallbackResults = SEARCH_API_KEY
        ? await (async () => {
            try {
              const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(fallbackQuery)}&api_key=${SEARCH_API_KEY}&num=10`;
              const res = await fetch(url);
              if (!res.ok) return [];
              const data = await res.json();
              const organic = data.organic_results || [];
              const seen = new Set(filtered.map((f) => f.domain));
              return organic
                .filter((r: any) => r.link)
                .map((r: any) => {
                  try {
                    const host = new URL(r.link).hostname.replace("www.", "").toLowerCase();
                    if (seen.has(host)) return null;
                    seen.add(host);
                    return { domain: host, title: r.title, snippet: r.snippet, url: r.link };
                  } catch {
                    return null;
                  }
                })
                .filter(Boolean);
            } catch {
              return [];
            }
          })()
        : [];
      for (const r of fallbackResults) {
        if (filtered.length >= 5) break;
        const classification = await classifyIndustryRelevance(r, brandContext, GEMINI_API_KEY);
        if (classification === "Irrelevant") continue;
        const { score: keywordScore, relevant } = await domainKeywordValidation(r, industryKeywords);
        if (!relevant && classification === "Possibly Relevant") continue;
        filtered.push({
          ...r,
          relevance_score: classification === "Relevant" ? 85 : 55,
          industry_match_confidence: classification,
          keyword_overlap_score: keywordScore,
        });
      }
    }

    const competitorData: any[] = [];
    for (let i = 0; i < Math.min(5, filtered.length); i++) {
      const r = filtered[i];
      let positioning = r.snippet || "";
      try {
        const compResp = await fetch(r.url || `https://${r.domain}`, {
          headers: { "User-Agent": "optimx-brand-bot/1.0" },
          signal: AbortSignal.timeout(8000),
        });
        if (compResp.ok) {
          const html = await compResp.text();
          const dom = new JSDOM(html);
          const title = dom.window.document.querySelector("title")?.textContent || "";
          const meta = dom.window.document
            .querySelector('meta[name="description"]')
            ?.getAttribute("content") || "";
          positioning = [title, meta, r.snippet].filter(Boolean).join(" ");
        }
      } catch {
        // use snippet only
      }
      const saturation = i < 2 ? "high" : i < 4 ? "moderate" : "low";
      competitorData.push({
        name: r.title?.split(" - ")[0] || r.domain,
        domain: r.domain,
        core_positioning: positioning.slice(0, 500),
        primary_hook: r.snippet?.slice(0, 100) || null,
        pricing_tier: null,
        weakness_detected: null,
        saturation_level: saturation,
        relevance_score: r.relevance_score,
        industry_match_confidence: r.industry_match_confidence,
        keyword_overlap_score: r.keyword_overlap_score,
      });
      await db.insert(creativeIntelligenceCompetitors).values({
        runId,
        name: r.title?.split(" - ")[0] || r.domain,
        domain: r.domain,
        corePositioning: positioning.slice(0, 500),
        primaryHook: r.snippet?.slice(0, 100) || null,
        saturationLevel: saturation,
        relevanceScore: r.relevance_score ?? null,
        industryMatchConfidence: r.industry_match_confidence ?? null,
        keywordOverlapScore: r.keyword_overlap_score ?? null,
        rawData: r,
      });
    }

    // Stage 2a: Competitor Analysis (structured extraction)
    let competitorAnalysis: any = {};
    if (competitorData.length > 0) {
      const compPrompt = `You are a competitive analyst. Analyze these competitor snippets. No fluff. Return structured JSON only.

COMPETITORS (name, domain, snippet/positioning):
${competitorData.map((c) => `- ${c.name || c.domain}: ${(c.core_positioning || "").slice(0, 400)}`).join("\n")}

Return JSON (STEP 2 — COMPETITOR ANALYSIS):
{
  "competitors": [
    {
      "competitor_name": "string",
      "core_positioning": "string",
      "primary_hook_used": "string",
      "pricing_tier": "budget|mid|premium|unknown",
      "dominant_emotional_angle": "string",
      "weaknesses_detected": "string"
    }
  ],
  "overused_market_angles": ["angle1", "angle2"],
  "saturated_hooks": ["hook1", "hook2"],
  "common_messaging_patterns": ["pattern1", "pattern2"],
  "positioning_clusters": {"cluster_name": ["competitor1", "competitor2"]}
}`;
      try {
        const compRaw = await callGemini(compPrompt, "Return ONLY valid JSON.");
        competitorAnalysis = safeParseJson(compRaw, {}) as any;
        if (competitorAnalysis.competitors) {
          for (let i = 0; i < Math.min(competitorData.length, competitorAnalysis.competitors.length); i++) {
            const ca = competitorAnalysis.competitors[i];
            if (ca?.weaknesses_detected) competitorData[i].weakness_detected = ca.weaknesses_detected;
          }
        }
      } catch (e) {
        console.warn("Competitor analysis error:", e);
      }
    }

    // Stage 2b: Meta Ad Library (prefer official page_id, fallback to contextual keywords)
    await updateProgress(runId, 3, STEPS[2]);
    const metaPageIds: string[] = [];
    if (brandContext.official_facebook_url) {
      const pid = extractPageIdFromFacebookUrl(brandContext.official_facebook_url);
      if (pid) metaPageIds.push(pid);
    }
    if (metaPageIds.length === 0 && SEARCH_API_KEY) {
      const searchQuery = brandContext.is_ambiguous_brand
        ? `${brandContext.domain_name} ${brandContext.product_category}`.trim()
        : brandContext.brand_name;
      const pid = await searchFacebookPages(searchQuery, SEARCH_API_KEY);
      if (pid) metaPageIds.push(pid);
    }
    const metaContextualKeywords = [
      `${brandContext.domain_name} ${brandContext.product_category}`.trim(),
      `top ${brandContext.product_category} brands`,
      ...competitorData.slice(0, 2).map((c) => c.name || c.domain),
    ].filter(Boolean);
    let metaAds: any[] = [];
    try {
      metaAds = await fetchMetaAdLibraryAds({
        pageIds: metaPageIds,
        contextualKeywords: metaContextualKeywords,
        searchApiKey: SEARCH_API_KEY,
      });
    } catch (e) {
      console.warn("Meta Ad Library fetch failed:", e);
    }
    for (const ad of metaAds) {
      await db.insert(creativeIntelligenceMetaAds).values({
        runId,
        searchKeyword: ad.search_keyword,
        pageName: ad.page_name,
        pageId: ad.page_id,
        bodyText: ad.body_text,
        ctaText: ad.cta_text,
        ctaType: ad.cta_type,
        displayFormat: ad.display_format,
        platforms: ad.platforms,
        imageUrl: ad.image_url,
        rawData: ad.raw_data,
      });
    }

    // Stage 2c/2d: Facebook Business Page + Google Rank Tracking (optional - skip on failure)
    await updateProgress(runId, 4, STEPS[3]);
    let fbBrand: any = null;
    let fbCompetitors: any[] = [];
    try {
      const fbResult = await fetchFacebookPagesForBrandAndCompetitors(
        brandContext,
        competitorData.map((c) => c.name || c.domain).filter(Boolean),
        SEARCH_API_KEY
      );
      fbBrand = fbResult.brand;
      fbCompetitors = fbResult.competitors || [];
    } catch (e) {
      console.warn("Facebook pages fetch failed:", e);
    }
    if (fbBrand) {
      await db.insert(creativeIntelligenceFacebookPages).values({
        runId,
        source: "brand",
        entityName: fbBrand.entity_name,
        pageId: fbBrand.page_id,
        pageName: fbBrand.page_name,
        pageLink: fbBrand.page_link,
        followersCount: fbBrand.followers_count,
        followingCount: fbBrand.following_count,
        category: fbBrand.category,
        address: fbBrand.address,
        phone: fbBrand.phone,
        website: fbBrand.website,
        ratings: fbBrand.ratings,
        rating: fbBrand.rating,
        reviewsCount: fbBrand.reviews_count,
        priceRange: fbBrand.price_range,
        profilePhotoUrl: fbBrand.profile_photo_url,
        rawData: fbBrand.raw_data,
      });
    }
    for (const fb of fbCompetitors) {
      await db.insert(creativeIntelligenceFacebookPages).values({
        runId,
        source: "competitor",
        entityName: fb.entity_name,
        pageId: fb.page_id,
        pageName: fb.page_name,
        pageLink: fb.page_link,
        followersCount: fb.followers_count,
        followingCount: fb.following_count,
        category: fb.category,
        address: fb.address,
        phone: fb.phone,
        website: fb.website,
        ratings: fb.ratings,
        rating: fb.rating,
        reviewsCount: fb.reviews_count,
        priceRange: fb.price_range,
        profilePhotoUrl: fb.profile_photo_url,
        rawData: fb.raw_data,
      });
    }
    const rankQueries = [
      `${brandContext.domain_name} ${brandContext.product_category}`.trim(),
      `top ${brandContext.product_category} brands`,
      `${brandContext.industry_category || "best"} brands`,
      brandContext.product_category || brandContext.brand_name,
    ].filter(Boolean);
    const googleRanks = await fetchGoogleRankTracking(
      rankQueries,
      brandDomain,
      competitorData.map((c) => c.domain).filter(Boolean),
      SEARCH_API_KEY
    );
    for (const r of googleRanks) {
      await db.insert(creativeIntelligenceGoogleRanks).values({
        runId,
        searchQuery: r.search_query,
        brandDomain: r.brand_domain,
        brandPosition: r.brand_position,
        competitorRanks: r.competitor_ranks,
        organicResults: r.organic_results,
      });
    }

    // Stage 3: Review Mining (optional - use empty on failure)
    await updateProgress(runId, 5, STEPS[4]);
    let reviewClusters: Record<string, any> = {};
    try {
      reviewClusters = await mineReviews(brandContext, SEARCH_API_KEY);
    } catch (e) {
      console.warn("Review mining failed:", e);
    }

    const reviewTypeMap: Record<string, string> = {
      top_pain_points: "pain_points",
      top_desired_outcomes: "desired_outcomes",
      common_complaints: "complaints",
      emotional_triggers: "emotional_patterns",
      pain_points: "pain_points",
      desired_outcomes: "desired_outcomes",
      complaints: "complaints",
      emotional_patterns: "emotional_patterns",
    };
    const seen = new Set<string>();
    for (const [type, items] of Object.entries(reviewClusters)) {
      if (!Array.isArray(items)) continue;
      const clusterType = reviewTypeMap[type] || type;
      for (const item of items) {
        const i = item as any;
        const key = `${clusterType}:${i.label || ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        await db.insert(creativeIntelligenceReviews).values({
          runId,
          clusterType: clusterType,
          clusterLabel: i.label || null,
          frequencyPct: i.frequency_pct ?? i.frequency_percentage ?? null,
          samplePhrases: i.sample_phrases || (i.sample_quote ? [i.sample_quote] : []),
          rawClusters: item,
        });
      }
    }

    // Stage 4: Hooks + Strategy
    await updateProgress(runId, 6, STEPS[5]);
    const advanced = (typeof advancedSettings === "object" && advancedSettings) || {};
    const { hooks, strategies } = await generateHooks(
      {
        ...brandAnalysis,
        product_summary: brandAnalysis.product_summary,
        positioning_statement: brandAnalysis.positioning_statement || brandAnalysis.current_positioning_statement,
        target_persona: brandAnalysis.target_persona_guess || brandAnalysis.primary_target_audience,
        emotional_tone: brandAnalysis.emotional_tone || brandAnalysis.brand_tone,
      },
      competitorData,
      competitorAnalysis,
      reviewClusters,
      metaAds,
      { brand: fbBrand, competitors: fbCompetitors },
      googleRanks,
      {
        toneEmotional: advanced.toneEmotional,
        campaignGoal: campaignGoal || advanced.campaignGoal,
      }
    );

    for (const h of hooks) {
      await db.insert(creativeIntelligenceHooks).values({
        runId,
        hookStatement: h.hook_statement || "",
        hookType: h.hook_type || null,
        whyItWorks: h.why_it_works || null,
        supportingReviewPhrase: h.supporting_review_phrase || null,
        competitorOverlapLevel: h.competitor_overlap_level || null,
        confidenceScore: h.confidence_score ?? null,
        rank: h.rank ?? null,
      });
    }

    await db.insert(creativeIntelligenceStrategies).values({
      runId,
      strategyType: "market_opportunities",
      content: strategies,
    });

    await db
      .update(creativeIntelligenceRuns)
      .set({
        status: "completed",
        progressStep: 7,
        progressMessage: "Complete",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(creativeIntelligenceRuns.id, runId));

    return res.status(200).json({
      ok: true,
      runId,
      message: "Analysis complete",
    });
  } catch (err: any) {
    console.error("Creative Intelligence pipeline error:", err?.message || err);
    console.error("Stack:", err?.stack);
    if (runId) {
      await db
        .update(creativeIntelligenceRuns)
        .set({
          status: "failed",
          errorMessage: err.message || "Unknown error",
          updatedAt: new Date().toISOString(),
        })
        .where(eq(creativeIntelligenceRuns.id, runId));
    }
    return res.status(500).json({
      ok: false,
      error: err.message || "Analysis failed",
    });
  }
}
