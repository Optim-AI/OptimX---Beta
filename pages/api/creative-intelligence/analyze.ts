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
} from "@/database/schema";
import { eq } from "drizzle-orm";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_VEO_API_KEY;
const SEARCH_API_KEY = process.env.SEARCH_API_KEY || process.env.SERPAPI_KEY;
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
  return {
    title,
    metaDesc,
    text: article?.textContent || "",
    url,
  };
}

async function callGemini(prompt: string, systemInstruction?: string): Promise<string> {
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
          maxOutputTokens: 8192,
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

/* ---------- Stage 2: Competitor Discovery ---------- */
async function searchCompetitors(brandName: string, industry: string): Promise<any[]> {
  if (!SEARCH_API_KEY) {
    console.warn("SEARCH_API_KEY not set, using mock competitors");
    return [];
  }
  const queries = [
    `best alternatives to ${brandName}`,
    `${brandName} vs`,
    `top brands in ${industry || "this industry"}`,
    `${brandName} reviews`,
  ];
  const seen = new Set<string>();
  const results: any[] = [];
  for (const q of queries) {
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(q)}&api_key=${SEARCH_API_KEY}&num=5`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const organic = data.organic_results || [];
      for (const r of organic) {
        if (!r.link) continue;
        try {
          const host = new URL(r.link).hostname.replace("www.", "");
          if (seen.has(host)) continue;
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
  return results.slice(0, 10);
}

/* ---------- Stage 2b: Meta Ad Library (via SearchAPI) ---------- */
async function fetchMetaAdLibraryAds(
  keywords: string[],
  searchApiKey: string | undefined
): Promise<any[]> {
  if (!searchApiKey) return [];
  const allAds: any[] = [];
  const seenIds = new Set<string>();
  for (const kw of keywords.slice(0, 5)) {
    if (!kw?.trim()) continue;
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=meta_ad_library&q=${encodeURIComponent(kw.trim())}&api_key=${searchApiKey}&sort_by=impressions_high_to_low`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const ads = data.ads || [];
      for (const ad of ads.slice(0, 5)) {
        const id = ad.ad_archive_id || ad.page_id + "-" + (ad.snapshot?.body?.text?.slice(0, 50) || "");
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        const snapshot = ad.snapshot || {};
        const bodyText = snapshot.body?.text || "";
        const firstImage = snapshot.images?.[0]?.resized_image_url || snapshot.images?.[0]?.original_image_url
          || snapshot.cards?.[0]?.resized_image_url || snapshot.cards?.[0]?.original_image_url;
        allAds.push({
          search_keyword: kw.trim(),
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
    } catch (e) {
      console.warn("Meta Ad Library fetch error:", e);
    }
  }
  return allAds.slice(0, 25);
}

/* ---------- Stage 3: Review Mining (via search + Gemini) ---------- */
async function mineReviews(
  brandName: string,
  industry: string,
  searchApiKey: string | undefined
): Promise<any> {
  let reviewSnippets: string[] = [];
  if (searchApiKey) {
    try {
      const url = `https://www.searchapi.io/api/v1/search?engine=google&q=${encodeURIComponent(`${brandName} reviews`)}&api_key=${searchApiKey}&num=10`;
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
  const combined = reviewSnippets.join("\n\n") || `No review snippets found for ${brandName}. Infer common pain points and desired outcomes for ${industry || "this"} industry.`;
  const prompt = `You are a customer insight analyst. Given the following review snippets and brand/industry context, cluster insights.

Brand: ${brandName}
Industry: ${industry || "general"}

Review snippets:
${combined}

Return JSON:
{
  "pain_points": [{"label":"...","frequency_pct":0-100,"sample_phrases":["..."]}],
  "desired_outcomes": [{"label":"...","frequency_pct":0-100,"sample_phrases":["..."]}],
  "emotional_patterns": [{"label":"...","frequency_pct":0-100}],
  "complaints": [{"label":"...","frequency_pct":0-100}]
}

Rank by frequency. Use 0-100 for frequency_pct. If no real data, infer plausible patterns for the industry.`;
  const raw = await callGemini(prompt, "Return ONLY valid JSON.");
  return JSON.parse(raw || "{}");
}

/* ---------- Stage 4: Market Gap + Hook Engine ---------- */
async function generateHooks(
  brandSummary: any,
  competitors: any[],
  reviewClusters: any,
  metaAds: any[] = []
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
  const prompt = `You are a creative strategist. Given brand analysis, competitor landscape, customer review insights, and Meta/Google ad intelligence, identify market opportunities and ad hooks.

BRAND:
${JSON.stringify(brandSummary, null, 2)}

COMPETITORS:
${JSON.stringify(competitors.slice(0, 5), null, 2)}

REVIEW INSIGHTS:
${JSON.stringify(reviewClusters, null, 2)}

META AD LIBRARY (competitor ads from Facebook/Instagram):
${metaAdSummary.length > 0 ? JSON.stringify(metaAdSummary, null, 2) : "No Meta ad data available."}

Use the Meta ad copy, CTAs, and formats to identify what's working in the market and find white-space opportunities. Avoid overused hooks; find angles competitors aren't leveraging.

Return JSON:
{
  "underserved_angles": ["angle1", "angle2", "angle3"],
  "white_space_opportunities": ["opp1", "opp2"],
  "differentiation_map": {"axis1":"position", "axis2":"position"},
  "hooks": [
    {
      "hook_statement": "Compelling ad hook (max 15 words)",
      "hook_type": "emotional|performance",
      "why_it_works": "Brief rationale",
      "supporting_review_phrase": "Quote from review insights",
      "competitor_overlap_level": "high|moderate|low",
      "confidence_score": 0-100
    }
  ]
}

Return exactly 5 hooks, ranked by confidence_score. Be specific and data-backed.`;
  const raw = await callGemini(prompt, "Return ONLY valid JSON.");
  const parsed = JSON.parse(raw || "{}");
  const hooks = (parsed.hooks || []).slice(0, 5).map((h: any, i: number) => ({
    ...h,
    rank: i + 1,
  }));
  return {
    hooks,
    strategies: {
      underserved_angles: parsed.underserved_angles || [],
      white_space_opportunities: parsed.white_space_opportunities || [],
      differentiation_map: parsed.differentiation_map || {},
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

    const stage1Prompt = `Extract structured brand intelligence from this website.

URL: ${brandUrl}
TITLE: ${pageData.title}
META: ${pageData.metaDesc}

PAGE CONTENT:
${pageData.text.slice(0, 8000)}

Return JSON:
{
  "product_summary": "2-3 sentence summary",
  "positioning_statement": "One sentence positioning",
  "core_pains_addressed": ["pain1", "pain2", "pain3"],
  "emotional_tone": "Professional|Playful|Bold|Minimalist|etc",
  "target_persona_guess": "Who is the ideal customer"
}`;
    const stage1Raw = await callGemini(stage1Prompt, "Return ONLY valid JSON.");
    const brandAnalysis = JSON.parse(stage1Raw || "{}");

    await db.insert(creativeIntelligenceBrands).values({
      runId,
      productSummary: brandAnalysis.product_summary || null,
      positioningStatement: brandAnalysis.positioning_statement || null,
      corePainsAddressed: brandAnalysis.core_pains_addressed || [],
      emotionalTone: brandAnalysis.emotional_tone || null,
      targetPersonaGuess: brandAnalysis.target_persona_guess || null,
      rawAnalysis: brandAnalysis,
    });

    // Stage 2: Competitor Discovery
    await updateProgress(runId, 2, STEPS[1]);
    const searchResults = await searchCompetitors(
      brandAnalysis.product_summary?.split(" ")[0] || brandName,
      industry
    );

    const competitorData: any[] = [];
    for (let i = 0; i < Math.min(5, searchResults.length); i++) {
      const r = searchResults[i];
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
      });
      await db.insert(creativeIntelligenceCompetitors).values({
        runId,
        name: r.title?.split(" - ")[0] || r.domain,
        domain: r.domain,
        corePositioning: positioning.slice(0, 500),
        primaryHook: r.snippet?.slice(0, 100) || null,
        saturationLevel: saturation,
        rawData: r,
      });
    }

    // Stage 2b: Meta Ad Library
    await updateProgress(runId, 3, STEPS[2]);
    const metaKeywords = [
      brandName,
      brandAnalysis.product_summary?.split(" ").slice(0, 3).join(" ") || brandName,
      ...competitorData.map((c) => c.name || c.domain).filter(Boolean),
    ];
    const metaAds = await fetchMetaAdLibraryAds(metaKeywords, SEARCH_API_KEY);
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

    // Stage 3: Review Mining
    await updateProgress(runId, 4, STEPS[3]);
    const reviewClusters = await mineReviews(
      brandName,
      industry || "",
      SEARCH_API_KEY
    );

    for (const [type, items] of Object.entries(reviewClusters)) {
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        await db.insert(creativeIntelligenceReviews).values({
          runId,
          clusterType: type,
          clusterLabel: (item as any).label || null,
          frequencyPct: (item as any).frequency_pct ?? null,
          samplePhrases: (item as any).sample_phrases || [],
          rawClusters: item,
        });
      }
    }

    // Stage 4: Hooks + Strategy
    await updateProgress(runId, 5, STEPS[4]);
    const { hooks, strategies } = await generateHooks(
      {
        product_summary: brandAnalysis.product_summary,
        positioning_statement: brandAnalysis.positioning_statement,
        target_persona: brandAnalysis.target_persona_guess,
        emotional_tone: brandAnalysis.emotional_tone,
      },
      competitorData,
      reviewClusters,
      metaAds
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
        progressStep: 6,
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
    console.error("Creative Intelligence pipeline error:", err);
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
