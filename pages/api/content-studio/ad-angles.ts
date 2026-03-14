// pages/api/content-studio/ad-angles.ts
// Generate ad angles for a product using AI

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";

const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GEMINI_VEO_API_KEY ||
  process.env.NANO_API_KEY;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

async function callGemini(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");
  const res = await fetch(
    `${GEMINI_BASE}/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.75,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  const { product, brand } = req.body;
  if (!product || typeof product !== "object") {
    return res.status(400).json({ ok: false, error: "Product data required" });
  }

  const {
    product_name,
    description,
    key_benefits,
    target_audience,
    emotional_angles,
    use_cases,
    short_benefit,
    price,
  } = product;

  const brandContext = brand
    ? `Brand: ${brand.name || ""}. Tone: ${brand.tone || ""}. Industry: ${brand.industry || ""}. Target: ${brand.targetAudience || ""}.`
    : "";

  const prompt = `You are a senior creative strategist and performance marketer. Do deep product and market research thinking before generating ad angles.

## Product
- Name: ${product_name || "Product"}
- Description: ${description || ""}
- Key Benefits: ${Array.isArray(key_benefits) ? key_benefits.join("; ") : ""}
- Target Audience: ${target_audience || ""}
- Emotional Angles: ${Array.isArray(emotional_angles) ? emotional_angles.join("; ") : ""}
- Use Cases: ${Array.isArray(use_cases) ? use_cases.join("; ") : ""}
- Short Benefit: ${short_benefit || ""}
- Price: ${price || "N/A"}
${brandContext ? `\n## Brand Context\n${brandContext}` : ""}

## Your Task
1. **Research mindset**: Infer the target customer's pain points, frustrations, and unmet needs. Identify the market gap this product fills. What problem does it solve that alternatives don't?
2. **Human touch**: Think about real moments, emotions, and desires—not just features. How does this product make someone feel? What life moment does it improve?
3. **Conversion logic**: Each angle must speak to a specific pain, desire, or objection. Be specific, not generic.

## Required Ad Angles (generate exactly 6)
Include these strategic types—one of each:
1. **Pain-point angle**: Addresses a specific frustration or struggle the audience has.
2. **Market-gap angle**: Highlights what competitors miss; the unique space this product owns.
3. **Problem-solution angle**: Clear before/after or transformation the product enables.
4. **Emotional / human touch angle**: Warm, relatable, taps into feelings—joy, confidence, belonging, relief.
5. **Testimonial / social proof angle**: Written as if a real customer is speaking. First-person, authentic voice. "I was skeptical but..." or "Finally, something that actually..." or "This changed how I..."
6. **Convenience / lifestyle angle**: Fits into their busy life, on-the-go, effortless.

Return JSON array only:
[
  { "title": "Catchy hook under 10 words", "explanation": "2-3 sentences: why this angle works, which pain/desire it taps, and how it converts." },
  ...
]

Be specific to this product. No generic fluff. Titles must be scroll-stopping and conversion-focused.
CRITICAL: Never use asterisks (*) between words or in any text. No markdown (e.g. no *and* or *bold*). Plain text only.`;

  const campaignPrompt = `You are an expert social media strategist, content planner, and performance marketer.

Your task is to analyze a product and generate a short multi-day campaign plan for social media.

Do NOT generate random content ideas. Instead, follow this internal reasoning process before producing output:

## Step 1 — Product Analysis (think internally)
Understand the product deeply:
- Name: ${product_name || "Product"}
- Description: ${description || ""}
- Key Benefits: ${Array.isArray(key_benefits) ? key_benefits.join("; ") : ""}
- Target Audience: ${target_audience || ""}
- Emotional Angles: ${Array.isArray(emotional_angles) ? emotional_angles.join("; ") : ""}
- Use Cases: ${Array.isArray(use_cases) ? use_cases.join("; ") : ""}
- Short Benefit: ${short_benefit || ""}
- Price: ${price || "N/A"}
${brandContext ? `\n## Brand Context\n${brandContext}` : ""}

## Step 2 — Strategic Thinking (think internally)
Before generating anything, reason through:
1. What product category is this? (e.g. healthy food, skincare, SaaS, fashion)
2. Who is the real target audience and what motivates them?
3. What are the key product differentiators and benefits?
4. What type of social content performs best for this category? (e.g. recipe content for food, before/after for skincare, UGC testimonials for lifestyle)
5. What are typical buying triggers for this audience?
6. What is the brand tone and personality?

## Step 3 — Content Strategy (think internally)
Design a logical content sequence:
- Awareness content first (grab attention, introduce the product)
- Educational content next (explain benefits, ingredients, features)
- Use cases and demos in the middle (show practical value)
- Trust building content (social proof, testimonials, transparency)
- Conversion focused content last (strong CTA, urgency, offer)

Adapt this sequence to the specific product and audience. Do not use a fixed template.

## Step 4 — Generate the Campaign
Now produce 5–7 posts that follow your strategy.

Each post must include:
- day: number starting at 1
- goal: a short strategic goal label (e.g. "Awareness", "Use Case", "Product Education", "Trust", "Conversion")
- platform: one of "Instagram Reels", "Instagram Feed", "Facebook Feed"
- content_type: one of "UGC Video", "Cinematic Product Video", "Product Demo Video", "Carousel Ad", "Poster Ad"
- hook: a compelling scroll-stopping hook line specific to this product (not generic)
- description: 1 sentence describing what the content shows or communicates

The campaign must feel like a real marketing strategy created by a content manager — intentional, logical, and adapted to the product.

Return a JSON object with this exact structure:
{
  "strategy": {
    "product_category": "string",
    "target_audience": "string",
    "content_themes": ["string", "string", "string"]
  },
  "campaign_plan": [
    {
      "day": 1,
      "goal": "Awareness",
      "platform": "Instagram Reels",
      "content_type": "UGC Video",
      "hook": "Hook text here",
      "description": "What this content shows or communicates."
    }
  ]
}

CRITICAL: Never use asterisks (*) in any text. No markdown. Plain text only.`;

  try {
    const [rawAngles, rawCampaign] = await Promise.all([
      callGemini(prompt),
      callGemini(campaignPrompt),
    ]);

    const angles = JSON.parse(rawAngles || "[]");

    let campaignPlan: any[] = [];
    let campaignStrategy: any = null;
    try {
      const parsed = JSON.parse(rawCampaign || "{}");
      if (parsed.campaign_plan && Array.isArray(parsed.campaign_plan)) {
        campaignPlan = parsed.campaign_plan;
        campaignStrategy = parsed.strategy || null;
      } else if (Array.isArray(parsed)) {
        campaignPlan = parsed;
      }
    } catch {
      campaignPlan = [];
    }

    return res.status(200).json({
      ok: true,
      angles: Array.isArray(angles) ? angles : [],
      campaign_plan: campaignPlan,
      campaign_strategy: campaignStrategy,
    });
  } catch (err: any) {
    console.error("Ad angles error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to generate ad angles",
    });
  }
}
