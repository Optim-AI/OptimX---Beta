// pages/api/creative-intelligence/compare-summary.ts
// AI-powered comparison: TL;DR, insight cards, structured comparison

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_VEO_API_KEY;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const config = {
  api: {
    bodyParser: { sizeLimit: "1mb" },
  },
};

type CondensedBrand = {
  url?: string;
  product?: string;
  positioning?: string;
  target?: string;
  tone?: string;
  topHooks?: string[];
  painPoints?: string[];
  desiredOutcomes?: string[];
  marketGaps?: string[];
  whiteSpace?: string[];
  underservedAngles?: string[];
};

async function callGemini(
  prompt: string,
  systemInstruction?: string,
  maxTokens = 4096,
  jsonMode = false
): Promise<string> {
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
          temperature: 0.3,
          maxOutputTokens: maxTokens,
          ...(jsonMode && { responseMimeType: "application/json" }),
        },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} - ${err}`);
  }
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function condenseBrand(data: any): CondensedBrand {
  const brand = data?.brand;
  const run = data?.run;
  const raw = (brand as any)?.rawAnalysis || {};
  const reviews = data?.reviews || [];
  const hooks = data?.hooks || [];
  const strategies = data?.strategies || {};

  const painPoints = reviews
    .filter((r: any) => r.clusterType === "pain_points")
    .flatMap((r: any) => r.samplePhrases || [])
    .slice(0, 5);
  const desiredOutcomes = reviews
    .filter((r: any) => r.clusterType === "desired_outcomes")
    .flatMap((r: any) => r.samplePhrases || [])
    .slice(0, 5);

  return {
    url: run?.brandUrl,
    product: raw?.product_name || brand?.productSummary,
    positioning: brand?.positioningStatement || raw?.current_positioning_statement,
    target: raw?.primary_target_audience || brand?.targetPersonaGuess,
    tone: raw?.brand_tone || brand?.emotionalTone,
    topHooks: hooks.slice(0, 5).map((h: any) => h.hookStatement),
    painPoints,
    desiredOutcomes,
    marketGaps: (strategies?.market_gap_analysis || []).map((g: any) => g.opportunity_statement).filter(Boolean),
    whiteSpace: strategies?.white_space_opportunities || [],
    underservedAngles: strategies?.underserved_angles || [],
  };
}

type InsightCard = {
  title: string;
  description: string;
  opportunity: string;
  ad_angle: string;
};

type CompareResponse = {
  tldr: {
    biggest_opportunity: string;
    biggest_strength: string;
    biggest_weakness: string;
    recommended_ad_strategy: string;
  };
  comparison: {
    brand_strengths: string[];
    competitor_strengths: string[];
    key_market_gap: string;
    strategic_opportunity: string;
  };
  working_well: InsightCard[];
  gaps: InsightCard[];
  recommended_strategy: Array<{ title: string; description: string }>;
};

function parseJson(raw: string): CompareResponse {
  const cleaned = raw.replace(/```json?\s*/g, "").replace(/```\s*$/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    tldr: parsed.tldr || {
      biggest_opportunity: "",
      biggest_strength: "",
      biggest_weakness: "",
      recommended_ad_strategy: "",
    },
    comparison: parsed.comparison || {
      brand_strengths: [],
      competitor_strengths: [],
      key_market_gap: "",
      strategic_opportunity: "",
    },
    working_well: Array.isArray(parsed.working_well) ? parsed.working_well : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps : [],
    recommended_strategy: Array.isArray(parsed.recommended_strategy) ? parsed.recommended_strategy : [],
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

  const { brand, competitors } = req.body || {};
  if (!brand || !Array.isArray(competitors) || competitors.length === 0) {
    return res.status(400).json({ ok: false, error: "brand and competitors array required" });
  }

  try {
    const brandData = condenseBrand(brand);
    const competitorData = competitors.map((c: any, i: number) => ({
      name: `Competitor ${i + 1}`,
      ...condenseBrand(c),
    }));

    const brandName = brandData.product?.split(" ")[0] || "Your Brand";
    const compName = competitorData[0]?.product?.split(" ")[0] || "Competitor";

    const prompt = `Analyze this brand vs competitor data. Return ONLY valid JSON with this exact structure (no markdown):

{
  "tldr": {
    "biggest_opportunity": "One line - the #1 opportunity to capture",
    "biggest_strength": "One line - your brand's strongest asset",
    "biggest_weakness": "One line - your brand's main gap",
    "recommended_ad_strategy": "One line - best ad approach to beat competitor"
  },
  "comparison": {
    "brand_strengths": ["short strength 1", "short strength 2", "short strength 3"],
    "competitor_strengths": ["short strength 1", "short strength 2"],
    "key_market_gap": "One line - gap between brands",
    "strategic_opportunity": "One line - how to win"
  },
  "working_well": [
    {
      "title": "Short title",
      "description": "1-2 lines max",
      "opportunity": "What this means for marketing",
      "ad_angle": "Example creative direction"
    }
  ],
  "gaps": [
    {
      "title": "Short title",
      "description": "1-2 lines max",
      "opportunity": "What to fix",
      "ad_angle": "Ad angle to address this"
    }
  ],
  "recommended_strategy": [
    {
      "title": "Strategy name",
      "description": "1-2 lines"
    }
  ]
}

RULES:
- tldr: Each field = ONE short line (under 80 chars). No paragraphs.
- comparison: brand_strengths and competitor_strengths = 2-3 short bullets each.
- working_well: 2-3 cards. Each description, opportunity, ad_angle = max 2 lines.
- gaps: 2-3 cards. Same structure.
- recommended_strategy: 2-3 items.

## YOUR BRAND (${brandName})
URL: ${brandData.url || "—"}
Product: ${brandData.product || "—"}
Positioning: ${brandData.positioning || "—"}
Target: ${brandData.target || "—"}
Top hooks: ${(brandData.topHooks || []).join(" | ")}
Pain points: ${(brandData.painPoints || []).join("; ")}
Market gaps: ${(brandData.marketGaps || []).join("; ")}

## COMPETITOR (${compName})
${competitorData
  .map(
    (c) => `${c.name}: ${c.product} | Hooks: ${(c.topHooks || []).join(" | ")} | Gaps: ${(c.marketGaps || []).join("; ")}`
  )
  .join("\n")}`;

    const systemInstruction = `You are a marketing strategist. Return ONLY valid JSON. Be specific to the data. All text must be concise: 1-2 lines max. No paragraphs.`;

    const raw = await callGemini(prompt, systemInstruction, 4096, true);
    const result = parseJson(raw);

    return res.status(200).json({
      ok: true,
      ...result,
    });
  } catch (err: any) {
    console.error("Compare summary error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to generate comparison summary",
    });
  }
}
