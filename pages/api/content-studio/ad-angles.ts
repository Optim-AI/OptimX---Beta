// pages/api/content-studio/ad-angles.ts
// Ad strategy for one product: live product-market research + a strategist's brief
// (lib/research/product-strategy.ts). Template angles only when Gemini is unavailable.

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { getGeminiApiKey } from "@/lib/gemini-config";
import { buildProductStrategy, type StrategyProductInput } from "@/lib/research/product-strategy";
import { getBrandResearch, researchMatchesBrandName, saveBrandResearch } from "@/lib/research/store";
import { researchBrand } from "@/lib/research/brand-research";
import { getUserBrand } from "@/lib/brand-kit/server";

export const config = {
  // Up to ~2 min the first time a site is seen (brand research + product strategy).
  maxDuration: 240,
};

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

  const website = typeof req.body?.website === "string" ? req.body.website : undefined;

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

  try {
    // One source of truth: brand facts from the Brand Kit, market read from Brand Research.
    // If this site has no research yet, run it now so the strategy and Brand Research agree.
    const [{ snapshot: kitBrand }, saved] = await Promise.all([
      getUserBrand(userId).catch(() => ({ snapshot: null })),
      getBrandResearch(userId, website).catch(() => null),
    ]);
    let brandResearch = website || !saved ? saved : researchMatchesBrandName(saved, brand?.name) ? saved : null;
    if (!brandResearch && website) {
      brandResearch = await researchBrand(website)
        .then(async ({ research }) => {
          if (research) await saveBrandResearch(userId, research).catch(() => null);
          return research;
        })
        .catch((e) => {
          console.warn("[Content Studio] brand research failed", (e as Error)?.message);
          return null;
        });
    }

    const sameBrand = kitBrand?.name && brand?.name && kitBrand.name.toLowerCase().replace(/[^a-z0-9]/g, "") === String(brand.name).toLowerCase().replace(/[^a-z0-9]/g, "");
    const { strategy, timings } = await buildProductStrategy({
      product: product as StrategyProductInput,
      brand: {
        name: brand?.name || kitBrand?.name,
        tone: (sameBrand && (kitBrand?.brand_tone?.join(", ") || kitBrand?.tone)) || brand?.tone,
        industry: (sameBrand && kitBrand?.industry) || brand?.industry,
        targetAudience: (sameBrand && kitBrand?.audience) || brand?.targetAudience,
        website,
      },
      brandResearch,
    });
    console.log("[Content Studio] strategy", { userId, timings, research: strategy.campaign_strategy.brief.research });

    return res.status(200).json({
      ok: true,
      angles: strategy.angles,
      campaign_plan: strategy.campaign_plan,
      campaign_strategy: strategy.campaign_strategy,
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
