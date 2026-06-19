// pages/api/creative-studio/generate-strategy.ts
// Creative Strategist — performance marketing concepts before script/video generation
import type { NextApiRequest, NextApiResponse } from "next";
import { fetchWithGeminiRateLimitRetry, isGeminiRateLimitError } from "@/lib/gemini-retry";
import {
  AD_FRAMEWORKS,
  formatFrameworkForPrompt,
  recommendHookTypes,
  selectFrameworkForHook,
} from "@/lib/creative-studio/ad-frameworks";
import {
  classifyProduct,
  productIntelligenceToPromptBlock,
} from "@/lib/creative-studio/product-intelligence";
import type { AdConcept, CampaignGoal, CreativeStrategy, HookType } from "@/lib/creative-studio/strategy-types";

export const config = {
  api: {
    responseLimit: false,
    bodyParser: { sizeLimit: "10mb" },
  },
  maxDuration: 60,
};

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_VEO_API_KEY;
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

function buildFallbackConcepts(
  productName: string,
  campaignGoal: string,
  hooks: HookType[]
): AdConcept[] {
  return hooks.slice(0, 5).map((hookType, i) => {
    const framework = selectFrameworkForHook(hookType);
    return {
      id: `concept-${i + 1}`,
      title: `${hookType} — ${productName}`,
      hookType,
      creativeAngle: `Lead with ${hookType.toLowerCase()} to achieve ${campaignGoal.toLowerCase()}.`,
      frameworkId: framework.id,
      rationale: framework.description,
      predictedStrength: i === 0 ? "high" : i < 3 ? "medium" : "experimental",
      cta: "Shop now",
      oneLinePitch: `${hookType} angle for ${productName}`,
    };
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { getUserIdFromRequest } = await import("@/auth/request");
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ ok: false, error: "GEMINI_API_KEY is not configured" });
  }

  try {
    const {
      product_name,
      brand_name,
      category,
      product_description,
      product_url,
      user_description,
      campaign_goal = "Drive Sales",
      audience = "Auto",
      creative_format = "Commercial",
      hook_type = "Auto",
    } = req.body;

    const productName = String(product_name || "").trim();
    const brandName = String(brand_name || "").trim();
    if (!productName || !brandName) {
      return res.status(400).json({ ok: false, error: "product_name and brand_name are required" });
    }

    const productIntelligence = classifyProduct(
      productName,
      category,
      product_description || user_description
    );

    const recommendedHooks = recommendHookTypes(campaign_goal as CampaignGoal, 5);
    const resolvedHook =
      hook_type && hook_type !== "Auto" ? (hook_type as HookType) : recommendedHooks[0];
    const framework = selectFrameworkForHook(resolvedHook);

    const systemPrompt = `You are a senior performance marketing creative strategist at a top DTC agency.
You think in CTR, watch time, conversion rate, and scroll-stop psychology — NOT cinematography.
Your job: analyze the product and output strategic ad concepts that SELL.

Rules:
- Each concept must have a distinct hook mechanism (not just a visual style).
- Concepts must be conversion-focused, not brand vanity films.
- Recommend CTAs matched to campaign goal.
- Output valid JSON only.`;

    const userPrompt = `PRODUCT: ${productName} by ${brandName}
Category: ${category || "general"}
Description: ${product_description || user_description || "Not provided"}
Website: ${product_url || "N/A"}

PRODUCT INTELLIGENCE:
${productIntelligenceToPromptBlock(productIntelligence)}

CAMPAIGN GOAL: ${campaign_goal}
TARGET AUDIENCE: ${audience === "Auto" ? "Infer from product" : audience}
CREATIVE FORMAT (visual execution): ${creative_format}
PREFERRED HOOK: ${hook_type}

RECOMMENDED HOOK TYPES TO EXPLORE: ${recommendedHooks.join(", ")}
DEFAULT FRAMEWORK: ${formatFrameworkForPrompt(framework.id)}

Generate a JSON object:
{
  "strategy": {
    "targetAudience": "specific audience description",
    "corePainPoint": "main customer pain",
    "coreDesire": "main desire/outcome",
    "biggestObjection": "why they hesitate",
    "campaignGoal": "${campaign_goal}",
    "hookType": "${resolvedHook}",
    "creativeAngle": "one sentence strategic angle",
    "cta": "specific CTA copy",
    "conversionObjective": "what action we optimize for",
    "marketAwarenessLevel": "unaware|problem-aware|solution-aware|product-aware",
    "emotionalDrivers": ["driver1", "driver2"],
    "frameworkId": "${framework.id}"
  },
  "concepts": [
    {
      "id": "concept-1",
      "title": "Short concept name",
      "hookType": "one of: ${recommendedHooks.join(", ")}",
      "creativeAngle": "strategic angle",
      "frameworkId": "one of: hook-problem-solution-cta, before-after-proof-cta, social-proof-demo-benefit-cta, contrarian-explanation-proof-cta, founder-story-journey-solution-cta",
      "rationale": "why this will perform",
      "predictedStrength": "high|medium|experimental",
      "cta": "CTA copy",
      "oneLinePitch": "one line pitch"
    }
  ]
}

Generate exactly 5 distinct concepts with different hookTypes. Concepts 1-2 should be "high" predictedStrength.`;

    const requestBody = {
      contents: [{ parts: [{ text: userPrompt }] }],
      system_instruction: { parts: [{ text: systemPrompt }] },
      generation_config: {
        temperature: 0.85,
        max_output_tokens: 4000,
        response_mime_type: "application/json",
      },
    };

    let parsed: { strategy?: CreativeStrategy; concepts?: AdConcept[] } = {};

    try {
      const response = await fetchWithGeminiRateLimitRetry(
        `${GEMINI_BASE_URL}/models/gemini-2.5-flash:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": GEMINI_API_KEY,
          },
          body: JSON.stringify(requestBody),
        },
        { operationLabel: "creative-strategy", maxRetries: 4 }
      );

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Strategy API error ${response.status}: ${errText.slice(0, 300)}`);
      }

      const json = await response.json();
      const text =
        json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") || "";
      const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.warn("Strategy LLM parse failed, using heuristic fallback:", e);
    }

    const strategy: CreativeStrategy = {
      targetAudience: parsed.strategy?.targetAudience || productIntelligence.buyerType,
      corePainPoint: parsed.strategy?.corePainPoint || "Current solutions fall short",
      coreDesire: parsed.strategy?.coreDesire || `Get results from ${productName}`,
      biggestObjection: parsed.strategy?.biggestObjection || "Will this actually work for me?",
      campaignGoal: (parsed.strategy?.campaignGoal as CampaignGoal) || campaign_goal,
      hookType: parsed.strategy?.hookType || resolvedHook,
      creativeAngle: parsed.strategy?.creativeAngle || `Performance ad for ${productName}`,
      cta: parsed.strategy?.cta || "Shop now",
      conversionObjective:
        parsed.strategy?.conversionObjective || `Maximize ${campaign_goal.toLowerCase()}`,
      marketAwarenessLevel: parsed.strategy?.marketAwarenessLevel || productIntelligence.awarenessLevel,
      emotionalDrivers: parsed.strategy?.emotionalDrivers || [productIntelligence.emotionType],
      frameworkId: parsed.strategy?.frameworkId || framework.id,
      productIntelligence,
    };

    let concepts: AdConcept[] = Array.isArray(parsed.concepts) ? parsed.concepts.slice(0, 5) : [];
    if (concepts.length < 3) {
      concepts = buildFallbackConcepts(productName, campaign_goal, recommendedHooks);
    }

    // Validate framework IDs
    concepts = concepts.map((c, i) => ({
      ...c,
      id: c.id || `concept-${i + 1}`,
      frameworkId:
        c.frameworkId && AD_FRAMEWORKS[c.frameworkId as keyof typeof AD_FRAMEWORKS]
          ? c.frameworkId
          : selectFrameworkForHook(c.hookType).id,
    }));

    return res.status(200).json({
      ok: true,
      productIntelligence,
      strategy,
      concepts,
      recommendedHooks,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (isGeminiRateLimitError(error)) {
      return res.status(429).json({ ok: false, error: "Rate limit reached. Please try again." });
    }
    console.error("generate-strategy error:", error);
    return res.status(500).json({ ok: false, error: message || "Failed to generate strategy" });
  }
}
