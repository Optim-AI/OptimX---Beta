/**
 * Ad-effectiveness judge for poster eval. Uses a stronger model than the
 * generator and the in-app QC so it isn't grading its own work.
 */

import axios from "axios";

export const JUDGE_MODEL = process.env.POSTER_EVAL_JUDGE_MODEL || "gemini-3.1-pro-preview";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const CRITERIA = [
  ["stoppingPower", "Would it stop a thumb scrolling a busy feed? Distinctive, high-contrast, a clear focal point."],
  ["messageClarity", "Is there ONE message a viewer gets in under 3 seconds?"],
  ["hierarchy", "Clear reading order (headline → product/proof → CTA); text legible at phone size; nothing competing."],
  ["productPresentation", "Product visible, appealing, believable and matching the reference photo (if any)."],
  ["copyAccuracy", "Only the approved text appears, spelled exactly, each once; no garbled or invented text."],
  ["objectiveFit", "Does the format serve the objective? (sale → offer dominant; launch → newness; feature → the feature is proven visually; before/after → a clear transformation; social proof → the proof is prominent; festive → occasion + gifting)."],
  ["brandFit", "Consistent with the brand colours/fonts/rules given; feels like one brand, not generic stock."],
  ["craft", "Professional polish: lighting, compositing, typography quality; no AI artefacts (warped hands, melted text, floating objects, fake reflections)."],
  ["ctaEffectiveness", "If a CTA is expected, is it visible and actionable? (no CTA expected = score whether its absence is right)."],
  ["platformFit", "Composed for the aspect ratio and placement; key content clear of UI safe zones (9:16: top/bottom 12%)."],
] as const;

export type CriterionKey = (typeof CRITERIA)[number][0];

export type JudgeResult = {
  scores: Record<CriterionKey, number>;
  overall: number;
  wouldShip: boolean;
  textSeen: string[];
  topIssues: string[];
  fixes: string[];
  verdict: string;
};

export type PairwiseResult = { winner: "A" | "B" | "tie"; confidence: number; reason: string };

async function callJudge(parts: unknown[], temperature = 0.2): Promise<any> {
  const key = process.env.GEMINI_API_KEY || process.env.NANO_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY required for the judge");
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await axios.post(
        `${BASE}/${JUDGE_MODEL}:generateContent`,
        {
          contents: [{ role: "user", parts }],
          generationConfig: { temperature, responseMimeType: "application/json" },
        },
        { headers: { "x-goog-api-key": key, "content-type": "application/json" }, timeout: 180_000 }
      );
      const text = (res.data?.candidates?.[0]?.content?.parts || [])
        .filter((p: any) => typeof p.text === "string" && !p.thought)
        .map((p: any) => p.text)
        .join("");
      return JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
    } catch (e: any) {
      lastErr = e;
      const status = e?.response?.status;
      if (status && status < 500 && status !== 429) break;
      await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    }
  }
  throw lastErr;
}

function imagePart(buf: Buffer, mime: string) {
  return { inline_data: { mime_type: mime, data: buf.toString("base64") } };
}

