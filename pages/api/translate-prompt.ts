// pages/api/translate-prompt.ts
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractTextFromResponse(response: any): string | null {
  if (!response) return null;
  if (typeof response === "string") return response.trim();
  if (response?.output_text && typeof response.output_text === "string") return response.output_text.trim();
  // Responses API shape: response.output (array)
  const output = response?.output;
  if (Array.isArray(output) && output.length) {
    const parts: string[] = [];
    for (const item of output) {
      if (!item) continue;
      if (typeof item === "string") parts.push(item.trim());
      else if (item?.type === "output_text" && typeof item.text === "string") parts.push(item.text.trim());
      else if (typeof item.text === "string") parts.push(item.text.trim());
      else if (item?.content && typeof item.content === "string") parts.push(item.content.trim());
      else if (Array.isArray(item?.content)) {
        for (const c of item.content) {
          if (!c) continue;
          if (typeof c === "string") parts.push(c.trim());
          else if (typeof c.text === "string") parts.push(c.text.trim());
        }
      }
    }
    const joined = parts.filter(Boolean).join("\n").trim();
    if (joined.length) return joined;
  }
  // fallback
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { text, purpose = "ad", context = {} } = req.body ?? {};
    if (!text || typeof text !== "string") return res.status(400).json({ error: "Missing text" });

    // Build system instruction to translate Tamil (or any language) to English and rewrite as Leonardo-friendly prompt
    const systemInstruction = `
You are a translation + prompt-engineering assistant.
1) Translate the user's input (which may be in Tamil or any other language) into clear, idiomatic English.
2) Then rewrite the translation into a concise, Leonardo.ai-friendly image generation prompt that preserves the user's intent, including: subject, mood/vibe, colors, composition, camera/lighting if relevant, any text/logo placement instructions, and any hashtags (if present).
3) Avoid any profanity and strip extraneous filler. Output only the final prompt (one paragraph, 1-3 sentences) and nothing else.
`;

    // include context (brand/tone) as helpful hints
    const contextParts: string[] = [];
    if (context.brandName) contextParts.push(`Brand: ${context.brandName}`);
    if (context.tone) contextParts.push(`Tone: ${context.tone}`);
    if (context.campaignName) contextParts.push(`Campaign: ${context.campaignName}`);
    if (context.tagline) contextParts.push(`Tagline: ${context.tagline}`);
    if (context.hashtags) contextParts.push(`Hashtags: ${context.hashtags}`);

    const promptInput = `User text (may be Tamil):\n${text}\n\nContext:\n${contextParts.join(" | ")}\n\nPlease translate and produce a Leonardo-ready prompt.`;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      instructions: systemInstruction,
      input: promptInput,
      max_output_tokens: 300,
    });

    const translated = extractTextFromResponse(response as any);

    if (!translated) {
      return res.status(500).json({ error: "Translation failed", raw: response });
    }

    return res.status(200).json({ translatedPrompt: translated.trim(), raw: response });
  } catch (err: any) {
    console.error("translate-prompt error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
