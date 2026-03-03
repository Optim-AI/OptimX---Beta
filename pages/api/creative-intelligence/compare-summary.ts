// pages/api/creative-intelligence/compare-summary.ts
// AI-powered comparison summary: what's working, what's wrong, what to do

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

async function callGemini(prompt: string, systemInstruction?: string, maxTokens = 4096): Promise<string> {
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

    const prompt = `You are a marketing strategist. Analyze the following brand vs competitor data and provide actionable insights.

## YOUR BRAND
- URL: ${brandData.url || "—"}
- Product: ${brandData.product || "—"}
- Positioning: ${brandData.positioning || "—"}
- Target audience: ${brandData.target || "—"}
- Brand tone: ${brandData.tone || "—"}
- Top hooks: ${(brandData.topHooks || []).join(" | ")}
- Pain points from reviews: ${(brandData.painPoints || []).join("; ")}
- Desired outcomes: ${(brandData.desiredOutcomes || []).join("; ")}
- Market gap opportunities: ${(brandData.marketGaps || []).join("; ")}
- White space: ${(brandData.whiteSpace || []).join("; ")}
- Underserved angles: ${(brandData.underservedAngles || []).join("; ")}

## COMPETITORS
${competitorData
  .map(
    (c) => `
### ${c.name} (${c.url || "—"})
- Product: ${c.product || "—"}
- Positioning: ${c.positioning || "—"}
- Target: ${c.target || "—"}
- Top hooks: ${(c.topHooks || []).join(" | ")}
- Pain points: ${(c.painPoints || []).join("; ")}
- Market gaps: ${(c.marketGaps || []).join("; ")}
`
  )
  .join("\n")}

---

Provide a structured analysis in the following format. Be specific, actionable, and reference the actual data above.

## What's Working Well for Your Brand
(2-4 bullet points on strengths, differentiation, or messaging that resonates)

## What's Going Wrong / Gaps
(2-4 bullet points on weaknesses, missed opportunities, or areas where competitors outperform)

## What You Need to Do
(3-5 specific, actionable recommendations—prioritized. Be concrete: e.g. "Test hook X in ads" or "Emphasize Y in positioning")

## What Will Likely Work
(2-3 predictions on tactics or angles that should perform well based on the data)`;

    const systemInstruction = `You are an expert marketing strategist. Output clear, actionable insights. Use bullet points. Be concise but specific. Reference actual hooks, positioning, or data from the input. Do not use generic advice—tie every point to the provided brand/competitor data.`;

    const summary = await callGemini(prompt, systemInstruction, 4096);

    return res.status(200).json({
      ok: true,
      summary: summary.trim(),
    });
  } catch (err: any) {
    console.error("Compare summary error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message || "Failed to generate comparison summary",
    });
  }
}