export async function judgePoster(opts: {
  poster: Buffer;
  posterMime: string;
  productPhoto?: { buf: Buffer; mime: string } | null;
  context: {
    brand: string;
    product: string;
    objective: string;
    userInstruction: string;
    aspectRatio: string;
    approvedText: string[];
    brandKit?: string | null;
  };
}): Promise<JudgeResult> {
  const rubric = CRITERIA.map(([k, d]) => `- ${k}: ${d}`).join("\n");
  const prompt = `You are a senior performance-marketing creative director reviewing a paid social ad poster before it ships.
Be strict and specific: score as you would for a real client spending real money. 10 = best-in-class agency work; 7 = good enough to run; 5 = mediocre; 3 = would embarrass the brand.

Brief:
- Brand: ${opts.context.brand}
- Product: ${opts.context.product}
- Objective: ${opts.context.objective}
- Client request: ${opts.context.userInstruction}
- Format: ${opts.context.aspectRatio}
- Approved text (exact): ${opts.context.approvedText.map((t) => `"${t}"`).join(", ")}
${opts.context.brandKit ? `- Brand kit: ${opts.context.brandKit}` : "- Brand kit: none supplied"}
${opts.productPhoto ? "The FIRST image is the client's real product photo; the SECOND image is the ad." : "The image is the ad (no product photo supplied)."}

Score each criterion 1-10:
${rubric}

Return JSON:
{"scores": {${CRITERIA.map(([k]) => `"${k}": 0`).join(", ")}},
 "overall": 0,
 "wouldShip": false,
 "textSeen": ["every distinct piece of text visible on the ad, exactly as rendered, excluding text printed on the product packaging"],
 "topIssues": ["most important problems, most severe first, max 4"],
 "fixes": ["concrete changes that would most improve this ad, max 3"],
 "verdict": "one sentence"}
"overall" is your holistic 1-10 judgement (not an average). "wouldShip" = would you approve this to run as-is for a paying client.`;

  const parts: unknown[] = [];
  if (opts.productPhoto) parts.push(imagePart(opts.productPhoto.buf, opts.productPhoto.mime));
  parts.push(imagePart(opts.poster, opts.posterMime));
  parts.push({ text: prompt });
  const raw = await callJudge(parts);
  const scores = {} as Record<CriterionKey, number>;
  for (const [k] of CRITERIA) scores[k] = Math.max(1, Math.min(10, Number(raw?.scores?.[k]) || 1));
  return {
    scores,
    overall: Math.max(1, Math.min(10, Number(raw?.overall) || 1)),
    wouldShip: raw?.wouldShip === true,
    textSeen: Array.isArray(raw?.textSeen) ? raw.textSeen.map(String) : [],
    topIssues: Array.isArray(raw?.topIssues) ? raw.topIssues.map(String).slice(0, 4) : [],
    fixes: Array.isArray(raw?.fixes) ? raw.fixes.map(String).slice(0, 3) : [],
    verdict: String(raw?.verdict || ""),
  };
}

/** Blind A/B: which is the better ad for this brief? Order is randomised by the caller. */
export async function judgePair(opts: {
  a: { buf: Buffer; mime: string };
  b: { buf: Buffer; mime: string };
  brief: string;
}): Promise<PairwiseResult> {
  const raw = await callJudge([
    { text: "Ad A:" },
    imagePart(opts.a.buf, opts.a.mime),
    { text: "Ad B:" },
    imagePart(opts.b.buf, opts.b.mime),
    {
      text: `You are a senior performance-marketing creative director. Brief: ${opts.brief}
Which ad would perform better as a paid social ad and better represents the brand? Judge stopping power, clarity, product presentation, text accuracy and craft.
Return JSON: {"winner": "A" | "B" | "tie", "confidence": 0.0-1.0, "reason": "one or two sentences"}`,
    },
  ]);
  const w = String(raw?.winner || "tie").toUpperCase();
  return {
    winner: w === "A" || w === "B" ? w : "tie",
    confidence: Math.max(0, Math.min(1, Number(raw?.confidence) || 0)),
    reason: String(raw?.reason || ""),
  };
}

/** Required approved lines missing from (or garbled in) what the judge read. */
export function textMismatches(approved: string[], seen: string[]): { missing: string[]; extra: string[] } {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}%₹]+/gu, " ").trim();
  // Join with spaces so a headline set on two lines still matches as one phrase.
  const seenNorm = seen.map(norm).join(" ");
  const approvedNorm = approved.map(norm);
  const missing = approved.filter((a) => !seenNorm.includes(norm(a)));
  const extra = seen.filter((s) => {
    const n = norm(s);
    return n && !approvedNorm.some((a) => a.includes(n) || n.includes(a));
  });
  return { missing, extra };
}
