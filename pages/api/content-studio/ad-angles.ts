// pages/api/content-studio/ad-angles.ts
// Generate ad angles for a product using AI

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";

type AdAngle = { title: string; explanation: string };

type ProductInput = {
  product_name?: string;
  description?: string;
  key_benefits?: string[];
  target_audience?: string;
  emotional_angles?: string[];
  use_cases?: string[];
  short_benefit?: string;
  price?: string | null;
};

type BrandInput = {
  name?: string;
  tone?: string;
  industry?: string;
  targetAudience?: string;
};

async function callGemini(prompt: string): Promise<string> {
  const geminiKey = getGeminiApiKey();
  if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");
  const res = await fetchWithGeminiRateLimitRetry(
    `${GEMINI_REST_BASE}/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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
    },
    { operationLabel: "ad-angles" }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
}

function firstBenefit(product: ProductInput): string {
  const benefits = Array.isArray(product.key_benefits) ? product.key_benefits : [];
  return (
    benefits[0]?.trim() ||
    product.short_benefit?.trim() ||
    product.description?.trim().slice(0, 100) ||
    "results you can feel"
  );
}

function generateFallbackAdAngles(product: ProductInput, brand?: BrandInput): AdAngle[] {
  const name = product.product_name?.trim() || "this product";
  const benefit = firstBenefit(product);
  const benefit2 =
    (Array.isArray(product.key_benefits) ? product.key_benefits[1] : "")?.trim() ||
    benefit;
  const audience =
    product.target_audience?.trim() ||
    brand?.targetAudience?.trim() ||
    "busy people who want better everyday choices";
  const useCase =
    (Array.isArray(product.use_cases) ? product.use_cases[0] : "")?.trim() ||
    "daily routines";
  const price = product.price ? `at ${product.price}` : "without breaking the bank";
  const brandName = brand?.name?.trim();

  return [
    {
      title: "Finally, something that actually works",
      explanation: `Pain-point angle for ${audience} tired of products that overpromise. ${name} focuses on ${benefit}, speaking directly to frustration with alternatives that fall short.`,
    },
    {
      title: `What others miss, ${brandName || name} nails`,
      explanation: `Market-gap angle: while competitors lean on generic claims, ${name} leads with ${benefit2}. Positions the product as the smarter pick in ${brand?.industry || "this category"}.`,
    },
    {
      title: `From struggle to solution in one switch`,
      explanation: `Problem-solution angle showing a clear before/after. ${name} helps ${audience} move from compromise to confidence through ${benefit}.`,
    },
    {
      title: "Feel good about every choice you make",
      explanation: `Emotional angle tapping relief and confidence. ${name} fits moments when ${audience} want something that feels right, not just looks good on a label.`,
    },
    {
      title: "I was skeptical until I tried it",
      explanation: `Testimonial-style social proof in first person. A relatable voice explains how ${name} delivered ${benefit} after other options disappointed — authentic and conversion-focused.`,
    },
    {
      title: `Made for ${useCase}, ${price}`,
      explanation: `Convenience and lifestyle angle: ${name} slides into real life without friction — ideal for ${audience} who need something effortless that still delivers ${benefit2}.`,
    },
  ];
}

function generateFallbackCampaign(product: ProductInput, brand?: BrandInput) {
  const name = product.product_name?.trim() || "Product";
  const benefit = firstBenefit(product);
  const audience =
    product.target_audience?.trim() ||
    brand?.targetAudience?.trim() ||
    "health-conscious shoppers";
  const category = brand?.industry?.trim() || "consumer product";

  return {
    strategy: {
      product_category: category,
      target_audience: audience,
      content_themes: ["product intro", "benefits education", "social proof", "lifestyle fit", "conversion"],
    },
    campaign_plan: [
      {
        day: 1,
        goal: "Awareness",
        platform: "Instagram Reels",
        content_type: "UGC Video",
        hook: `Stop scrolling if you have not tried ${name} yet`,
        description: `Quick intro showing ${name} and why ${audience} should pay attention.`,
      },
      {
        day: 2,
        goal: "Product Education",
        platform: "Instagram Feed",
        content_type: "Carousel Ad",
        hook: `The real reason people switch to ${name}`,
        description: `Carousel explaining ${benefit} and key product differentiators.`,
      },
      {
        day: 3,
        goal: "Use Case",
        platform: "Instagram Reels",
        content_type: "Product Demo Video",
        hook: `How I use ${name} every day`,
        description: `Demo-style reel showing the product in a real everyday moment.`,
      },
      {
        day: 4,
        goal: "Trust",
        platform: "Facebook Feed",
        content_type: "Poster Ad",
        hook: `"I did not expect ${name} to work this well"`,
        description: `Testimonial-led creative highlighting ${benefit} and customer satisfaction.`,
      },
      {
        day: 5,
        goal: "Conversion",
        platform: "Instagram Feed",
        content_type: "Cinematic Product Video",
        hook: `Your sign to try ${name} today`,
        description: `Polished product hero shot with a direct CTA and offer reminder.`,
      },
    ],
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
  } = product as ProductInput;

  const brandContext = brand
    ? `Brand: ${brand.name || ""}. Tone: ${brand.tone || ""}. Industry: ${brand.industry || ""}. Target: ${brand.targetAudience || ""}.`
    : "";

  const geminiKey = getGeminiApiKey();
  if (!geminiKey) {
    console.warn(
      "[Content Studio] GEMINI_API_KEY not set — using template ad angles (add GEMINI_API_KEY for AI-generated angles)"
    );
    const fallback = generateFallbackCampaign(product, brand);
    return res.status(200).json({
      ok: true,
      angles: generateFallbackAdAngles(product, brand),
      campaign_plan: fallback.campaign_plan,
      campaign_strategy: fallback.strategy,
      ai_enriched: false,
    });
  }

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
      ai_enriched: true,
    });
  } catch (err: any) {
    console.error("Ad angles error:", err);
    const fallback = generateFallbackCampaign(product, brand);
    return res.status(200).json({
      ok: true,
      angles: generateFallbackAdAngles(product, brand),
      campaign_plan: fallback.campaign_plan,
      campaign_strategy: fallback.strategy,
      ai_enriched: false,
      warning: err.message || "AI generation failed; using template angles",
    });
  }
}
