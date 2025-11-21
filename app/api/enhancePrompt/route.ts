// app/api/enhancePrompt/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Robust extractor to pull human-readable text from Responses API result.
 * The SDK returns different shapes depending on model/version; this function
 * is deliberately defensive and uses `any` only for the parsing stage.
 */
function extractTextFromResponse(response: any): string | null {
  if (response?.output_text && typeof response.output_text === "string") {
    const t = response.output_text.trim();
    if (t.length) return t;
  }

  if (typeof response === "string" && response.trim().length) {
    return response.trim();
  }

  const output = response?.output;
  if (Array.isArray(output) && output.length > 0) {
    const parts: string[] = [];

    for (const item of output) {
      if (!item) continue;

      if (typeof item === "string") {
        parts.push(item.trim());
        continue;
      }

      if (item.type === "output_text" && typeof item.text === "string") {
        parts.push(item.text.trim());
        continue;
      }

      if (item.content) {
        if (typeof item.content === "string") {
          parts.push(item.content.trim());
          continue;
        }
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (!c) continue;
            if (typeof c === "string") parts.push(c.trim());
            else if (typeof c.text === "string") parts.push(c.text.trim());
            else if (typeof c.content === "string") parts.push(c.content.trim());
          }
          continue;
        }
      }

      if (typeof item.text === "string") {
        parts.push(item.text.trim());
        continue;
      }
      if (item.message && typeof item.message === "string") {
        parts.push(item.message.trim());
        continue;
      }
    }

    const joined = parts.filter(Boolean).join("\n").trim();
    if (joined.length) return joined;
  }

  return null;
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await req.json().catch(() => null);
    const prompt = body?.prompt;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // Moderation check
    const mod = await client.moderations.create({
      model: "omni-moderation-latest",
      input: prompt,
    });

    if (mod?.results?.[0]?.flagged) {
      // Return a safe, short response when moderation flags the prompt
      return NextResponse.json(
        { error: "Prompt flagged by moderation", details: mod.results?.[0] ?? null },
        { status: 400 }
      );
    }

    // Compose instruction & call Responses API
    const systemInstruction = `Provide enhanced AI prompt for this no captions and no hastag`;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      instructions: systemInstruction,
      input: `User input: ${prompt}\n\nConstraints:\n- Keep under 2200 chars\n- Enhance and empathize the prompt like a graphic designer\n- Use emojis sparingly`,
      max_output_tokens: 200,
    });

    const caption = extractTextFromResponse(response as any);

    if (!caption) {
      return NextResponse.json(
        { error: "No caption returned from model" },
        { status: 500 }
      );
    }

    // Return only the caption (safe to serialize)
    return NextResponse.json({ caption: caption.trim() });
  } catch (err: any) {
    console.error("enhancePrompt error:", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
