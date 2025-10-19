// pages/api/ai/recommendations.ts
import type { NextApiRequest, NextApiResponse } from "next";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_API_MODEL ?? "gpt-4o"; // you can set model via env

if (!OPENAI_KEY) {
  console.warn("OPENAI_API_KEY is not set — AI recommendations endpoint will fail without it.");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed, use POST" });

  try {
    if (!OPENAI_KEY) return res.status(500).json({ error: "OpenAI API key not configured (OPENAI_API_KEY)" });

    const payload = req.body?.metrics ?? req.body ?? {};
    // Build a prompt that asks the model to return structured JSON recommendations
    const systemPrompt = `You are an expert performance marketer and ad analyst. Given aggregated ad account metrics (spend, reach, CTR, conversions, ROAS, budgets), produce a short JSON object with recommended actions grouped by impact level: "High", "Medium", "Low". Each recommendation should include: title, impact, reason, concrete action steps (2-4 bullets), and estimated potential uplift (percent or qualitative). Respond ONLY with valid JSON.`;

    const userPrompt = `Metrics:\n${JSON.stringify(payload, null, 2)}\n\nReturn JSON with key "recommendations" which is an array of recommendations. Example output:\n{\n  "recommendations": [\n    { "title": "...", "impact":"High", "reason":"...", "actions":["step1","step2"], "estimate":"~15% ROAS uplift" }\n  ]\n}\n\nMake 3-6 recommendations across impact levels.`;

    const body = {
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 700,
      temperature: 0.6,
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_KEY}`,
      },
      body: JSON.stringify(body),
    });

    const j = await r.json();

    if (!r.ok) {
      return res.status(r.status).json({ error: "OpenAI error", body: j });
    }

    const rawText = j?.choices?.[0]?.message?.content ?? j?.choices?.[0]?.text ?? JSON.stringify(j);
    // Try parse JSON from model output
    try {
      const parsed = JSON.parse(rawText);
      return res.status(200).json({ ok: true, raw: rawText, parsed });
    } catch (parseErr) {
      // If model didn't output JSON (sometimes), return raw text
      return res.status(200).json({ ok: true, raw: rawText, parsed: null });
    }
  } catch (err: any) {
    console.error("ai/recommendations error:", err);
    return res.status(500).json({ error: err?.message ?? String(err) });
  }
}
