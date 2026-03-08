// pages/api/content-studio/generate-campaign.ts
// Generate campaign with multiple ad types for a product

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
          temperature: 0.7,
          maxOutputTokens: 4096,
          responseMimeType: "application/json",
        },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
  const j = await res.json();
  return j.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
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

  const prompt = `Create a marketing campaign for this product. Return JSON:

{
  "campaign_name": "Catchy campaign name",
  "ads": [
    {
      "type": "UGC testimonial",
      "title": "Short ad concept",
      "description": "What this ad shows/does",
      "hook": "Opening hook",
      "cta": "Call to action"
    },
    {
      "type": "Commercial product",
      "title": "Short ad concept",
      "description": "What this ad shows/does",
      "hook": "Opening hook",
      "cta": "Call to action"
    },
    {
      "type": "Offer poster",
      "title": "Short ad concept",
      "description": "What this ad shows/does",
      "hook": "Opening hook",
      "cta": "Call to action"
    },
    {
      "type": "Before-after transformation",
      "title": "Short ad concept",
      "description": "What this ad shows/does",
      "hook": "Opening hook",
      "cta": "Call to action"
    },
    {
      "type": "Influencer review",
      "title": "Short ad concept",
      "description": "What this ad shows/does",
      "hook": "Opening hook",
      "cta": "Call to action"
    }
  ]
}

Product: ${product.product_name || "Product"}
Description: ${product.description || ""}
Benefits: ${Array.isArray(product.key_benefits) ? product.key_benefits.join(", ") : ""}
Target: ${product.target_audience || ""}
Brand: ${brand?.name || ""}
Brand tone: ${brand?.tone || ""}

CRITICAL: Never use asterisks (*) in any text. No * between words or sentences. Plain text only.`;

  try {
    const raw = await callGemini(prompt);
    const campaign = JSON.parse(raw || "{}");
    return res.status(200).json({
      ok: true,
      campaign: {
        name: campaign.campaign_name || "Campaign",
        ads: Array.isArray(campaign.ads) ? campaign.ads : [],
      },
    });
  } catch (err: any) {
    console.error("Campaign generation error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to generate campaign",
    });
  }
}
