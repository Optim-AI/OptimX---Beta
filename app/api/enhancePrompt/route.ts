// app/api/enhancePrompt/route.ts
import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Robust extractor to pull human-readable text from Responses API result.
 * The SDK returns different shapes depending on model/version; this function
 * is deliberately defensive and uses `any` only for parsing stage.
 */
function extractTextFromResponse(response: any): string | null {
  // 1) Common convenience property
  if (response?.output_text && typeof response.output_text === "string") {
    const t = response.output_text.trim();
    if (t.length) return t;
  }

  // 2) If SDK returned a top-level string
  if (typeof response === "string" && response.trim().length) {
    return response.trim();
  }

  // 3) Walk response.output if present (array of items with different shapes)
  const output = response?.output;
  if (Array.isArray(output) && output.length > 0) {
    const parts: string[] = [];

    for (const item of output) {
      if (!item) continue;

      // plain string items
      if (typeof item === "string") {
        parts.push(item.trim());
        continue;
      }

      // item might be { type: "output_text", text: "..." }
      if (item.type === "output_text" && typeof item.text === "string") {
        parts.push(item.text.trim());
        continue;
      }

      // item might be { content: [ { type: "output_text", text: "..." }, ... ] }
      if (item.content) {
        // content can be string or array
        if (typeof item.content === "string") {
          parts.push(item.content.trim());
          continue;
        }
        if (Array.isArray(item.content)) {
          for (const c of item.content) {
            if (!c) continue;
            if (typeof c === "string") {
              parts.push(c.trim());
            } else if (typeof c.text === "string") {
              parts.push(c.text.trim());
            } else if (typeof c.content === "string") {
              parts.push(c.content.trim());
            }
          }
          continue;
        }
      }

      // item might have nested 'message' or 'text' fields
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

  // 4) Fallback to stringified response if nothing else found (avoid leaking huge objects)
  return null;
}

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OpenAI API key not configured." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = body?.prompt;
    const mode = body?.mode;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
    }

    // moderation check (keeps your original moderation model)
    const mod = await client.moderations.create({
      model: "omni-moderation-latest",
      input: prompt,
    });

    const flagged = !!mod?.results?.[0]?.flagged;
    if (flagged) {
      return NextResponse.json(
        { error: "Prompt flagged by moderation", details: mod.results?.[0] ?? null },
        { status: 400 }
      );
    }

    // keep your exact system instruction / prompt behavior
    const systemInstruction = `Provide enhanced AI prompt for this no captions and no hastag`;

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      instructions: systemInstruction,
      input: `User input: ${prompt}\n\nConstraints:\n- Keep under 2200 chars\n- enhance and emphathize the prompt like a creative graphic designer`,
      max_output_tokens: 200,
    });

    const caption = extractTextFromResponse(response as any);

    if (!caption) {
      return NextResponse.json({ error: "No caption returned from model" }, { status: 500 });
    }

    // Return only the caption string to avoid serialisation troubles
    return NextResponse.json({ caption: caption.trim() });
  } catch (err: any) {
    console.error("enhancePrompt error:", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
