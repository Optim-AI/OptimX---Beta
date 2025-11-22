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
    const systemInstruction = `Generate exactly the prompt as requested without rewriting or optimizing it. Do not add captions, hashtags, or meta comments. Output only the enhanced poster generation prompt.`;

    const response = await client.responses.create({
  model: "gpt-4o-mini",
  instructions: systemInstruction,
  input: `Create a high–impact advertising poster engineered for real business results, with the visual quality of a top creative agency. Focus on visual storytelling, brand personality and striking aesthetics that drive conversions.

Core creative direction:
• Visually striking layout with clear hierarchy and a powerful focal point that supports the advertising message
• Typography and composition must feel intentional, modern and well–balanced
• Visual style, color palette and atmosphere must match the brand category and target audience
• No unnecessary clutter, random shapes or distracting decorative elements

Copywriting direction:
• A bold headline that instantly communicates the core benefit or key selling point
• A short supporting line that reinforces persuasion without long paragraphs
• A single, strong CTA (e.g., Order Now, Enroll Today, Try Free, Book Appointment)
• All text must be clean, readable and properly aligned

Branding direction:
• Display the brand name clearly and allocate a logo placement space
• Do NOT create, render or invent a new logo — the user will upload their own logo separately
• Color palette and design style should support the brand personality and advertised offer

Adaptability rules:
• The visual theme, mood, layout, color choices and graphic style must adapt to the selected campaign tone (professional, playful, minimal, luxury, dynamic, festive, elegant, trendy, bold-offer, launch, testimonial, etc.)
• The overall look should make sense for the specific business category and target audience
• Maintain balance between creativity and conversion — the ad should look artistic but still sell

Technical requirements:
• Use the aspect ratio chosen by the user (do NOT lock the design to a specific ratio)
• Produce a clean and polished high–resolution output suitable for ads, print and social media
• No watermarks, no invented brand elements, no distorted faces, no stretched text, no AI artifacts

Now generate the best possible poster for this user input:
${prompt}`,
  max_output_tokens: 2000,
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
