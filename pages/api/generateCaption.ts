// pages/api/generateCaption.ts
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { prompt, mode } = req.body ?? {};
  if (!prompt || typeof prompt !== "string") return res.status(400).json({ error: "Missing prompt" });

  try {
    // 1) Moderation check
    const mod = await client.moderations.create({
      model: "omni-moderation-latest",
      input: prompt,
    });
    const flagged = !!mod?.results?.[0]?.flagged;
    if (flagged) {
      return res.status(400).json({ error: "Prompt flagged by moderation", details: mod.results?.[0] });
    }

    // 2) Generate caption with Responses API
    const systemInstruction = `You are a creative social-media copywriter for Instagram. Given the user's short input, output a concise engaging caption (1-3 short sentences), up to 2 relevant hashtags, one short CTA, and 1-2 fitting emojis. Output only the caption text.`;

    const response = await client.responses.create({
      model: "gpt-4o-mini", // change this if you use another model
      instructions: systemInstruction,
      input: `User input: ${prompt}\n\nConstraints:\n- Keep under 2200 chars\n- Up to 2 hashtags\n- 1 CTA (short)\n- Use emojis sparingly`,
      max_output_tokens: 200,
    });

    // Use the robust extractor
    const caption = extractTextFromResponse(response as any);

    if (!caption) {
      return res.status(500).json({ error: "No caption returned from model", raw: response });
    }

    return res.status(200).json({ caption: caption.trim(), raw: response });
  } catch (err: any) {
    console.error("generateCaption error:", err);
    return res.status(500).json({ error: String(err) });
  }
}
