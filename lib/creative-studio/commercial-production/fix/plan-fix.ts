/**
 * Fix planner — Gemini watches the part the user picked on the timeline and writes
 * the two instructions a fix needs:
 *  - frameEditInstruction: how to correct the first frame (image editing)
 *  - motionPrompt: what happens in the shot, re-staged with the correction (image → video)
 *
 * The user describes the problem in plain words, in any language.
 */

import { getGeminiApiKey, GEMINI_REST_BASE } from "@/lib/gemini-config";

export const FIX_PLANNER_MODEL = "gemini-3.8-flash";
const REQUEST_TIMEOUT_MS = 60_000;

export interface FixInstructions {
  /** English, for the image editing model. */
  frameEditInstruction: string;
  /** English, for the video model: action, camera, mood — with the fix applied. */
  motionPrompt: string;
  /** One plain sentence for the user, in their language. */
  userSummary: string;
}

export type FixPlanResult = { ok: true; instructions: FixInstructions } | { ok: false; reason: string };

export type FixPlanner = (input: {
  /** The part being redone (picture only). */
  clip: Buffer;
  clipSeconds: number;
  request: string;
  productName?: string;
}) => Promise<FixPlanResult>;

export function parseFixInstructions(text: string): FixPlanResult {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
  } catch {
    return { ok: false, reason: "We couldn't understand that change. Try describing it differently." };
  }
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (raw.fixable === false) {
    return {
      ok: false,
      reason: str(raw.notFixableReason) || "This change needs a new version of the whole ad.",
    };
  }
  const frameEditInstruction = str(raw.frameEditInstruction);
  const motionPrompt = str(raw.motionPrompt);
  if (!frameEditInstruction || !motionPrompt) {
    return { ok: false, reason: "We couldn't work out the fix. Try describing what should change." };
  }
  return {
    ok: true,
    instructions: {
      frameEditInstruction: frameEditInstruction.slice(0, 800),
      motionPrompt: motionPrompt.slice(0, 1200),
      userSummary: str(raw.userSummary).slice(0, 300) || frameEditInstruction.slice(0, 160),
    },
  };
}

function buildPrompt(input: Parameters<FixPlanner>[0]): string {
  return `You are a video ad editor. This ${input.clipSeconds.toFixed(1)}-second clip is one shot from an ad. The user wants it changed.

User's words: """${input.request.slice(0, 1200)}"""
Product: ${input.productName || "the product shown"}

The fix works in two steps: (1) an image model corrects the FIRST frame of this clip, (2) a video model animates a new clip of the same length starting from that corrected frame.

Write:
- "frameEditInstruction": what to change in the first frame. Start with a verb (move, remove, replace, change, add). Name only what changes. Placement must be realistic: food and household products sit on kitchen, dining or shop surfaces, never on laptops, keyboards, beds or the floor.
- "motionPrompt": what happens during the clip with the fix applied — the people's actions, expressions and the camera movement as in the original clip, adjusted so the action makes sense with the change. No speech, no on-screen text. Under 600 characters.
- "userSummary": one short, friendly sentence in the SAME language the user wrote in, saying what will change.

Return JSON only:
{
  "fixable": true,
  "frameEditInstruction": "Move the pickle jar from the laptop keyboard to the wooden desk beside the laptop.",
  "motionPrompt": "Static camera. The woman looks at her laptop, glances at the pickle jar on the desk beside it, picks it up and smiles.",
  "userSummary": "We'll move the jar off the laptop onto the desk."
}
If the request cannot be done by changing this one shot (for example "make the whole ad festive", "change the voice" or "change the language"), return {"fixable": false, "notFixableReason": "one short sentence in the user's language suggesting Make a new version instead"}.`;
}

/** Live planner (Gemini video understanding on the picked clip). */
export const planFixWithGemini: FixPlanner = async (input) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return { ok: false, reason: "Fixing is not available right now. Please try again later." };

  const res = await fetch(`${GEMINI_REST_BASE}/models/${FIX_PLANNER_MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: "video/mp4", data: input.clip.toString("base64") } },
            { text: buildPrompt(input) },
          ],
        },
      ],
      generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) {
    throw new Error(`Fix planning failed (HTTP ${res.status})`);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
  return parseFixInstructions(text);
};
