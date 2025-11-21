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

    const systemInstruction = `You are a creative social-media copywriter for Instagram. Given the user's short input, output a single concise engaging caption (1-3 short sentences), include up to 2 relevant hashtags, one short CTA (like "Shop now" or "Share your moment"), and 1-2 fitting emojis. IMPORTANT: Output ONLY the caption text — no explanations, no JSON, no labels.`;

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
        assistant: "Sunset, coffee, and calm. Perfect end to the day. ☕🌇 #SunsetVibes #CoffeeMoments — Share your moment.",
      },
      {
        user: "new shoes just dropped feeling like a boss",
        assistant: "Steppin' out in the new kicks — feeling unstoppable. 👟🔥 #NewShoes #Style — Shop now",
      },
      {
        user: "won the match today, team played well",
        assistant: "We did it — what a match! 🏆⚽ #MatchDay #TeamWin — Cheer on!",
      },
    ];

    const messages: any[] = [
      { role: "system", content: systemInstruction },
      ...examples.flatMap((ex) => [
        { role: "user", content: `User input: ${ex.user}\nReturn only the caption.` },
        { role: "assistant", content: ex.assistant },
      ]),
      { role: "user", content: `User input: ${usedPrompt}\nReturn only the caption.` },
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
