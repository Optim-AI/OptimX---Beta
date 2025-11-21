// app/api/generateCaption/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Basic profanity sanitizer (keeps meaning, reduces trigger risk). Add more pairs as needed. */
function sanitizeProfanity(s: string) {
  if (!s) return s;
  const map: Record<string, string> = {
    fuck: "f*ck",
    fucked: "f*cked",
    motherfucker: "friend",
    shit: "crap",
    asshole: "person",
    bitch: "person",
    damn: "darn",
    // add more as needed...
  };
  const re = new RegExp(Object.keys(map).join("|"), "gi");
  return s.replace(re, (m) => {
    const lower = m.toLowerCase();
    return map[lower] ?? m;
  });
}

/** Try to ensure there's at least one hashtag and one short CTA at the end if model omitted them. */
function finalizeCaption(caption: string, originalPrompt: string) {
  let out = (caption || "").trim();

  // If the model included extra newlines at start/end, trim
  out = out.replace(/^\s+|\s+$/g, "");

  // Ensure there's at least one hashtag
  const hasHashtag = /#[\p{L}\w-]+/u.test(out);
  if (!hasHashtag) {
    const keywords = ["football", "journey", "travel", "coffee", "life", "celebrate", "win", "game", "match", "style"];
    let chosen = keywords.find((k) => originalPrompt.toLowerCase().includes(k));
    if (!chosen) {
      const words = originalPrompt
        .replace(/[^a-zA-Z\s]/g, " ")
        .split(/\s+/)
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length > 3);
      chosen = words[0] || "moment";
    }
    out = `${out} ${chosen.startsWith("#") ? chosen : `#${chosen.replace(/\s+/g, "")}`}`;
  }

  // Ensure there's a short CTA
  const ctaRegex = /\b(Shop now|Buy now|Learn more|Tap to share|Share your moment|Tell us|Comment below|Join in|Cheer on|Show some love)\b/i;
  if (!ctaRegex.test(out)) {
    if (/football|match|game|score|win/i.test(originalPrompt)) {
      out = `${out} — Cheer on!`;
    } else if (/journey|life|celebrate|celebrating/i.test(originalPrompt)) {
      out = `${out} — Share your moment.`;
    } else {
      out = `${out} — Tap to share!`;
    }
  }

  return out.trim();
}

/** Try to extract text from several possible shapes */
function extractTextFromAnyResponse(response: any): string | null {
  if (!response) return null;

  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text.trim();

  try {
    const choices = response.choices;
    if (Array.isArray(choices) && choices.length > 0) {
      const c = choices[0];
      if (c.message) {
        if (typeof c.message.content === "string" && c.message.content.trim()) return c.message.content.trim();
        if (Array.isArray(c.message.content)) {
          const parts: string[] = [];
          for (const part of c.message.content) {
            if (!part) continue;
            if (typeof part === "string") parts.push(part.trim());
            else if (typeof part?.text === "string") parts.push(part.text.trim());
            else if (typeof part?.content === "string") parts.push(part.content.trim());
          }
          const joined = parts.join("\n").trim();
          if (joined) return joined;
        }
      }
      if (typeof c.text === "string" && c.text.trim()) return c.text.trim();
      if (typeof c.message?.content?.[0]?.text === "string" && c.message.content[0].text.trim()) return c.message.content[0].text.trim();
    }
  } catch (e) {}

  try {
    const output = response.output;
    if (Array.isArray(output) && output.length > 0) {
      const parts: string[] = [];
      for (const item of output) {
        if (!item) continue;
        if (typeof item === "string") parts.push(item.trim());
        else if (typeof item.text === "string") parts.push(item.text.trim());
        else if (item.content) {
          if (typeof item.content === "string") parts.push(item.content.trim());
          else if (Array.isArray(item.content)) {
            for (const c of item.content) {
              if (!c) continue;
              if (typeof c === "string") parts.push(c.trim());
              else if (typeof c.text === "string") parts.push(c.text.trim());
              else if (typeof c.content === "string") parts.push(c.content.trim());
            }
          }
        } else if (item.message && typeof item.message === "string") parts.push(item.message.trim());
      }
      const joined = parts.join("\n").trim();
      if (joined) return joined;
    }
  } catch (e) {}

  if (typeof response === "string" && response.trim()) return response.trim();
  return null;
}

