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
          temperature: 0.7,
          maxOutputTokens: 2048,
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

  const { product } = req.body;
  if (!product || typeof product !== "object") {
    return res.status(400).json({ ok: false, error: "Product data required" });
  }

  const { product_name, description, key_benefits, target_audience, emotional_angles } = product;

  const prompt = `Given this product and its benefits, generate 5 high-converting ad angles.

Product: ${product_name || "Product"}
Description: ${description || ""}
Key Benefits: ${Array.isArray(key_benefits) ? key_benefits.join(", ") : ""}
Target Audience: ${target_audience || ""}
Emotional Angles: ${Array.isArray(emotional_angles) ? emotional_angles.join(", ") : ""}

Return JSON array:
[
  { "title": "Angle 1 - catchy hook", "explanation": "Brief why it works" },
  { "title": "Angle 2", "explanation": "Brief" },
  ...
]

Each angle should be scroll-stopping, unique, and conversion-focused. Keep titles under 10 words.`;

  try {
    const raw = await callGemini(prompt);
    const angles = JSON.parse(raw || "[]");
    return res.status(200).json({
      ok: true,
      angles: Array.isArray(angles) ? angles : [],
    });
  } catch (err: any) {
    console.error("Ad angles error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to generate ad angles",
    });
  }
}
