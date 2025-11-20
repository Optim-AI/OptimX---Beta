// pages/api/recommendations.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ------------------------------
// Types
// ------------------------------

type AiRec = {
  title?: string;
  impact?: string;
  related_to?: { type?: string; id?: string | null | undefined } | null;
  reason?: string;
  actions?: string[];
  estimate?: string;
  confidence?: number | null;
};

type ReturnedRec = {
  id: string;
  title: string;
  reason?: string | null;
  impact?: string | null;
  confidence?: number | null;
  campaignId?: string | undefined;
  created_at: string;
};

// ------------------------------

function uid() {
  return (Math.random() + "").slice(2);
}

/** Call your internal AI endpoint. */
async function callInternalMetaAI(baseUrl: string, token: string, body: any = {}) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/ai/recommendationsMeta`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const txt = await r.text();
    let json: any = null;
    try {
      json = JSON.parse(txt);
    } catch {
      json = null;
    }

    if (!r.ok) {
      return { ok: false, error: `AI route responded ${r.status}`, text: txt, json };
    }

    return { ok: true, json };
  } catch (err: any) {
    return { ok: false, error: String(err) };
  }
}

/** Extract rec array from AI payload. */
function extractRecommendationsFromAI(aiJson: any): AiRec[] {
  if (!aiJson) return [];

  if (Array.isArray(aiJson)) return aiJson;
  if (Array.isArray(aiJson?.recommendations)) return aiJson.recommendations;

  const found = Object.values(aiJson).find(
    (v) => Array.isArray(v) && v.length && typeof v[0] === "object"
  );

  return Array.isArray(found) ? found : [];
}

/** Fallback logic if AI unavailable. */
function fallbackRecs(userId: string, campaigns: any[], metrics: any | null): AiRec[] {
  const recs: AiRec[] = [];
  const cur = metrics?.current ?? null;

  if (cur) {
    const roas = Number(cur.roas ?? 0);
    const avg_ctr = Number(cur.avg_ctr ?? 0);
    const reach = Number(cur.total_reach ?? 0);
    const conversions = Number(cur.conversions ?? 0);
    const spend = Number(cur.total_spend ?? 0);

    if (!isNaN(roas) && roas < 3 && roas > 0) {
      recs.push({
        title: "Reallocate budget to top converting ad sets",
        impact: "High",
        reason: `ROAS low at ${roas.toFixed(2)}x`,
        actions: ["Shift 20% budget to best adsets"],
        confidence: 80,
      });
    }

    if (!isNaN(avg_ctr) && avg_ctr < 1.5) {
      recs.push({
        title: "Refresh creatives",
        impact: "Medium",
        reason: `CTR only ${avg_ctr.toFixed(2)}%`,
        actions: ["Test new images", "Try different hooks"],
      });
    }

    if (reach > 100000 && conversions < 50) {
      recs.push({
        title: "Improve conversion tracking",
        impact: "High",
        reason: `High reach but low conversions`,
        actions: ["Fix pixel", "Improve landing page"],
      });
    }
  }

  for (const c of campaigns.slice(0, 8)) {
    const spent = Number(c.spend ?? c.spend_inr ?? 0);
    const conv = Number(c.conversions ?? 0);

    if (spent > 1000 && conv < 10) {
      recs.push({
        title: `Review ${c.name}`,
        impact: "Medium",
        reason: `High spend (${spent}) but low conversions (${conv})`,
      });
    }

    if (!c.budget || Number(c.budget) === 0) {
      recs.push({
        title: `Set a daily budget for ${c.name}`,
        impact: "Low",
        reason: `${c.name} has no budget assigned`,
      });
    }
  }

  return recs.slice(0, 8);
}

/** Convert AI record → safe small response */
function makeReturnedRec(aiRec: AiRec): ReturnedRec {
  const campaignId =
    aiRec?.related_to?.id != null ? String(aiRec.related_to.id) : undefined;

  return {
    id: uid(),
    title: aiRec.title ?? "Recommendation",
    reason: aiRec.reason ?? null,
    impact: aiRec.impact ?? null,
    confidence: typeof aiRec.confidence === "number" ? aiRec.confidence : null,
    campaignId,
    created_at: new Date().toISOString(),
  };
}

// ------------------------------
// Main Handler
// ------------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST")
    return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // Validate Bearer
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Missing bearer token" });
    }

    const token = auth.split(" ")[1];

    // Get user from Supabase
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return res.status(401).json({ ok: false, error: "Invalid token" });
    }

    const user = userData.user;
    const userId = user.id;

    // Get campaigns (user-specific)
    const { data: campaignsData } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("user_id", userId)
      .limit(50);

    const campaigns = Array.isArray(campaignsData) ? campaignsData : [];

    const incoming = req.body ?? {};
    const metrics = incoming.metrics ?? null;
    const range = incoming.range ?? null;

    // Try real Meta AI
    const aiAttempt = await callInternalMetaAI(NEXT_PUBLIC_BASE_URL, token, {
      metrics,
      range,
    });

    let aiRecs: AiRec[] = [];
    let rawToPersist: any = null;
    let usedSource = "fallback";

    if (aiAttempt.ok && aiAttempt.json) {
      const parsed = aiAttempt.json.parsed ?? aiAttempt.json;
      rawToPersist = parsed;

      aiRecs = extractRecommendationsFromAI(parsed);

      if (!aiRecs.length) {
        aiRecs = fallbackRecs(userId, campaigns, metrics);
        usedSource = "fallback-after-empty-ai";
      } else {
        usedSource = "ai-route";
      }
    } else {
      aiRecs = fallbackRecs(userId, campaigns, metrics);
      rawToPersist = { error: aiAttempt.error ?? "AI unavailable" };
      usedSource = "fallback-ai-failed";
    }

    // Persist
    const now = new Date().toISOString();
    const insertPayload = aiRecs.map((r) => ({
      user_id: userId,
      title: r.title ?? "Recommendation",
      reason: r.reason ?? null,
      impact: r.impact ?? null,
      confidence: typeof r.confidence === "number" ? r.confidence : null,
      campaign_id:
        r.related_to?.id != null ? String(r.related_to.id) : null,
      payload: { r, meta: { inserted_at: now, range } },
      created_at: now,
    }));

    if (insertPayload.length > 0) {
      await supabaseAdmin.from("recommendations").insert(insertPayload);
    }

    // Send small response to avoid 4MB limit
    const returned: ReturnedRec[] = aiRecs.map(makeReturnedRec);

    return res.status(200).json({
      ok: true,
      source: usedSource,
      count: returned.length,
      recommendations: returned,
    });
  } catch (err: any) {
    console.error("recommendations.ts error:", err);
    return res.status(500).json({
      ok: false,
      error: err?.message ?? "Unknown error",
    });
  }
}
