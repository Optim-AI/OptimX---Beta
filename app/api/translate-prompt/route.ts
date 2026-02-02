// app/api/translate-prompt/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function extractTextFromResponse(response: any): string | null {
  if (!response) return null;
  if (typeof response === "string") return response.trim();
  if (response?.output_text && typeof response.output_text === "string") return response.output_text.trim();

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

  // Try common Response/Chat shapes
  try {
    const choices = response?.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const c = choices[0];
      if (c?.message?.content && typeof c.message.content === "string") return c.message.content.trim();
      if (typeof c.text === "string") return c.text.trim();
    }
  } catch (e) {
    // ignore
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { text, purpose = "ad", context = {} } = body ?? {};

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const systemInstruction = `
You are a visual-prompt engineering assistant for image generation models like Nano banana, and Gemini.
Your job has two parts:
1) If the user writes in Tamil or any other language, translate it into natural English without changing the meaning.
2) Convert the translated input into a ad poster, highly detailed image prompt optimized for AI generation. Include:
   • subject and action
   • scene and mood
   • lighting and atmosphere
   • colors, materials, textures
   • camera angle / lens / composition when helpful
   • art style (realistic, minimal, 3D render, dynamic, luxury, etc.)
Keep it short (3–5 sentences), vivid, and descriptive. No disclaimers, no hastags, no emoji, no moralizing, no safety lectures, and no extra output before or after the prompt. Do NOT include the translation step in the final answer — only output the final image prompt.
`;

    const contextParts: string[] = [];
    if (context?.brandName) contextParts.push(`Brand: ${context.brandName}`);
    if (context?.tone) contextParts.push(`Tone: ${context.tone}`);
    if (context?.campaignName) contextParts.push(`Campaign: ${context.campaignName}`);
    if (context?.tagline) contextParts.push(`Tagline: ${context.tagline}`);
    if (context?.hashtags) contextParts.push(`Hashtags: ${context.hashtags}`);

    const promptInput = `User text (may be Tamil):\n${text}\n\nContext:\n${contextParts.join(" | ")}\n\nPlease translate and produce a Leonardo-ready prompt.`;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      instructions: systemInstruction,
      input: promptInput,
      max_output_tokens: 300,
    });

    const translated = extractTextFromResponse(response as any);

    if (!translated) {
      return NextResponse.json({ error: "Translation failed", raw: response }, { status: 500 });
    }

    return NextResponse.json({ translatedPrompt: translated.trim(), raw: response });
  } catch (err: any) {
    console.error("translate-prompt error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
