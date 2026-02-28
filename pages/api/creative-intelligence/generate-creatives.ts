// pages/api/creative-intelligence/generate-creatives.ts
// Generate campaign creatives from a selected hook

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { db } from "@/database/client";
import {
  creativeIntelligenceRuns,
  creativeIntelligenceHooks,
  creativeIntelligenceCreatives,
  creativeIntelligenceBrands,
} from "@/database/schema";
import { eq, and } from "drizzle-orm";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_VEO_API_KEY;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const config = {
  api: {
    bodyParser: { sizeLimit: "1mb" },
    responseLimit: false,
  },
  maxDuration: 120,
};

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
          maxOutputTokens: 8192,
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

  const { runId, hookId } = req.body;
  if (!runId || !hookId) {
    return res.status(400).json({ ok: false, error: "runId and hookId required" });
  }

  try {
    const [run] = await db
      .select()
      .from(creativeIntelligenceRuns)
      .where(
        and(
          eq(creativeIntelligenceRuns.id, runId),
          eq(creativeIntelligenceRuns.userId, userId)
        )
      )
      .limit(1);

    if (!run) {
      return res.status(404).json({ ok: false, error: "Run not found" });
    }

    const [hook] = await db
      .select()
      .from(creativeIntelligenceHooks)
      .where(
        and(
          eq(creativeIntelligenceHooks.id, hookId),
          eq(creativeIntelligenceHooks.runId, runId)
        )
      )
      .limit(1);

    if (!hook) {
      return res.status(404).json({ ok: false, error: "Hook not found" });
    }

    const [brand] = await db
      .select()
      .from(creativeIntelligenceBrands)
      .where(eq(creativeIntelligenceBrands.runId, runId))
      .limit(1);

    const prompt = `You are a creative director. Generate campaign creatives for this ad hook.

HOOK: ${hook.hookStatement}
TYPE: ${hook.hookType || "mixed"}
RATIONALE: ${hook.whyItWorks || "N/A"}
REVIEW SUPPORT: ${hook.supportingReviewPhrase || "N/A"}

BRAND CONTEXT: ${brand?.productSummary || "N/A"}

Return JSON:
{
  "ad_concepts": ["concept1", "concept2", "concept3", "concept4", "concept5"],
  "reel_scripts_15s": [
    {"hook": "...", "body": "...", "cta": "..."},
    {"hook": "...", "body": "...", "cta": "..."},
    {"hook": "...", "body": "...", "cta": "..."}
  ],
  "reel_scripts_30s": [
    {"hook": "...", "body": "...", "cta": "..."},
    {"hook": "...", "body": "...", "cta": "..."},
    {"hook": "...", "body": "...", "cta": "..."}
  ],
  "headlines": ["headline1", "headline2", "headline3", "headline4", "headline5"],
  "ctas": ["cta1", "cta2", "cta3", "cta4", "cta5"],
  "visual_direction": {
    "lighting": "...",
    "composition": "...",
    "color_dominance": "...",
    "emotion_tone": "..."
  }
}`;

    const raw = await callGemini(prompt);
    const creatives = JSON.parse(raw || "{}");

    await db.insert(creativeIntelligenceCreatives).values({
      runId,
      hookId,
      creativeType: "full_pack",
      content: creatives,
    });

    return res.status(200).json({
      ok: true,
      creatives,
    });
  } catch (err: any) {
    console.error("Generate creatives error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to generate creatives",
    });
  }
}
