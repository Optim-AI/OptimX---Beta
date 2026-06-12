// pages/api/creative-intelligence/generate-creatives.ts
// Step 7: Generate creatives (posters + 8s video scripts) from selected hook

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { db } from "@/database/client";
import {
  creativeIntelligenceRuns,
  creativeIntelligenceHooks,
  creativeIntelligenceCreatives,
  creativeIntelligenceBrands,
  profiles,
} from "@/database/schema";
import { eq, and } from "drizzle-orm";
import { ContentStudioScanDAO } from "@/database/models/ContentStudioScan.dao";
import {
  buildHookCreativeBrief,
  mergeBrandSnapshots,
  pickProductFromScan,
} from "@/lib/creative-studio/hook-creative-context";
import type { BrandSnapshot, Product } from "@/app/web/src/components/creative-studio/types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_VEO_API_KEY;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

export const config = {
  api: {
    bodyParser: { sizeLimit: "1mb" },
    responseLimit: false,
  },
  maxDuration: 120,
};

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

const STEP7_SYSTEM = `You are the Creative Intelligence Engine. STEP 7 — CREATIVE GENERATION.
No fluff. No marketing clichés. No long paragraphs. Everything must tie to research signals.
Return structured JSON only.`;

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

    const advanced = (run.advancedSettings as any) || {};
    const theme = advanced.theme || "commercial";
    const font = advanced.preferredFont || "sans-serif";
    const brandColors = Array.isArray(advanced.brandColors) ? advanced.brandColors : (advanced.brandColors ? [advanced.brandColors] : []);
    const platforms = Array.isArray(advanced.platforms) && advanced.platforms.length > 0 ? advanced.platforms : ["Instagram", "Meta"];
    const toneEmotional = advanced.toneEmotional ?? 0.5;
    const campaignGoal = run.campaignGoal || advanced.campaignGoal || "Conversions";
    const toneDir = toneEmotional > 0.6 ? "Emotional: aspiration, identity, feeling" : toneEmotional < 0.4 ? "Performance: numbers, proof, outcome, efficiency" : "Blend emotional and performance. Keep clarity.";

    // Brand guideline + Ad Studio product context
    let brandGuideline: BrandSnapshot | null = null;
    let contentStudioProduct: Product | null = null;
    let scanBrandSummary: Record<string, string> | null = null;

    try {
      const [profileRow] = await db
        .select({ brandSnapshot: profiles.brandSnapshot })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);
      if (profileRow?.brandSnapshot) {
        brandGuideline = profileRow.brandSnapshot as BrandSnapshot;
      }
    } catch {
      // optional
    }

    try {
      const scans = await ContentStudioScanDAO.listByUser(userId);
      if (scans.length > 0) {
        const brandUrl = run.brandUrl || "";
        const normalizeHost = (url: string) => {
          try {
            const u = url.startsWith("http") ? url : `https://${url}`;
            return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
          } catch {
            return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
          }
        };
        const host = brandUrl ? normalizeHost(brandUrl) : "";
        const matched =
          host && scans.find((s) => s.url && normalizeHost(s.url) === host);
        const latest = matched || scans[0];
        scanBrandSummary = (latest.brandSummary as Record<string, string>) || null;
        contentStudioProduct = pickProductFromScan(
          (latest.products as Product[]) || [],
          brandUrl
        );
      }
    } catch {
      // optional
    }

    const ciFallback: BrandSnapshot = {
      name: (brand?.rawAnalysis as any)?.product_name || "Brand",
      description: brand?.productSummary || "",
      audience: brand?.targetPersonaGuess || "",
      offering: brand?.productSummary || "",
      tone: brand?.emotionalTone || "professional",
    };
    const mergedBrand = mergeBrandSnapshots(brandGuideline, ciFallback, scanBrandSummary);

    const hookBrief = buildHookCreativeBrief({
      hookStatement: hook.hookStatement,
      hookType: hook.hookType,
      whyItWorks: hook.whyItWorks,
      supportingReviewPhrase: hook.supportingReviewPhrase,
    });

    const productContext = contentStudioProduct
      ? `PRODUCT (from Ad Studio): ${contentStudioProduct.product_name}. ${contentStudioProduct.description || ""} Benefits: ${(contentStudioProduct.key_benefits || []).slice(0, 3).join(", ")}. Short benefit: ${contentStudioProduct.short_benefit || "N/A"}.`
      : "";

    const brandContext = `BRAND (from Brand Guidelines + research):
Name: ${mergedBrand.name}
Description: ${mergedBrand.description || brand?.productSummary || "N/A"}
Audience: ${mergedBrand.audience || "N/A"}
Tone: ${mergedBrand.tone || "N/A"}
Value prop: ${mergedBrand.coreValueProp || "N/A"}
${mergedBrand.primaryColors?.length ? `Brand colors: ${mergedBrand.primaryColors.join(", ")}` : ""}`;

    const prompt = `${STEP7_SYSTEM}

${hookBrief}

${brandContext}
${productContext}

CAMPAIGN GOAL: ${campaignGoal}
THEME: ${theme}
FONT: ${font}
BRAND COLORS: ${brandColors.length > 0 ? brandColors.join(", ") : "Not specified"}
PLATFORMS: ${platforms.join(", ")}
TONE: ${toneDir}

Generate STEP 7 output. Return JSON:

{
  "posters": [
    {
      "primary_text_options": ["Short bold line 1", "Short bold line 2", "Short bold line 3", "Short bold line 4", "Short bold line 5"],
      "secondary_text_options": ["Support line 1", "Support line 2", "Support line 3", "Support line 4", "Support line 5"],
      "cta_options": ["Try it now", "Get yours today", "Start free", "Shop now", "See how it works"],
      "visual_direction": {
        "composition_style": "center focus|split layout|product close-up|lifestyle",
        "lighting_style": "soft daylight|high contrast|dramatic shadow|clean studio",
        "color_dominance": "which brand color leads",
        "emotional_mood": "bold|calm|urgent|premium|playful",
        "focal_hierarchy": "what eye sees first, second, third",
        "background_style": "minimal|textured|gradient|real-world scene"
      },
      "hook_reference": "use the HOOK from above",
      "confidence_score": 0-100
    }
  ],
  "video_scripts_8s": [
    {
      "script_number": 1,
      "hook_line": "0-2s pattern interrupt",
      "problem_or_desire": "2-5s",
      "solution": "5-7s",
      "cta": "7-8s punch",
      "hook_reference": "use the HOOK from above",
      "confidence_score": 0-100
    }
  ]
}

Rules:
- Primary text: max 8-12 words. Short, bold, scroll-stopping.
- Secondary text: max 15 words. Clear benefit or proof.
- CTA: Short, action-driven, platform-appropriate.
- Visual direction: Specific instructions for image generator. No "beautiful modern design".
- Video scripts: 5 variations. Total readable in 8 seconds. Max 25-35 words each. Format: 0-2s Hook, 2-5s Problem/Desire, 5-7s Solution, 7-8s CTA.
- Generate 1 poster concept and 5 video script variations.
- For hook_reference use exactly: "${hook.hookStatement}"`;

    const raw = await callGemini(prompt, "Return ONLY valid JSON.");
    const creatives = JSON.parse(raw || "{}");

    // Ensure hook_reference is set
    const hookRef = hook.hookStatement;
    if (creatives.posters) {
      for (const p of creatives.posters) {
        if (!p.hook_reference || p.hook_reference.includes("use the")) p.hook_reference = hookRef;
      }
    }
    if (creatives.video_scripts_8s) {
      for (const s of creatives.video_scripts_8s) {
        if (!s.hook_reference || s.hook_reference.includes("use the")) s.hook_reference = hookRef;
      }
    }

    // Ensure backward compatibility: also populate ad_concepts, headlines, ctas, visual_direction for poster generation
    const firstPoster = creatives.posters?.[0];
    const legacyFormat = {
      ad_concepts: firstPoster?.primary_text_options?.slice(0, 5) || [],
      headlines: firstPoster?.primary_text_options || [],
      ctas: firstPoster?.cta_options || creatives.ctas || [],
      visual_direction: firstPoster?.visual_direction || creatives.visual_direction || {},
      reel_scripts_15s: creatives.video_scripts_8s?.map((s: any) => ({
        hook: s.hook_line,
        body: [s.problem_or_desire, s.solution].filter(Boolean).join(" "),
        cta: s.cta,
      })) || [],
      reel_scripts_30s: creatives.reel_scripts_30s || [],
    };

    const content = {
      ...creatives,
      ...legacyFormat,
    };

    await db.insert(creativeIntelligenceCreatives).values({
      runId,
      hookId,
      creativeType: "full_pack",
      content,
    });

    return res.status(200).json({
      ok: true,
      creatives: content,
    });
  } catch (err: any) {
    console.error("Generate creatives error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Failed to generate creatives",
    });
  }
}