/** POST handler */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body ?? {};
    if (!prompt || typeof prompt !== "string") return NextResponse.json({ error: "Missing prompt" }, { status: 400 });

    const systemInstruction = `You are a skilled social media copywriter specializing in Instagram captions.

You will receive a short user brief that may also include a description of the visual or generated image.

Your task is to write a single engaging caption in a natural human voice. By default, write a medium-to-long caption (around 3–8 sentences), unless the user explicitly asks for something very short or a one-liner. Adapt the tone to the context (fun, emotional, luxury, youthful, professional, etc.).

Guidelines:
- Use emojis sparingly and only when they feel natural and match the mood.
- You may include a call-to-action if it fits organically (for example: inviting people to shop, save, comment, share, visit, or book).
- Do NOT include any hashtags. Hashtags are handled separately.
- Do NOT add credits, quotation marks, labels, or explanations.
- Output ONLY the final caption text.`;

    // 1) Moderation check
    const mod = await client.moderations.create({
      model: "omni-moderation-latest",
      input: prompt,
    });
    const flagged = !!mod?.results?.[0]?.flagged;

    let triedSanitized = false;
    let usedPrompt = prompt;

    if (flagged) {
      triedSanitized = true;
      usedPrompt = sanitizeProfanity(prompt);
      const mod2 = await client.moderations.create({ model: "omni-moderation-latest", input: usedPrompt });
      if (!!mod2?.results?.[0]?.flagged) {
        return NextResponse.json({ error: "Prompt flagged by moderation and cannot be used." }, { status: 400 });
      }
    }

        const examples = [
      {
        user: "sunset walk with my coffee — perfect end to a long day",
        assistant:
          "Golden skies, warm coffee, and a quiet moment to breathe. Sometimes the best therapy is a slow walk at sunset with no rush, no noise, just you and your thoughts. ☕🌇",
      },
      {
        user: "new shoes just dropped feeling like a boss",
        assistant:
          "Laced up and locked in. These new kicks hit different — every step feels like a statement and every move feels a little more unstoppable. Walking into the week like I own it. 👟🔥",
      },
      {
        user: "won the match today, team played well",
        assistant:
          "What a game. Every pass, every tackle, every shout from the sidelines came together for this win. Proud of this team, the fight we showed, and the way we had each other’s backs till the final whistle. This is what playing as one feels like. 🏆⚽",
      },
    ];

    const messages: any[] = [
      { role: "system", content: systemInstruction },
      ...examples.flatMap((ex) => [
        {
          role: "user",
          content: `User input: ${ex.user}\nReturn only the caption.`,
        },
        { role: "assistant", content: ex.assistant },
      ]),
      {
        role: "user",
        content: `User input: ${usedPrompt}\nReturn only the caption.`,
      },
    ];

    // call chat completions
    const chatResp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages as any,
      max_tokens: 200,
      temperature: 0.7,
    });

    let caption = extractTextFromAnyResponse(chatResp as any);

    if (!caption) {
      try {
        const respAlt = await client.responses.create({
          model: "gpt-4o-mini",
          instructions: systemInstruction,
          input: `User input: ${usedPrompt}\nReturn only the caption.`,
          max_output_tokens: 200,
        });
        caption = extractTextFromAnyResponse(respAlt as any);
        if (!caption) {
          return NextResponse.json({ error: "No caption returned from model", raw: chatResp }, { status: 500 });
        }
      } catch (e) {
        return NextResponse.json({ error: "No caption returned from model", raw: chatResp }, { status: 500 });
      }
    }

    const final = finalizeCaption(caption, prompt);

    return NextResponse.json({
      caption: final,
      raw: chatResp,
      triedSanitized,
      usedPrompt: triedSanitized ? usedPrompt : undefined,
    });
  } catch (err: any) {
    console.error("generateCaption error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** GET handler (disallow) */
export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
